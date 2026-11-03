import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
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
			.select('id, title, duration_seconds, notes')
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

	return {
		song,
		variants: audio.map((v) => ({ ...v, signedUrl: audioUrls.get(v.storage_path) ?? null })),
		charts: files.map((f) => ({ ...f, signedUrl: fileUrls.get(f.storage_path) ?? null })),
		backHref
	};
};
