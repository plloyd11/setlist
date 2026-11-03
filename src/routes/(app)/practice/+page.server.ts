import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// Local date, matching how gig dates are entered. RLS returns the caller's own
	// setlists plus their bands'.
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

	const { data: gigs, error: gigError } = await supabase
		.from('setlists')
		.select('id, name, gig_date, venue, bands(name)')
		.gte('gig_date', today)
		.order('gig_date')
		.limit(1);
	if (gigError) {
		throw error(500, 'Could not load your next gig. Please try again.');
	}

	const gig = gigs?.[0] ?? null;
	if (!gig) return { gig: null, songs: [] };

	const { data: rows } = await supabase
		.from('setlist_songs')
		.select('songs(id, title, duration_seconds, song_audio(count), song_files(count))')
		.eq('setlist_id', gig.id)
		.not('song_id', 'is', null)
		.order('position');

	// supabase-js types the many-to-one joins as arrays; at runtime they're objects
	type Row = {
		id: string;
		title: string;
		duration_seconds: number;
		song_audio: { count: number }[];
		song_files: { count: number }[];
	};
	const songs = new Map<string, Row>();
	for (const row of rows ?? []) {
		const song = row.songs as unknown as Row | null;
		// A song can appear twice in a set; you only need to shed it once
		if (song && !songs.has(song.id)) songs.set(song.id, song);
	}

	return {
		gig: {
			id: gig.id,
			name: gig.name,
			date: gig.gig_date as string,
			venue: gig.venue as string | null,
			bandName: (gig.bands as unknown as { name: string } | null)?.name ?? null
		},
		songs: [...songs.values()].map((s) => ({
			id: s.id,
			title: s.title,
			durationSeconds: s.duration_seconds,
			hasAudio: (s.song_audio[0]?.count ?? 0) > 0,
			hasChart: (s.song_files[0]?.count ?? 0) > 0
		}))
	};
};
