/**
 * Synced rig IRs are private to the musician who uploaded them. The browser writes
 * the table and the bucket directly, so the database's own rules are the only gate:
 * these talk to Supabase with publishable-key clients to test exactly those.
 */
import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createTestUser, deleteTestUser } from './helpers/auth';
import { cleanupRigIrs } from './helpers/cleanup';

const url = process.env.PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const wav = readFileSync(path.resolve('tests/fixtures/sample.wav'));

function makeClient(): SupabaseClient {
	return createClient(url, publishableKey, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});
}

async function signedIn(tag: number) {
	const user = await createTestUser(tag);
	const client = makeClient();
	const { error } = await client.auth.signInWithPassword({
		email: user.email,
		password: user.password
	});
	if (error) throw new Error(`Sign-in failed: ${error.message}`);
	return { id: user.id, client };
}

const bucket = (client: SupabaseClient) => client.storage.from('rig-irs');
const pathFor = (userId: string, id: string) => `users/${userId}/${id}.wav`;

test.describe.serial('Synced rig IRs are private', () => {
	let owner: Awaited<ReturnType<typeof signedIn>>;
	let stranger: Awaited<ReturnType<typeof signedIn>>;
	const anon = makeClient();
	const irId = crypto.randomUUID();

	test.beforeAll(async () => {
		const base = Date.now();
		owner = await signedIn(base);
		stranger = await signedIn(base + 1);
	});

	test.afterAll(async () => {
		for (const user of [owner, stranger]) {
			if (!user) continue;
			await cleanupRigIrs(user.id);
			await deleteTestUser(user.id);
		}
	});

	test('the owner can keep an IR with their account', async () => {
		const { error: upload } = await bucket(owner.client).upload(pathFor(owner.id, irId), wav, {
			contentType: 'audio/wav'
		});
		expect(upload).toBeNull();

		// user_id is left out, as a forgetful client might: it defaults to the caller
		const { data, error } = await owner.client
			.from('rig_irs')
			.insert({
				id: irId,
				name: 'V30 SM57',
				storage_path: pathFor(owner.id, irId),
				file_size_bytes: wav.byteLength
			})
			.select('user_id')
			.single();
		expect(error).toBeNull();
		expect(data?.user_id).toBe(owner.id);

		const { data: file } = await bucket(owner.client).download(pathFor(owner.id, irId));
		expect(file?.size).toBe(wav.byteLength);
	});

	test('nobody else can see it, or fetch the file', async () => {
		for (const viewer of [stranger.client, anon]) {
			const { data: rows } = await viewer.from('rig_irs').select('id');
			expect(rows ?? []).toEqual([]);
			const { data: signed } = await bucket(viewer).createSignedUrl(pathFor(owner.id, irId), 60);
			expect(signed?.signedUrl).toBeFalsy();
			const { data: file } = await bucket(viewer).download(pathFor(owner.id, irId));
			expect(file).toBeNull();
		}
	});

	test('nobody else can rename or remove it', async () => {
		for (const intruder of [stranger.client, anon]) {
			const { data: renamed } = await intruder
				.from('rig_irs')
				.update({ name: 'Hijacked' })
				.eq('id', irId)
				.select('id');
			expect(renamed ?? []).toEqual([]);
			const { data: deleted } = await intruder.from('rig_irs').delete().eq('id', irId).select('id');
			expect(deleted ?? []).toEqual([]);
			await bucket(intruder).remove([pathFor(owner.id, irId)]);
		}
		const { data: row } = await owner.client.from('rig_irs').select('name').eq('id', irId).single();
		expect(row?.name).toBe('V30 SM57');
		const { data: file } = await bucket(owner.client).download(pathFor(owner.id, irId));
		expect(file?.size).toBe(wav.byteLength);
	});

	test('nobody can write into someone else’s library', async () => {
		const forgedId = crypto.randomUUID();

		// A file into the owner's folder
		const { error: upload } = await bucket(stranger.client).upload(
			pathFor(owner.id, forgedId),
			wav,
			{ contentType: 'audio/wav' }
		);
		expect(upload).not.toBeNull();

		// A row in the owner's name
		const { error: asOwner } = await stranger.client.from('rig_irs').insert({
			id: forgedId,
			user_id: owner.id,
			name: 'Planted',
			storage_path: pathFor(owner.id, forgedId),
			file_size_bytes: wav.byteLength
		});
		expect(asOwner).not.toBeNull();

		// Their own row, pointed at the owner's file
		const { error: borrowed } = await stranger.client.from('rig_irs').insert({
			id: forgedId,
			name: 'Borrowed',
			storage_path: pathFor(owner.id, irId),
			file_size_bytes: wav.byteLength
		});
		expect(borrowed).not.toBeNull();

		const { error: signedOut } = await anon.from('rig_irs').insert({
			id: forgedId,
			name: 'Anonymous',
			storage_path: pathFor(owner.id, forgedId),
			file_size_bytes: wav.byteLength
		});
		expect(signedOut).not.toBeNull();
	});

	test('a row only ever changes its name, and the bucket only takes small WAVs', async () => {
		const { error: rename } = await owner.client
			.from('rig_irs')
			.update({ name: 'V30 SM57 edge' })
			.eq('id', irId);
		expect(rename).toBeNull();

		// Repointing a row, or handing it to someone, isn't a rename
		const { error: repoint } = await owner.client
			.from('rig_irs')
			.update({ storage_path: pathFor(stranger.id, irId) })
			.eq('id', irId);
		expect(repoint).not.toBeNull();
		const { error: handOver } = await owner.client
			.from('rig_irs')
			.update({ user_id: stranger.id })
			.eq('id', irId);
		expect(handOver).not.toBeNull();

		const { error: blank } = await owner.client
			.from('rig_irs')
			.update({ name: '   ' })
			.eq('id', irId);
		expect(blank).not.toBeNull();

		// Stored XSS guard: a signed URL must never serve HTML from this bucket
		const { error: html } = await bucket(owner.client).upload(
			`users/${owner.id}/${crypto.randomUUID()}.html`,
			Buffer.from('<script>alert(1)</script>'),
			{ contentType: 'text/html' }
		);
		expect(html).not.toBeNull();

		const { error: huge } = await bucket(owner.client).upload(
			pathFor(owner.id, crypto.randomUUID()),
			Buffer.alloc(2_100_000),
			{ contentType: 'audio/wav' }
		);
		expect(huge).not.toBeNull();
	});

	test('deleting a user removes their rows', async () => {
		const user = await signedIn(Date.now() + 2);
		const id = crypto.randomUUID();
		await bucket(user.client).upload(pathFor(user.id, id), wav, { contentType: 'audio/wav' });
		const { error } = await user.client.from('rig_irs').insert({
			id,
			name: 'Soon gone',
			storage_path: pathFor(user.id, id),
			file_size_bytes: wav.byteLength
		});
		expect(error).toBeNull();

		// Storage objects don't cascade, so they go first
		await cleanupRigIrs(user.id);
		await deleteTestUser(user.id);
		const { data } = await owner.client.from('rig_irs').select('id').eq('id', id);
		expect(data ?? []).toEqual([]);
	});
});
