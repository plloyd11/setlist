import type { PageServerLoad } from './$types';
import type { Setlist } from '$lib/types/database';

// gig_date is a date-only string; parse as local midnight so countdown
// math doesn't drift across timezones
function parseGigDate(d: string): Date {
	const [y, m, day] = d.split('-').map(Number);
	return new Date(y, m - 1, day);
}

interface DashboardTrack {
	id: string;
	band_id: string;
	title: string;
	description: string | null;
	updated_at: string;
	versionCount: number;
	latestVersion: {
		version_number: number;
		duration_seconds: number | null;
		created_at: string;
	} | null;
	uploaderProfile: { id: string; display_name: string | null; logo_url: string | null } | null;
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
			bands: [] as Array<{ id: string; name: string }>,
			tracks: [] as DashboardTrack[]
		};
	}

	// RLS scopes these to the user's own rows plus band rows they can access,
	// so the board covers personal and band gigs alike
	const [songsRes, setlistsRes, bandsRes, tracksRes] = await Promise.all([
		supabase.from('songs').select('duration_seconds').eq('user_id', session.user.id),
		supabase.from('setlists').select('*').order('updated_at', { ascending: false }),
		supabase.from('bands').select('id, name').order('name'),
		// RLS scopes tracks to bands the user belongs to — no explicit band filter needed
		supabase
			.from('tracks')
			.select(
				'id, band_id, title, description, updated_at, track_versions(version_number, duration_seconds, uploaded_by, created_at)'
			)
			.order('updated_at', { ascending: false })
			.limit(6)
	]);

	const songs = songsRes.data ?? [];
	const setlists = (setlistsRes.data ?? []) as Setlist[];
	const bands = bandsRes.data ?? [];

	const trackRows = (tracksRes.data ?? []).map((t) => {
		const versions = [...(t.track_versions ?? [])].sort(
			(a, b) => b.version_number - a.version_number
		);
		const latest = versions[0] ?? null;
		return {
			id: t.id,
			band_id: t.band_id,
			title: t.title,
			description: t.description,
			updated_at: t.updated_at,
			versionCount: versions.length,
			latestVersion: latest
		};
	});

	// Hero: nearest upcoming gig, else the most recently updated setlist
	const todayStart = new Date();
	todayStart.setHours(0, 0, 0, 0);
	const upcoming = setlists
		.filter((s) => s.gig_date && parseGigDate(s.gig_date) >= todayStart)
		.sort((a, b) => parseGigDate(a.gig_date!).getTime() - parseGigDate(b.gig_date!).getTime());
	const hero = upcoming[0] ?? setlists[0] ?? null;
	const recent = setlists.filter((s) => s.id !== hero?.id).slice(0, 4);

	// Profiles can't be embedded (FKs point at auth.users) — two-step fetch
	const uploaderIds = [
		...new Set(
			trackRows.map((t) => t.latestVersion?.uploaded_by).filter((id): id is string => !!id)
		)
	];

	// One query covers song counts + durations for every displayed setlist
	const ids = [hero, ...recent].filter((s): s is Setlist => !!s).map((s) => s.id);
	const [setlistSongsRes, profilesRes] = await Promise.all([
		ids.length > 0
			? supabase
					.from('setlist_songs')
					.select('setlist_id, gap_seconds, songs(duration_seconds)')
					.in('setlist_id', ids)
			: Promise.resolve({ data: [] }),
		uploaderIds.length > 0
			? supabase.from('profiles').select('id, display_name, logo_url').in('id', uploaderIds)
			: Promise.resolve({ data: [] })
	]);

	const totals = new Map<string, { count: number; seconds: number }>();
	{
		const rows = setlistSongsRes.data;
		for (const row of rows ?? []) {
			const t = totals.get(row.setlist_id) ?? { count: 0, seconds: 0 };
			const song = row.songs as unknown as { duration_seconds: number } | null;
			if (song) {
				// Gap rows have no song: they add time but don't count as songs
				t.count += 1;
				t.seconds += song.duration_seconds;
			} else if (row.gap_seconds) {
				t.seconds += row.gap_seconds;
			}
			totals.set(row.setlist_id, t);
		}
	}

	// Same arithmetic as the TimingBar: song time + inter-song transitions
	const withTotals = (s: Setlist) => {
		const t = totals.get(s.id) ?? { count: 0, seconds: 0 };
		const transitions = t.count > 1 ? (t.count - 1) * s.transition_seconds : 0;
		return { ...s, songCount: t.count, totalSeconds: t.seconds + transitions };
	};

	const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
	const tracks: DashboardTrack[] = trackRows.map((t) => ({
		...t,
		uploaderProfile: t.latestVersion?.uploaded_by
			? (profileMap.get(t.latestVersion.uploaded_by) ?? null)
			: null
	}));

	return {
		songCount: songs.length,
		librarySeconds: songs.reduce((sum, s) => sum + (s.duration_seconds ?? 0), 0),
		hero: hero ? withTotals(hero) : null,
		heroIsUpcoming: !!upcoming[0],
		recent: recent.map(withTotals),
		bands,
		tracks
	};
};
