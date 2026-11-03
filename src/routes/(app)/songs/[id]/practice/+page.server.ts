import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { SongAudio, SongFile } from '#lib/types/database.js';
import { safeInternalPath } from '#lib/utils/safeRedirect.js';
import { signAll } from '#lib/server/songMedia.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({
	params,
	url,
	locals: { supabase, safeGetSession }
}) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// A malformed id can't match anything — 404 before firing three queries
	// that would each choke on the uuid cast
	if (!UUID_RE.test(params.id)) {
		throw error(404, 'Song not found');
	}

	// No user_id filter: RLS authorizes the owner and band members (via
	// band_songs + user_band_ids()), so this one route serves entry from both
	// /songs and /bands/[id]/songs — same pattern as the rehearse page.
	const [
		{ data: song },
		{ data: audioRaw, error: audioError },
		{ data: filesRaw, error: filesError }
	] = await Promise.all([
		supabase
			.from('songs')
			.select('id, user_id, title, duration_seconds, notes')
			.eq('id', params.id)
			.single(),
		// Peaks ship inline — one song's variants are a few tens of KB, not
		// worth the rehearse page's lazy per-variant endpoint.
		supabase
			.from('song_audio')
			.select('*')
			.eq('song_id', params.id)
			.order('created_at', { ascending: true }),
		supabase
			.from('song_files')
			.select('*')
			.eq('song_id', params.id)
			.order('created_at', { ascending: true })
	]);

	if (!song) {
		throw error(404, 'Song not found');
	}

	// A failed query must not masquerade as "No rehearsal audio yet"
	if (audioError) {
		throw error(500, 'Could not load rehearsal audio. Please try again.');
	}
	if (filesError) {
		throw error(500, 'Could not load charts. Please try again.');
	}

	const audio = (audioRaw ?? []) as SongAudio[];
	const files = (filesRaw ?? []) as SongFile[];

	const [audioUrls, fileUrls] = await Promise.all([
		signAll(
			supabase,
			'song-audio',
			audio.map((v) => v.storage_path)
		),
		signAll(
			supabase,
			'song-files',
			files.map((f) => f.storage_path)
		)
	]);

	// Internal-path check so ?from= can't bounce users to another origin
	const backHref = safeInternalPath(url.searchParams.get('from'), '/songs');

	const [{ data: practice }, { count: bandLinks }] = await Promise.all([
		supabase
			.from('song_practice')
			.select('status, note')
			.eq('song_id', params.id)
			.eq('user_id', session.user.id)
			.maybeSingle(),
		supabase
			.from('band_songs')
			.select('song_id', { count: 'exact', head: true })
			.eq('song_id', params.id)
	]);

	return {
		song,
		variants: audio.map((v) => ({ ...v, signedUrl: audioUrls.get(v.storage_path) ?? null })),
		charts: files.map((f) => ({ ...f, signedUrl: fileUrls.get(f.storage_path) ?? null })),
		backHref,
		practice: practice ?? null,
		// A timed run changes this song for someone else too: the app warns first
		isShared: song.user_id !== session.user.id || (bandLinks ?? 0) > 0
	};
};

const STATUSES = new Set(['learning', 'needs_work', 'solid']);
const MAX_NOTE_LENGTH = 500;
const MAX_SONG_SECONDS = 86_400;

export const actions: Actions = {
	setStatus: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const status = (formData.get('status') as string) ?? '';
		const note = ((formData.get('note') as string) ?? '').trim().slice(0, MAX_NOTE_LENGTH);

		if (status === '') {
			const { error: deleteError } = await supabase
				.from('song_practice')
				.delete()
				.eq('song_id', params.id)
				.eq('user_id', session.user.id);
			if (deleteError) return fail(500, { error: 'Could not save status' });
			return { status: null };
		}
		if (!STATUSES.has(status)) return fail(400, { error: 'Invalid status' });

		// RLS only accepts songs the caller can see
		const { error: upsertError } = await supabase.from('song_practice').upsert(
			{
				user_id: session.user.id,
				song_id: params.id,
				status,
				note: note || null,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'user_id,song_id' }
		);
		if (upsertError) return fail(500, { error: 'Could not save status' });
		return { status };
	},

	applyLength: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const seconds = Number(formData.get('seconds'));
		const expected = Number(formData.get('expected'));
		if (
			!Number.isInteger(seconds) ||
			seconds <= 0 ||
			seconds > MAX_SONG_SECONDS ||
			!Number.isInteger(expected)
		) {
			return fail(400, { error: 'Invalid length' });
		}

		// songs has no updated_at, so compare against the length the musician saw: a
		// bandmate's edit in the meantime makes this match nothing rather than be overwritten.
		// RLS limits this to the owner and members of a band it's linked to.
		const { data: updated, error: updateError } = await supabase
			.from('songs')
			.update({ duration_seconds: seconds })
			.eq('id', params.id)
			.eq('duration_seconds', expected)
			.select('id');
		if (updateError) return fail(500, { error: 'Could not update the length' });
		if (!updated?.length) return fail(409, { error: 'The song changed in the meantime' });
		return { seconds };
	}
};
