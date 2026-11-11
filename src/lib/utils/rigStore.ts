/**
 * The rig's files, kept in this browser's IndexedDB: cab IRs and NAM amp models. This
 * is the copy the rig plays from, so nothing is fetched when Monitor goes on. A rig
 * belongs to one machine (its audio device IDs do too), and so do its amp models.
 *
 * Uploaded IRs also follow the account (rigCloud.ts). The copy here stays the working
 * one, and `owner` records whose account it's in step with.
 */

const DB_NAME = 'setlist-rig';
const DB_VERSION = 2;

export type RigFileKind = 'irs' | 'models';

/** Cab IRs are a few KB to a few hundred; this still allows a long room IR */
export const MAX_IR_BYTES = 2_000_000;
/** A standard NAM model is a few hundred KB of JSON; A2 models carry more */
export const MAX_MODEL_BYTES = 10_000_000;

/**
 * Where a file came from, when it came from TONE3000. Its terms ask that creator names
 * and licenses stay with the file, and it stops the same capture being saved twice.
 */
export interface RigFileSource {
	toneId: number;
	/** TONE3000's id for this one file */
	modelId: number;
	toneTitle: string;
	toneUrl: string;
	creator: string;
	creatorUrl: string | null;
	license: string;
	gear: string;
}

export interface RigFile {
	id: string;
	name: string;
	/** Bytes kept in this browser */
	size: number;
	/** Only for files from TONE3000 */
	source?: RigFileSource;
	/** The account this IR is kept with, once it has synced */
	owner?: string;
}

interface StoredFile extends RigFile {
	bytes: ArrayBuffer;
	addedAt: number;
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		// Version 1 had only IRs; each upgrade adds whatever stores are missing
		request.onupgradeneeded = () => {
			for (const kind of ['irs', 'models'] satisfies RigFileKind[]) {
				if (!request.result.objectStoreNames.contains(kind)) {
					request.result.createObjectStore(kind, { keyPath: 'id' });
				}
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function run<T>(
	kind: RigFileKind,
	mode: IDBTransactionMode,
	operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(kind, mode);
		const request = operation(tx.objectStore(kind));
		tx.oncomplete = () => {
			db.close();
			resolve(request.result);
		};
		tx.onerror = tx.onabort = () => {
			db.close();
			reject(tx.error ?? request.error);
		};
	});
}

export async function listRigFiles(kind: RigFileKind): Promise<RigFile[]> {
	const all = await run<StoredFile[]>(kind, 'readonly', (store) => store.getAll());
	return all
		.sort((a, b) => a.addedAt - b.addedAt)
		.map(({ id, name, bytes, source, owner }) => ({
			id,
			name,
			size: bytes.byteLength,
			...(source ? { source } : {}),
			...(owner ? { owner } : {})
		}));
}

export async function getRigFileBytes(kind: RigFileKind, id: string): Promise<ArrayBuffer | null> {
	const record = await run<StoredFile | undefined>(kind, 'readonly', (store) => store.get(id));
	return record?.bytes ?? null;
}

/**
 * `synced` is for an IR arriving from the account: it keeps the id it has there, so
 * rig settings point at the same file on every device.
 */
export async function saveRigFile(
	kind: RigFileKind,
	name: string,
	bytes: ArrayBuffer,
	source?: RigFileSource,
	synced?: { id: string; owner: string }
): Promise<RigFile> {
	const file: RigFile = {
		id: synced?.id ?? crypto.randomUUID(),
		name,
		size: bytes.byteLength,
		...(source ? { source } : {}),
		...(synced ? { owner: synced.owner } : {})
	};
	const record: StoredFile = { ...file, bytes, addedAt: Date.now() };
	await run(kind, 'readwrite', (store) => store.add(record));
	return file;
}

export function renameRigFile(kind: RigFileKind, id: string, name: string): Promise<void> {
	return updateRigFile(kind, id, { name });
}

/** A read and a write in one transaction, so a change can't lose the bytes */
export async function updateRigFile(
	kind: RigFileKind,
	id: string,
	patch: { name?: string; owner?: string }
): Promise<void> {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(kind, 'readwrite');
		const store = tx.objectStore(kind);
		const request = store.get(id);
		request.onsuccess = () => {
			const record = request.result as StoredFile | undefined;
			if (record) store.put({ ...record, ...patch });
		};
		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = tx.onabort = () => {
			db.close();
			reject(tx.error ?? request.error);
		};
	});
}

export async function deleteRigFile(kind: RigFileKind, id: string): Promise<void> {
	await run(kind, 'readwrite', (store) => store.delete(id));
}

/** "Mesa 4x12 V30 SM57.wav" → "Mesa 4x12 V30 SM57" */
export function rigFileName(fileName: string): string {
	return fileName.replace(/\.(wav|nam)$/i, '').trim() || 'Untitled';
}

/**
 * A first check before keeping a file: every .nam is JSON naming its architecture.
 * The engine is the real test (A2 models nest their weights differently).
 */
export function looksLikeNamModel(json: string): boolean {
	try {
		const parsed: unknown = JSON.parse(json);
		return (
			!!parsed &&
			typeof parsed === 'object' &&
			typeof (parsed as { architecture?: unknown }).architecture === 'string'
		);
	} catch {
		return false;
	}
}
