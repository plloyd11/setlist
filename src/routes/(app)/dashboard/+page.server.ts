import type { PageServerLoad } from './$types';
import type { Setlist } from '$lib/types/database';

// gig_date is a date-only string; parse as local midnight so countdown
// math doesn't drift across timezones
function parseGigDate(d: string): Date {
	const [y, m, day] = d.split('-').map(Number);
	return new Date(y, m - 1, day);
}

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		return {
			songCount: 0,
			librarySeconds: 0,
			hero: null as (Setlist & { songCount: number; totalSeconds: number }) | null,
			heroIsUpcoming: false,
			recent: [] as Array<Setlist & { songCount: number; totalSeconds: number }>,
			bands: [] as Array<{ id: string; name: string }>
		};
	}

	// RLS scopes these to the user's own rows plus band rows they can access,
	// so the board covers personal and band gigs alike
	const [songsRes, setlistsRes, bandsRes] = await Promise.all([
		supabase.from('songs').select('duration_seconds').eq('user_id', session.user.id),
		supabase.from('setlists').select('*').order('updated_at', { ascending: false }),
		supabase.from('bands').select('id, name').order('name')
	]);

	const songs = songsRes.data ?? [];
	const setlists = (setlistsRes.data ?? []) as Setlist[];
	const bands = bandsRes.data ?? [];

	// Hero: nearest upcoming gig, else the most recently updated setlist
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);
	const upcoming = setlists
		.filter((s) => s.gig_date && parseGigDate(s.gig_date) >= todayStart)
		.sort((a, b) => parseGigDate(a.gig_date!).getTime() - parseGigDate(b.gig_date!).getTime());
	const hero = upcoming[0] ?? setlists[0] ?? null;
	const recent = setlists.filter((s) => s.id !== hero?.id).slice(0, 4);

	// One query covers song counts + durations for every displayed setlist
	const ids = [hero, ...recent].filter((s): s is Setlist => !!s).map((s) => s.id);
	const totals = new Map<string, { count: number; seconds: number }>();
	if (ids.length > 0) {
		const { data: rows } = await supabase
			.from('setlist_songs')
			.select('setlist_id, songs(duration_seconds)')
			.in('setlist_id', ids);
		for (const row of rows ?? []) {
			const t = totals.get(row.setlist_id) ?? { count: 0, seconds: 0 };
			t.count += 1;
			t.seconds += (row.songs as unknown as { duration_seconds: number })?.duration_seconds ?? 0;
			totals.set(row.setlist_id, t);
		}
	}

	// Same arithmetic as the TimingBar: song time + inter-song transitions
	const withTotals = (s: Setlist) => {
		const t = totals.get(s.id) ?? { count: 0, seconds: 0 };
		const transitions = t.count > 1 ? (t.count - 1) * s.transition_seconds : 0;
		return { ...s, songCount: t.count, totalSeconds: t.seconds + transitions };
	};

	return {
		songCount: songs.length,
		librarySeconds: songs.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0),
		hero: hero ? withTotals(hero) : null,
		heroIsUpcoming: !!upcoming[0],
		recent: recent.map(withTotals),
		bands
	};
};
