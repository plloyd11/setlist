/**
 * Practice data is private to the musician, even for band songs. These talk to
 * Supabase directly with publishable-key clients, so they test the database's own
 * rules rather than what the UI happens to show.
 */
import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { createTestUser, deleteTestUser } from './helpers/auth';
import { adminClient } from './helpers/supabase-admin';

const url = process.env.PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

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

const TABLES = [
	'skills',
	'skill_tempo_logs',
	'exercises',
	'exercise_audio',
	'exercise_files',
	'song_practice',
	'practice_sessions',
	'practice_session_items'
];

test.describe.serial('Practice data is private', () => {
	let owner: Awaited<ReturnType<typeof signedIn>>;
	let bandmate: Awaited<ReturnType<typeof signedIn>>;
	let stranger: Awaited<ReturnType<typeof signedIn>>;
	let bandId: string;
	let bandSongId: string;
	let ownerOnlySongId: string;
	let skillId: string;
	let exerciseId: string;
	let sessionId: string;
	const anon = makeClient();

	test.beforeAll(async () => {
		const base = Date.now();
		owner = await signedIn(base);
		bandmate = await signedIn(base + 1);
		stranger = await signedIn(base + 2);

		const { data: band } = await adminClient
			.from('bands')
			.insert({ name: 'Privacy Band', owner_id: owner.id })
			.select()
			.single();
		bandId = band!.id;
		await adminClient.from('band_members').insert([
			{ band_id: bandId, user_id: owner.id, role: 'owner' },
			{ band_id: bandId, user_id: bandmate.id, role: 'member' }
		]);

		const { data: songs } = await adminClient
			.from('songs')
			.insert([
				{ user_id: owner.id, title: 'Band Tune', duration_seconds: 100 },
				{ user_id: owner.id, title: 'Personal Tune', duration_seconds: 100 }
			])
			.select();
		bandSongId = songs!.find((s) => s.title === 'Band Tune')!.id;
		ownerOnlySongId = songs!.find((s) => s.title === 'Personal Tune')!.id;
		await adminClient
			.from('band_songs')
			.insert({ band_id: bandId, song_id: bandSongId, added_by: owner.id });
	});

	test.afterAll(async () => {
		await adminClient.from('bands').delete().eq('id', bandId);
		for (const user of [owner, bandmate, stranger]) await deleteTestUser(user.id);
	});

	test('the owner can write everything', async () => {
		const { data: skill, error: skillError } = await owner.client
			.from('skills')
			.insert({ title: 'Alternate picking', goal_bpm: 140 })
			.select()
			.single();
		expect(skillError).toBeNull();
		skillId = skill!.id;
		expect(skill!.user_id).toBe(owner.id);

		const { error: logError } = await owner.client
			.from('skill_tempo_logs')
			.insert({ skill_id: skillId, bpm: 96 });
		expect(logError).toBeNull();

		const { data: exercise, error: exerciseError } = await owner.client
			.from('exercises')
			.insert({ title: 'Chromatic run', skill_id: skillId, routine_position: 0 })
			.select()
			.single();
		expect(exerciseError).toBeNull();
		exerciseId = exercise!.id;

		const { error: fileError } = await owner.client.from('exercise_files').insert({
			exercise_id: exerciseId,
			storage_path: `exercises/${exerciseId}/${crypto.randomUUID()}.pdf`,
			file_name: 'run.pdf',
			mime_type: 'application/pdf',
			file_size_bytes: 10
		});
		expect(fileError).toBeNull();

		const { error: statusError } = await owner.client
			.from('song_practice')
			.insert({ song_id: bandSongId, status: 'needs_work', note: 'Bridge is shaky' });
		expect(statusError).toBeNull();

		const { data: session, error: sessionError } = await owner.client
			.from('practice_sessions')
			.insert({})
			.select()
			.single();
		expect(sessionError).toBeNull();
		sessionId = session!.id;

		const { error: itemError } = await owner.client.from('practice_session_items').insert({
			session_id: sessionId,
			kind: 'song',
			song_id: bandSongId,
			label: 'Band Tune',
			practice_seconds: 300
		});
		expect(itemError).toBeNull();
	});

	test('a stranger and a bandmate see none of it, even on a shared band song', async () => {
		for (const viewer of [stranger, bandmate]) {
			for (const table of TABLES) {
				const { data, error } = await viewer.client.from(table).select('*');
				expect(error, table).toBeNull();
				expect(data, table).toEqual([]);
			}
		}
	});

	test('someone signed out has no access at all', async () => {
		for (const table of TABLES) {
			const { data, error } = await anon.from(table).select('*');
			expect(error, `${table} should refuse anon`).not.toBeNull();
			expect(data).toBeNull();
		}
	});

	test('nobody else can change or delete it', async () => {
		const { data: updated } = await stranger.client
			.from('skills')
			.update({ title: 'Hacked' })
			.eq('id', skillId)
			.select();
		expect(updated).toEqual([]);

		const { data: deleted } = await bandmate.client
			.from('exercises')
			.delete()
			.eq('id', exerciseId)
			.select();
		expect(deleted).toEqual([]);

		const { data: skill } = await adminClient
			.from('skills')
			.select('title')
			.eq('id', skillId)
			.single();
		expect(skill!.title).toBe('Alternate picking');
	});

	test('nobody can write into someone else’s data', async () => {
		const attempts = [
			stranger.client.from('skills').insert({ title: 'Forged', user_id: owner.id }),
			stranger.client.from('skill_tempo_logs').insert({ skill_id: skillId, bpm: 200 }),
			stranger.client.from('exercises').insert({ title: 'Forged', user_id: owner.id }),
			stranger.client.from('exercises').insert({ title: 'Forged', skill_id: skillId }),
			stranger.client.from('exercise_files').insert({
				exercise_id: exerciseId,
				storage_path: `exercises/${exerciseId}/forged.pdf`,
				file_name: 'forged.pdf',
				mime_type: 'application/pdf',
				file_size_bytes: 10
			}),
			stranger.client.from('practice_sessions').insert({ user_id: owner.id }),
			stranger.client.from('practice_session_items').insert({
				session_id: sessionId,
				kind: 'song',
				label: 'Forged',
				practice_seconds: 1
			})
		];
		for (const attempt of attempts) {
			const { error } = await attempt;
			expect(error).not.toBeNull();
		}
	});

	test('song status works on songs you can see, and only those', async () => {
		// A bandmate can track a band-linked song, separately from the owner
		const { error: mine } = await bandmate.client
			.from('song_practice')
			.insert({ song_id: bandSongId, status: 'learning' });
		expect(mine).toBeNull();

		// But not a song that isn't shared with them
		const { error: hidden } = await bandmate.client
			.from('song_practice')
			.insert({ song_id: ownerOnlySongId, status: 'learning' });
		expect(hidden).not.toBeNull();

		// History can't reference a song, exercise or skill you can't see either
		const { data: session } = await stranger.client
			.from('practice_sessions')
			.insert({})
			.select()
			.single();
		for (const reference of [
			{ kind: 'song', song_id: bandSongId },
			{ kind: 'exercise', exercise_id: exerciseId },
			{ kind: 'skill', skill_id: skillId }
		]) {
			const { error } = await stranger.client
				.from('practice_session_items')
				.insert({ session_id: session!.id, label: 'Forged', ...reference });
			expect(error, reference.kind).not.toBeNull();
		}
	});

	test('exercise uploads are private too, and HTML is refused', async () => {
		const pdf = Buffer.from('%PDF-1.4 test');
		const mine = `exercises/${exerciseId}/${crypto.randomUUID()}.pdf`;
		const bucket = (client: SupabaseClient) => client.storage.from('exercise-files');

		const { error: upload } = await bucket(owner.client).upload(mine, pdf, {
			contentType: 'application/pdf'
		});
		expect(upload).toBeNull();

		const { error: forged } = await bucket(stranger.client).upload(
			`exercises/${exerciseId}/${crypto.randomUUID()}.pdf`,
			pdf,
			{ contentType: 'application/pdf' }
		);
		expect(forged).not.toBeNull();

		// Stored XSS guard: a signed URL must never serve HTML from this bucket
		const { error: html } = await bucket(owner.client).upload(
			`exercises/${exerciseId}/${crypto.randomUUID()}.html`,
			Buffer.from('<script>alert(1)</script>'),
			{ contentType: 'text/html' }
		);
		expect(html).not.toBeNull();

		for (const viewer of [stranger.client, bandmate.client, anon]) {
			const { data } = await bucket(viewer).createSignedUrl(mine, 60);
			expect(data?.signedUrl).toBeFalsy();
		}
		const { data: signed } = await bucket(owner.client).createSignedUrl(mine, 60);
		expect(signed?.signedUrl).toBeTruthy();

		await adminClient.storage.from('exercise-files').remove([mine]);
	});

	test('deleting a song keeps history, and deleting a user removes everything', async () => {
		const user = await signedIn(Date.now() + 3);
		const { data: song } = await adminClient
			.from('songs')
			.insert({ user_id: user.id, title: 'Soon Gone', duration_seconds: 60 })
			.select()
			.single();
		const { data: skill } = await user.client
			.from('skills')
			.insert({ title: 'Soon Gone Skill' })
			.select()
			.single();
		const { data: exercise } = await user.client
			.from('exercises')
			.insert({ title: 'Soon Gone Drill', skill_id: skill!.id })
			.select()
			.single();
		await user.client.from('song_practice').insert({ song_id: song!.id });
		const { data: session } = await user.client
			.from('practice_sessions')
			.insert({})
			.select()
			.single();
		await user.client.from('practice_session_items').insert({
			session_id: session!.id,
			kind: 'song',
			song_id: song!.id,
			label: 'Soon Gone',
			practice_seconds: 120
		});

		await adminClient.from('songs').delete().eq('id', song!.id);
		const { data: items } = await user.client.from('practice_session_items').select('*');
		expect(items).toHaveLength(1);
		expect(items![0].song_id).toBeNull();
		expect(items![0].label).toBe('Soon Gone');

		// A deleted skill leaves its exercise behind, just unattached
		await user.client.from('skills').delete().eq('id', skill!.id);
		const { data: kept } = await user.client
			.from('exercises')
			.select('skill_id')
			.eq('id', exercise!.id)
			.single();
		expect(kept!.skill_id).toBeNull();

		const { error } = await adminClient.auth.admin.deleteUser(user.id);
		expect(error).toBeNull();
		for (const [table, id] of [
			['exercises', exercise!.id],
			['practice_sessions', session!.id],
			['practice_session_items', items![0].id]
		]) {
			const { data } = await adminClient.from(table).select('id').eq('id', id);
			expect(data, table).toEqual([]);
		}
	});
});
