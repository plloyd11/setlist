/**
 * The rig's files, kept in this browser's IndexedDB rather than the database: cab
 * IRs and NAM amp models. A rig belongs to one machine (its audio device IDs do too),
 * the files are small, and keeping them here needs no migration or bucket.
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
	/** Only for files from TONE3000 */
	source?: RigFileSource;
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
		.map(({ id, name, source }) => (source ? { id, name, source } : { id, name }));
}

export async function getRigFileBytes(kind: RigFileKind, id: string): Promise<ArrayBuffer | null> {
	const record = await run<StoredFile | undefined>(kind, 'readonly', (store) => store.get(id));
	return record?.bytes ?? null;
}

export async function saveRigFile(
	kind: RigFileKind,
	name: string,
	bytes: ArrayBuffer,
	source?: RigFileSource
): Promise<RigFile> {
	const file: RigFile = { id: crypto.randomUUID(), name, ...(source ? { source } : {}) };
	const record: StoredFile = { ...file, bytes, addedAt: Date.now() };
	await run(kind, 'readwrite', (store) => store.add(record));
	return file;
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
