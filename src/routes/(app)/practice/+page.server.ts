import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** How long Today assumes for steps with no set length */
const TECHNIQUE_MINUTES = 10;
const SONG_MINUTES = 10;
const SONGS_PER_SESSION = 3;

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) throw error(401, 'Not authenticated');

	// Local date, matching how gig dates are entered. RLS returns the caller's own
	// setlists plus their bands'.
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

	const [
		{ data: gigs, error: gigError },
		{ data: routine },
		{ data: skills },
		{ data: statuses },
		{ data: recentSkillWork }
	] = await Promise.all([
		supabase
			.from('setlists')
			.select('id, name, gig_date, venue, bands(name)')
			.gte('gig_date', today)
			.order('gig_date')
			.limit(1),
		supabase
			.from('exercises')
			.select('id, title, target_seconds')
			.not('routine_position', 'is', null)
			.order('routine_position'),
		supabase.from('skills').select('id, title').order('created_at', { ascending: true }),
		supabase
			.from('song_practice')
			.select('status, songs(id, title, duration_seconds, song_audio(count), song_files(count))')
			.neq('status', 'solid')
			.order('updated_at', { ascending: false }),
		supabase
			.from('practice_session_items')
			.select('skill_id, created_at')
			.not('skill_id', 'is', null)
			.order('created_at', { ascending: false })
			.limit(200)
	]);
	if (gigError) throw error(500, 'Could not load your session. Please try again.');

	const gig = gigs?.[0] ?? null;
	const { data: gigRows } = gig
		? await supabase
				.from('setlist_songs')
				.select('songs(id, title, duration_seconds, song_audio(count), song_files(count))')
				.eq('setlist_id', gig.id)
				.not('song_id', 'is', null)
				.order('position')
		: { data: [] };

	// supabase-js types the many-to-one joins as arrays; at runtime they're objects
	type SongRow = {
		id: string;
		title: string;
		duration_seconds: number;
		song_audio: { count: number }[];
		song_files: { count: number }[];
	};

	// Songs you've flagged come first, then the next gig's set. A song appearing twice
	// in a set only needs shedding once.
	const flagged = (statuses ?? [])
		.map((row) => ({ song: row.songs as unknown as SongRow | null, status: row.status as string }))
		.filter((row): row is { song: SongRow; status: string } => !!row.song)
		.sort((a, b) => (a.status === 'needs_work' ? 0 : 1) - (b.status === 'needs_work' ? 0 : 1));
	const songs = new Map<string, { song: SongRow; status: string | null }>();
	for (const row of flagged) songs.set(row.song.id, row);
	const gigSongIds = new Set<string>();
	for (const row of gigRows ?? []) {
		const song = row.songs as unknown as SongRow | null;
		if (!song) continue;
		gigSongIds.add(song.id);
		if (!songs.has(song.id)) songs.set(song.id, { song, status: null });
	}

	// The technique you've left longest. Never practiced counts as longest of all.
	const lastPracticed = new Map<string, string>();
	for (const item of recentSkillWork ?? []) {
		if (item.skill_id && !lastPracticed.has(item.skill_id)) {
			lastPracticed.set(item.skill_id, item.created_at);
		}
	}
	const technique =
		[...(skills ?? [])].sort((a, b) =>
			(lastPracticed.get(a.id) ?? '').localeCompare(lastPracticed.get(b.id) ?? '')
		)[0] ?? null;

	const steps = [
		...(routine ?? []).map((exercise) => ({
			kind: 'warm-up' as const,
			key: `exercise-${exercise.id}`,
			href: `/exercises/${exercise.id}?from=/practice`,
			label: exercise.title,
			seconds: exercise.target_seconds as number,
			status: null,
			hasAudio: false,
			hasChart: false
		})),
		...(technique
			? [
					{
						kind: 'technique' as const,
						key: `skill-${technique.id}`,
						href: `/practice/techniques/${technique.id}`,
						label: technique.title as string,
						seconds: TECHNIQUE_MINUTES * 60,
						status: null,
						hasAudio: false,
						hasChart: false
					}
				]
			: []),
		...[...songs.values()].slice(0, SONGS_PER_SESSION).map(({ song, status }) => ({
			kind: 'song' as const,
			key: `song-${song.id}`,
			href: `/songs/${song.id}/practice?from=/practice`,
			label: song.title,
			seconds: SONG_MINUTES * 60,
			status,
			hasAudio: (song.song_audio[0]?.count ?? 0) > 0,
			hasChart: (song.song_files[0]?.count ?? 0) > 0
		}))
	];

	return {
		steps,
		gig: gig
			? {
					id: gig.id,
					name: gig.name,
					date: gig.gig_date as string,
					venue: gig.venue as string | null,
					bandName: (gig.bands as unknown as { name: string } | null)?.name ?? null
				}
			: null
	};
};
