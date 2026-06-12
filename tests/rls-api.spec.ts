/**
 * API-level RLS write-isolation tests (RLS-API-01..07).
 *
 * REQUIRES migration 20260610000000_security_and_integrity_fixes.sql to be
 * applied. These tests assert the policies and RPCs introduced there:
 *   - owner-only SELECT on band_invites
 *   - removal of the token-less band_members self-insert policy
 *   - accept_band_invite() / get_shared_setlist() SECURITY DEFINER RPCs
 *   - song-ownership check on band_songs INSERT
 *   - removal of the broad `to anon` read policies
 *   - band_members self-leave DELETE policy
 *
 * RLS-API-08 additionally requires 20260611220000_create_song_audio.sql
 * (song_audio table + the private 'song-audio' storage bucket).
 * RLS-API-09 additionally requires 20260612000000_create_song_files.sql
 * (song_files table + the private 'song-files' storage bucket).
 *
 * Unlike the UI specs, these talk to Supabase directly with publishable-key
 * clients signed in as two admin-created users (plus one anon client).
 * No browser pages are used.
 */
import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createTestUser, deleteTestUser } from './helpers/auth';
import { adminClient } from './helpers/supabase-admin';
import { safeDelete } from './helpers/cleanup';

const url = process.env.PUBLIC_SUPABASE_URL;
const publishableKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
	throw new Error(
		'Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
			'Ensure .env.test is populated with your Supabase credentials.'
	);
}

type ApiUser = {
	id: string;
	email: string;
	client: SupabaseClient;
};

function makeClient(): SupabaseClient {
	return createClient(url!, publishableKey!, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});
}

/** Create a user via the admin API and sign in a dedicated API client as them. */
async function createSignedInUser(tag: number): Promise<ApiUser> {
	const user = await createTestUser(tag);
	const client = makeClient();
	const { error } = await client.auth.signInWithPassword({
		email: user.email,
		password: user.password
	});
	if (error) throw new Error(`Failed to sign in API test user: ${error.message}`);
	return { id: user.id, email: user.email, client };
}

/** Insert an invite for a band via the admin client and return its token. */
async function createInviteToken(bandId: string, createdBy: string): Promise<string> {
	const { data, error } = await adminClient
		.from('band_invites')
		.insert({ band_id: bandId, created_by: createdBy })
		.select('token')
		.single();
	if (error) throw new Error(`Failed to create invite: ${error.message}`);
	return data.token;
}

test.describe('API-level RLS write isolation', () => {
	let userA: ApiUser;
	let userB: ApiUser;
	let anonApi: SupabaseClient;
	let bandA: { id: string }; // owned by user A
	let bandB: { id: string }; // owned by user B
	let songA: { id: string; title: string }; // owned by user A

	test.beforeAll(async () => {
		userA = await createSignedInUser(9001);
		userB = await createSignedInUser(9002);
		anonApi = makeClient(); // never signed in

		// Band owned by A, with A as owner member (mirrors helpers/factories createBand)
		const { data: bandAData, error: bandAError } = await adminClient
			.from('bands')
			.insert({ owner_id: userA.id, name: 'RLS API Band A' })
			.select()
			.single();
		if (bandAError) throw new Error(`Setup bandA failed: ${bandAError.message}`);
		bandA = bandAData;
		const { error: memberAError } = await adminClient
			.from('band_members')
			.insert({ band_id: bandA.id, user_id: userA.id, role: 'owner' });
		if (memberAError) throw new Error(`Setup bandA member failed: ${memberAError.message}`);

		// Band owned by B, with B as owner member
		const { data: bandBData, error: bandBError } = await adminClient
			.from('bands')
			.insert({ owner_id: userB.id, name: 'RLS API Band B' })
			.select()
			.single();
		if (bandBError) throw new Error(`Setup bandB failed: ${bandBError.message}`);
		bandB = bandBData;
		const { error: memberBError } = await adminClient
			.from('band_members')
			.insert({ band_id: bandB.id, user_id: userB.id, role: 'owner' });
		if (memberBError) throw new Error(`Setup bandB member failed: ${memberBError.message}`);

		// Song owned by A
		const { data: songData, error: songError } = await adminClient
			.from('songs')
			.insert({ user_id: userA.id, title: 'RLS API Song A', duration_seconds: 180 })
			.select()
			.single();
		if (songError) throw new Error(`Setup songA failed: ${songError.message}`);
		songA = songData;
	});

	test.afterAll(async () => {
		// deleteTestUser removes owned bands first (RESTRICT), then the user;
		// CASCADE cleans songs, setlists, memberships and invites.
		if (userB) await deleteTestUser(userB.id);
		if (userA) await deleteTestUser(userA.id);
	});

	test("user B cannot SELECT band_invites for user A's band (RLS-API-01)", async () => {
		const token = await createInviteToken(bandA.id, userA.id);
		expect(token).toBeTruthy();

		// Owner-only SELECT policy: B sees 0 rows, no error
		const { data, error } = await userB.client
			.from('band_invites')
			.select('*')
			.eq('band_id', bandA.id);
		expect(error).toBeNull();
		expect(data ?? []).toHaveLength(0);

		// Sanity: the owner CAN read it
		const { data: ownerData } = await userA.client
			.from('band_invites')
			.select('token')
			.eq('band_id', bandA.id);
		expect((ownerData ?? []).length).toBeGreaterThan(0);
	});

	test('user B cannot INSERT themselves into band_members without a token (RLS-API-02)', async () => {
		const { data, error } = await userB.client
			.from('band_members')
			.insert({ band_id: bandA.id, user_id: userB.id, role: 'member' })
			.select();

		// The token-less self-insert policy was removed: either an RLS error or 0 rows
		expect(error !== null || (data ?? []).length === 0).toBe(true);

		// Verify via admin that no membership row was created
		const { data: adminRows } = await adminClient
			.from('band_members')
			.select('id')
			.eq('band_id', bandA.id)
			.eq('user_id', userB.id);
		expect(adminRows ?? []).toHaveLength(0);
	});

	test('accept_band_invite RPC: joined, then already_member, invalid for random token (RLS-API-03)', async () => {
		const token = await createInviteToken(bandA.id, userA.id);
		try {
			// Valid token: B joins band A
			const { data: first, error: firstError } = await userB.client.rpc('accept_band_invite', {
				invite_token: token
			});
			expect(firstError).toBeNull();
			expect(first?.[0]?.status).toBe('joined');
			expect(first?.[0]?.band_id).toBe(bandA.id);

			// Second call: already a member (and the invite is now used)
			const secondToken = await createInviteToken(bandA.id, userA.id);
			const { data: second, error: secondError } = await userB.client.rpc('accept_band_invite', {
				invite_token: secondToken
			});
			expect(secondError).toBeNull();
			expect(second?.[0]?.status).toBe('already_member');

			// Random token: invalid
			const { data: bogus, error: bogusError } = await userB.client.rpc('accept_band_invite', {
				invite_token: crypto.randomUUID()
			});
			expect(bogusError).toBeNull();
			expect(bogus?.[0]?.status).toBe('invalid');
		} finally {
			// Remove B's membership so other tests see a non-member B
			await adminClient
				.from('band_members')
				.delete()
				.eq('band_id', bandA.id)
				.eq('user_id', userB.id);
		}
	});

	test("user B cannot UPDATE user A's song (RLS-API-04)", async () => {
		const { data, error } = await userB.client
			.from('songs')
			.update({ title: 'Hijacked Title' })
			.eq('id', songA.id)
			.select();

		// RLS filters the row: 0 rows affected (or an error -- either is a pass)
		expect(error !== null || (data ?? []).length === 0).toBe(true);

		// Verify via admin that the title is unchanged
		const { data: adminSong } = await adminClient
			.from('songs')
			.select('title')
			.eq('id', songA.id)
			.single();
		expect(adminSong?.title).toBe(songA.title);
	});

	test("user B cannot link user A's song into their own band via band_songs (RLS-API-05)", async () => {
		const { data, error } = await userB.client
			.from('band_songs')
			.insert({ band_id: bandB.id, song_id: songA.id, added_by: userB.id })
			.select();

		// New policy requires the caller to OWN the song being linked
		expect(error !== null || (data ?? []).length === 0).toBe(true);

		// Verify via admin that no link row was created
		const { data: adminRows } = await adminClient
			.from('band_songs')
			.select('id')
			.eq('band_id', bandB.id)
			.eq('song_id', songA.id);
		expect(adminRows ?? []).toHaveLength(0);
	});

	test('anon client gets 0 rows from profiles/setlists but get_shared_setlist works (RLS-API-06)', async () => {
		// Shared setlist owned by A, with one song, created via admin
		const shareToken = crypto.randomUUID();
		const { data: setlist, error: setlistError } = await adminClient
			.from('setlists')
			.insert({ user_id: userA.id, name: 'RLS API Shared Set', share_token: shareToken })
			.select()
			.single();
		if (setlistError) throw new Error(`Setup setlist failed: ${setlistError.message}`);

		try {
			const { error: ssError } = await adminClient
				.from('setlist_songs')
				.insert({ setlist_id: setlist.id, song_id: songA.id, position: 0 });
			if (ssError) throw new Error(`Setup setlist_songs failed: ${ssError.message}`);

			// Direct anon SELECTs return no rows (broad `to anon` policies were dropped)
			const { data: profiles } = await anonApi.from('profiles').select('*');
			expect(profiles ?? []).toHaveLength(0);

			const { data: setlists } = await anonApi.from('setlists').select('*');
			expect(setlists ?? []).toHaveLength(0);

			// ...but the token-keyed RPC serves the whitelisted share payload
			const { data: shared, error: sharedError } = await anonApi.rpc('get_shared_setlist', {
				p_token: shareToken
			});
			expect(sharedError).toBeNull();
			expect(shared?.name).toBe('RLS API Shared Set');
			expect(shared?.songs?.[0]?.title).toBe(songA.title);

			// A bogus token yields no data
			const { data: bogus, error: bogusError } = await anonApi.rpc('get_shared_setlist', {
				p_token: crypto.randomUUID()
			});
			expect(bogusError).toBeNull();
			expect(bogus).toBeNull();
		} finally {
			await safeDelete('setlists', setlist.id);
		}
	});

	test('non-owner member CAN delete their own band_members row (RLS-API-07)', async () => {
		// Make B a regular member of A's band via admin (clear any leftover first)
		await adminClient.from('band_members').delete().eq('band_id', bandA.id).eq('user_id', userB.id);
		const { error: insertError } = await adminClient
			.from('band_members')
			.insert({ band_id: bandA.id, user_id: userB.id, role: 'member' });
		if (insertError) throw new Error(`Setup membership failed: ${insertError.message}`);

		// Self-leave: B deletes their own membership row
		const { data, error } = await userB.client
			.from('band_members')
			.delete()
			.eq('band_id', bandA.id)
			.eq('user_id', userB.id)
			.select();
		expect(error).toBeNull();
		expect(data ?? []).toHaveLength(1);

		// Verify via admin that the row is gone
		const { data: adminRows } = await adminClient
			.from('band_members')
			.select('id')
			.eq('band_id', bandA.id)
			.eq('user_id', userB.id);
		expect(adminRows ?? []).toHaveLength(0);
	});

	test('song_audio visibility and storage signing follow song visibility (RLS-API-08)', async () => {
		const storagePath = `songs/${songA.id}/${crypto.randomUUID()}.wav`;
		const fileBuffer = fs.readFileSync(path.resolve('tests/fixtures/sample.wav'));

		// Admin: audio object + metadata row attached to A's song
		const { error: uploadError } = await adminClient.storage
			.from('song-audio')
			.upload(storagePath, fileBuffer, { contentType: 'audio/wav' });
		if (uploadError) throw new Error(`Setup song-audio upload failed: ${uploadError.message}`);

		const { data: audioRow, error: audioError } = await adminClient
			.from('song_audio')
			.insert({
				song_id: songA.id,
				label: 'RLS API Mix',
				storage_path: storagePath,
				file_name: 'sample.wav',
				mime_type: 'audio/wav',
				file_size_bytes: fileBuffer.length
			})
			.select()
			.single();
		if (audioError) throw new Error(`Setup song_audio failed: ${audioError.message}`);

		const forgedInsert = () =>
			userB.client
				.from('song_audio')
				.insert({
					song_id: songA.id,
					storage_path: `songs/${songA.id}/${crypto.randomUUID()}.wav`,
					file_name: 'forged.wav',
					mime_type: 'audio/wav',
					file_size_bytes: 10
				})
				.select();

		try {
			// Outsider B: no metadata rows, no signed URL
			const { data: bRows, error: bSelectError } = await userB.client
				.from('song_audio')
				.select('*')
				.eq('song_id', songA.id);
			expect(bSelectError).toBeNull();
			expect(bRows ?? []).toHaveLength(0);

			const { data: bSigned, error: bSignError } = await userB.client.storage
				.from('song-audio')
				.createSignedUrl(storagePath, 60);
			expect(bSignError).not.toBeNull();
			expect(bSigned).toBeNull();

			// Outsider B cannot attach audio to A's song
			const { data: bInsert, error: bInsertError } = await forgedInsert();
			expect(bInsertError !== null || (bInsert ?? []).length === 0).toBe(true);

			// Link the song into band A and make B a member: listening follows
			const { error: linkError } = await adminClient
				.from('band_songs')
				.insert({ band_id: bandA.id, song_id: songA.id, added_by: userA.id });
			if (linkError) throw new Error(`Setup band_songs failed: ${linkError.message}`);
			const { error: memberError } = await adminClient
				.from('band_members')
				.insert({ band_id: bandA.id, user_id: userB.id, role: 'member' });
			if (memberError) throw new Error(`Setup band_members failed: ${memberError.message}`);

			const { data: memberRows } = await userB.client
				.from('song_audio')
				.select('id')
				.eq('song_id', songA.id);
			expect(memberRows ?? []).toHaveLength(1);

			const { data: memberSigned, error: memberSignError } = await userB.client.storage
				.from('song-audio')
				.createSignedUrl(storagePath, 60);
			expect(memberSignError).toBeNull();
			expect(memberSigned?.signedUrl).toBeTruthy();

			// Membership grants listening, not uploading — insert stays owner-only
			const { data: mInsert, error: mInsertError } = await forgedInsert();
			expect(mInsertError !== null || (mInsert ?? []).length === 0).toBe(true);

			// Sanity: the owner can sign their own path
			const { data: ownerSigned, error: ownerSignError } = await userA.client.storage
				.from('song-audio')
				.createSignedUrl(storagePath, 60);
			expect(ownerSignError).toBeNull();
			expect(ownerSigned?.signedUrl).toBeTruthy();
		} finally {
			await adminClient
				.from('band_members')
				.delete()
				.eq('band_id', bandA.id)
				.eq('user_id', userB.id);
			await adminClient.from('band_songs').delete().eq('band_id', bandA.id).eq('song_id', songA.id);
			if (audioRow) await safeDelete('song_audio', audioRow.id);
			try {
				await adminClient.storage.from('song-audio').remove([storagePath]);
			} catch (e) {
				console.warn('Cleanup warning [song-audio storage]:', e);
			}
		}
	});

	test('song_files visibility and storage signing follow song visibility (RLS-API-09)', async () => {
		const storagePath = `songs/${songA.id}/${crypto.randomUUID()}.pdf`;
		const fileBuffer = fs.readFileSync(path.resolve('tests/fixtures/sample.pdf'));

		// Admin: chart object + metadata row attached to A's song
		const { error: uploadError } = await adminClient.storage
			.from('song-files')
			.upload(storagePath, fileBuffer, { contentType: 'application/pdf' });
		if (uploadError) throw new Error(`Setup song-files upload failed: ${uploadError.message}`);

		const { data: fileRow, error: fileError } = await adminClient
			.from('song_files')
			.insert({
				song_id: songA.id,
				label: 'RLS API Chart',
				storage_path: storagePath,
				file_name: 'sample.pdf',
				mime_type: 'application/pdf',
				file_size_bytes: fileBuffer.length
			})
			.select()
			.single();
		if (fileError) throw new Error(`Setup song_files failed: ${fileError.message}`);

		const forgedInsert = () =>
			userB.client
				.from('song_files')
				.insert({
					song_id: songA.id,
					storage_path: `songs/${songA.id}/${crypto.randomUUID()}.pdf`,
					file_name: 'forged.pdf',
					mime_type: 'application/pdf',
					file_size_bytes: 10
				})
				.select();

		try {
			// Outsider B: no metadata rows, no signed URL
			const { data: bRows, error: bSelectError } = await userB.client
				.from('song_files')
				.select('*')
				.eq('song_id', songA.id);
			expect(bSelectError).toBeNull();
			expect(bRows ?? []).toHaveLength(0);

			const { data: bSigned, error: bSignError } = await userB.client.storage
				.from('song-files')
				.createSignedUrl(storagePath, 60);
			expect(bSignError).not.toBeNull();
			expect(bSigned).toBeNull();

			// Outsider B cannot attach a chart to A's song
			const { data: bInsert, error: bInsertError } = await forgedInsert();
			expect(bInsertError !== null || (bInsert ?? []).length === 0).toBe(true);

			// Link the song into band A and make B a member: reading follows
			const { error: linkError } = await adminClient
				.from('band_songs')
				.insert({ band_id: bandA.id, song_id: songA.id, added_by: userA.id });
			if (linkError) throw new Error(`Setup band_songs failed: ${linkError.message}`);
			const { error: memberError } = await adminClient
				.from('band_members')
				.insert({ band_id: bandA.id, user_id: userB.id, role: 'member' });
			if (memberError) throw new Error(`Setup band_members failed: ${memberError.message}`);

			const { data: memberRows } = await userB.client
				.from('song_files')
				.select('id')
				.eq('song_id', songA.id);
			expect(memberRows ?? []).toHaveLength(1);

			const { data: memberSigned, error: memberSignError } = await userB.client.storage
				.from('song-files')
				.createSignedUrl(storagePath, 60);
			expect(memberSignError).toBeNull();
			expect(memberSigned?.signedUrl).toBeTruthy();

			// Membership grants reading, not uploading — insert stays owner-only
			const { data: mInsert, error: mInsertError } = await forgedInsert();
			expect(mInsertError !== null || (mInsert ?? []).length === 0).toBe(true);

			// Sanity: the owner can sign their own path
			const { data: ownerSigned, error: ownerSignError } = await userA.client.storage
				.from('song-files')
				.createSignedUrl(storagePath, 60);
			expect(ownerSignError).toBeNull();
			expect(ownerSigned?.signedUrl).toBeTruthy();
		} finally {
			await adminClient
				.from('band_members')
				.delete()
				.eq('band_id', bandA.id)
				.eq('user_id', userB.id);
			await adminClient.from('band_songs').delete().eq('band_id', bandA.id).eq('song_id', songA.id);
			if (fileRow) await safeDelete('song_files', fileRow.id);
			try {
				await adminClient.storage.from('song-files').remove([storagePath]);
			} catch (e) {
				console.warn('Cleanup warning [song-files storage]:', e);
			}
		}
	});
});
