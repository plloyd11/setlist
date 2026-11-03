import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// No user filter: RLS returns the caller's own songs plus their bands' linked songs
	const [{ data: songs, error: songsError }, { data: setlists }, { data: rows }] =
		await Promise.all([
			supabase
				.from('songs')
				.select('id, title, duration_seconds, song_audio(count), song_files(count)')
				.order('title'),
			supabase.from('setlists').select('id, name').order('created_at', { ascending: false }),
			supabase.from('setlist_songs').select('setlist_id, song_id').not('song_id', 'is', null)
		]);
	if (songsError) {
		throw error(500, 'Could not load your songs. Please try again.');
	}

	const setlistIdsBySong: Record<string, string[]> = {};
	for (const row of rows ?? []) {
		if (row.song_id) (setlistIdsBySong[row.song_id] ??= []).push(row.setlist_id);
	}

	return {
		songs: (songs ?? []).map((s) => ({
			id: s.id,
			title: s.title,
			durationSeconds: s.duration_seconds,
			hasAudio: (s.song_audio[0]?.count ?? 0) > 0,
			hasChart: (s.song_files[0]?.count ?? 0) > 0,
			setlistIds: setlistIdsBySong[s.id] ?? []
		})),
		setlists: setlists ?? []
	};
};
