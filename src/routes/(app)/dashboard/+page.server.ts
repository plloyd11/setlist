import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	DASHBOARD_DATA,
	type BandSummary,
	type DashboardSet,
	type DemoActivity,
	type GigPrep,
	type ShedSong,
	type StatusCounts
} from '#lib/components/dashboard/shared.js';
import { TIME_ZONE_COOKIE, isTimeZone, todayInZone } from '#lib/utils/gigDate.js';
import { loggedSeconds } from '#lib/utils/practiceTime.js';
import { memberName } from '#lib/utils/memberName.js';
import { summarizeSetlistRows } from '#lib/utils/setlistTiming.js';

const MAX_COMING_UP = 3;
const MAX_RECENT = 4;
const MAX_DEMOS = 5;
const MAX_SHED_SONGS = 3;

const SET_COLUMNS =
	'id, name, gig_date, venue, target_seconds, transition_seconds, share_token, band_id';

type SetRow = Omit<DashboardSet, 'songCount' | 'totalSeconds'>;

const STATUS_ORDER: Record<string, number> = { needs_work: 0, learning: 1 };
const shedOrder = (status: string | null) => STATUS_ORDER[status ?? ''] ?? 2;

function capShedList(songs: ShedSong[]): Pick<GigPrep, 'songs' | 'moreSongs'> {
	const sorted = [...songs].sort((a, b) => shedOrder(a.status) - shedOrder(b.status));
	return {
		songs: sorted.slice(0, MAX_SHED_SONGS),
		moreSongs: Math.max(0, sorted.length - MAX_SHED_SONGS)
	};
}

export const load: PageServerLoad = async ({
	cookies,
	depends,
	locals: { supabase, safeGetSession }
}) => {
	depends(DASHBOARD_DATA);

	const { session } = await safeGetSession();
	if (!session) throw redirect(303, '/auth');
	const userId = session.user.id;

	// Gig dates mean the day where the musician is, not where this server runs. The page
	// sends its zone on first load, so only that first load can be a day out.
	const zoneCookie = cookies.get(TIME_ZONE_COOKIE);
	const timeZone = isTimeZone(zoneCookie) ? zoneCookie : null;
	const today = todayInZone(timeZone);

	// RLS scopes these to the user's own rows plus band rows they can access, so the board
	// covers personal and band gigs alike. Practice rows are only ever the user's own.
	const [songsRes, setlistsRes, bandsRes, statusesRes, sessionsRes, tracksRes, commentsRes] =
		await Promise.all([
			supabase.from('songs').select('duration_seconds').eq('user_id', userId),
			supabase.from('setlists').select(SET_COLUMNS).order('updated_at', { ascending: false }),
			supabase.from('bands').select('id, name, band_members(count)').order('name'),
			supabase
				.from('song_practice')
				.select('status, songs(id, title)')
				.order('updated_at', { ascending: false }),
			// Eight days covers this week in any time zone; WeekStrip works out which days count
			supabase
				.from('practice_sessions')
				.select('started_at, practice_session_items(practice_seconds, run_seconds)')
				.gte('started_at', new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()),
			supabase
				.from('tracks')
				.select('id, band_id, title, track_versions(version_number, uploaded_by, created_at)')
				.order('updated_at', { ascending: false })
				.limit(MAX_DEMOS * 2),
			// Comments don't touch a track's updated_at, so they need their own look.
			// Resolved ones are settled, so they aren't news.
			supabase
				.from('track_comments')
				.select(
					'id, body, timestamp_seconds, author_id, created_at, track_versions!inner(version_number, tracks!inner(id, band_id, title))'
				)
				.is('resolved_at', null)
				.order('created_at', { ascending: false })
				.limit(MAX_DEMOS * 2)
		]);

	// An empty board here would tell a working band they've never built a set
	if (setlistsRes.error) throw error(500, 'Could not load your setlists. Please try again.');

	const songs = songsRes.data ?? [];
	const setlists = (setlistsRes.data ?? []) as SetRow[];
	const bandRows = bandsRes.data ?? [];
	const bandNames = new Map(bandRows.map((band) => [band.id, band.name]));

	// Gig dates sort as plain YYYY-MM-DD strings
	const upcoming = setlists
		.filter((set) => set.gig_date && set.gig_date >= today)
		.sort((a, b) => a.gig_date!.localeCompare(b.gig_date!));
	const upcomingIds = new Set(upcoming.map((set) => set.id));

	// Hero: the nearest gig, else the most recently updated set
	const hero = upcoming[0] ?? setlists[0] ?? null;
	const comingUp = upcoming.slice(1, MAX_COMING_UP + 1);
	const recent = setlists
		.filter((set) => set.id !== hero?.id && !upcomingIds.has(set.id))
		.slice(0, MAX_RECENT);

	// One query covers counts and durations for every displayed set, and the hero's songs
	const shown = [hero, ...comingUp, ...recent].filter((set): set is SetRow => !!set);
	const { data: setSongRows } = shown.length
		? await supabase
				.from('setlist_songs')
				.select('setlist_id, gap_seconds, songs(id, title, duration_seconds)')
				.in(
					'setlist_id',
					shown.map((set) => set.id)
				)
				.order('position')
		: { data: [] };

	const stats = summarizeSetlistRows(setSongRows ?? [], shown);
	const withTotals = (set: SetRow): DashboardSet => ({ ...set, ...stats[set.id] });

	// What's left to shed. supabase-js types many-to-one joins as arrays; at runtime they're objects
	const statusRows = (statusesRes.data ?? [])
		.map((row) => ({
			status: row.status as string,
			song: row.songs as unknown as { id: string; title: string } | null
		}))
		.filter((row): row is { status: string; song: { id: string; title: string } } => !!row.song);
	const statusBySong = new Map(statusRows.map((row) => [row.song.id, row.status]));

	let prep: GigPrep;
	if (upcoming[0]) {
		// A song played twice in a set only needs shedding once
		const gigSongs = new Map<string, ShedSong>();
		for (const row of setSongRows ?? []) {
			const song = row.songs as unknown as { id: string; title: string } | null;
			if (row.setlist_id !== upcoming[0].id || !song) continue;
			gigSongs.set(song.id, {
				id: song.id,
				title: song.title,
				status: statusBySong.get(song.id) ?? null
			});
		}
		const counts: StatusCounts = { solid: 0, learning: 0, needs_work: 0, unmarked: 0 };
		for (const { status } of gigSongs.values()) {
			if (status === 'solid' || status === 'learning' || status === 'needs_work') counts[status]++;
			else counts.unmarked++;
		}
		prep = {
			counts,
			...capShedList([...gigSongs.values()].filter((song) => song.status !== 'solid'))
		};
	} else {
		prep = {
			counts: null,
			...capShedList(
				statusRows
					.filter((row) => row.status !== 'solid')
					.map((row) => ({ id: row.song.id, title: row.song.title, status: row.status }))
			)
		};
	}

	// Demos: each track's newest event, whether that's an upload or a comment
	type Event = Omit<DemoActivity, 'actor'> & { trackId: string; actorId: string | null };
	const demoHref = (bandId: string, trackId: string) => `/bands/${bandId}/demos/${trackId}`;
	const events: Event[] = [];
	for (const track of tracksRes.data ?? []) {
		const latest = [...(track.track_versions ?? [])].sort(
			(a, b) => b.version_number - a.version_number
		)[0];
		if (!latest) continue;
		events.push({
			key: `version-${track.id}-${latest.version_number}`,
			trackId: track.id,
			href: demoHref(track.band_id, track.id),
			title: track.title,
			bandName: bandNames.get(track.band_id) ?? null,
			kind: 'version',
			actorId: latest.uploaded_by,
			at: latest.created_at,
			versionNumber: latest.version_number,
			body: null,
			timestampSeconds: null
		});
	}
	for (const comment of commentsRes.data ?? []) {
		const version = comment.track_versions as unknown as {
			version_number: number;
			tracks: { id: string; band_id: string; title: string };
		};
		events.push({
			key: `comment-${comment.id}`,
			trackId: version.tracks.id,
			href: demoHref(version.tracks.band_id, version.tracks.id),
			title: version.tracks.title,
			bandName: bandNames.get(version.tracks.band_id) ?? null,
			kind: 'comment',
			actorId: comment.author_id,
			at: comment.created_at,
			versionNumber: version.version_number,
			body: comment.body,
			timestampSeconds: comment.timestamp_seconds
		});
	}
	const seenTracks = new Set<string>();
	const newestEvents = events
		.sort((a, b) => b.at.localeCompare(a.at))
		.filter((event) => {
			if (seenTracks.has(event.trackId)) return false;
			seenTracks.add(event.trackId);
			return true;
		})
		.slice(0, MAX_DEMOS);

	// Profiles can't be embedded (FKs point at auth.users), so this is a second fetch
	const actorIds = [
		...new Set(newestEvents.map((event) => event.actorId).filter((id) => id && id !== userId))
	] as string[];
	const { data: profiles } = actorIds.length
		? await supabase.from('profiles').select('id, display_name').in('id', actorIds)
		: { data: [] };
	const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

	const demos: DemoActivity[] = newestEvents.map(({ trackId: _, actorId, ...event }) => ({
		...event,
		actor: actorId === userId ? 'You' : memberName(actorId ? profileMap.get(actorId) : null)
	}));

	const bands: BandSummary[] = bandRows.map((band) => ({
		id: band.id,
		name: band.name,
		memberCount: band.band_members?.[0]?.count ?? 0,
		nextGigDate: upcoming.find((set) => set.band_id === band.id)?.gig_date ?? null
	}));

	return {
		today,
		timeZone,
		hero: hero ? withTotals(hero) : null,
		heroIsUpcoming: !!upcoming[0],
		comingUp: comingUp.map(withTotals),
		recent: recent.map(withTotals),
		prep,
		week: (sessionsRes.data ?? []).map((row) => ({
			startedAt: row.started_at,
			seconds: loggedSeconds(row.practice_session_items)
		})),
		demos,
		bands,
		songCount: songs.length,
		librarySeconds: songs.reduce((sum, song) => sum + (song.duration_seconds ?? 0), 0)
	};
};
