import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// No user filter: RLS returns the caller's own songs plus their bands' linked songs
	const [
		{ data: songs, error: songsError },
		{ data: setlists },
		{ data: rows },
		{ data: statuses }
	] = await Promise.all([
		supabase
			.from('songs')
			.select('id, title, duration_seconds, song_audio(count), song_files(count)')
			.order('title'),
		supabase.from('setlists').select('id, name').order('created_at', { ascending: false }),
		supabase.from('setlist_songs').select('setlist_id, song_id').not('song_id', 'is', null),
		supabase.from('song_practice').select('song_id, status')
	]);
	if (songsError) {
		throw error(500, 'Could not load your songs. Please try again.');
	}

	const setlistIdsBySong: Record<string, string[]> = {};
	for (const row of rows ?? []) {
		if (row.song_id) (setlistIdsBySong[row.song_id] ??= []).push(row.setlist_id);
	}

	const statusBySong = new Map((statuses ?? []).map((row) => [row.song_id, row.status as string]));
	// What you're working on comes first; the query already sorted by title within each
	const rank = (status: string | undefined) =>
		status === 'needs_work' ? 0 : status === 'learning' ? 1 : 2;

	return {
		songs: [...(songs ?? [])]
			.sort((a, b) => rank(statusBySong.get(a.id)) - rank(statusBySong.get(b.id)))
			.map((s) => ({
				id: s.id,
				title: s.title,
				durationSeconds: s.duration_seconds,
				hasAudio: (s.song_audio[0]?.count ?? 0) > 0,
				hasChart: (s.song_files[0]?.count ?? 0) > 0,
				setlistIds: setlistIdsBySong[s.id] ?? [],
				status: statusBySong.get(s.id) ?? null
			})),
		setlists: setlists ?? []
	};
};
