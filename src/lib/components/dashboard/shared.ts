import type { Setlist } from '#lib/types/database.js';
import type { SetlistStats } from '#lib/utils/setlistTiming.js';

/** Invalidated to re-run the dashboard's load, after sharing changes or the time zone is learned */
export const DASHBOARD_DATA = 'dashboard:data';

export type DashboardSet = Pick<
	Setlist,
	| 'id'
	| 'name'
	| 'gig_date'
	| 'venue'
	| 'target_seconds'
	| 'transition_seconds'
	| 'share_token'
	| 'band_id'
> &
	SetlistStats;

export function setlistHref(set: { id: string; band_id: string | null }): string {
	return set.band_id ? `/bands/${set.band_id}/setlists/${set.id}` : `/setlists/${set.id}`;
}

/** A line of details. En spaces, because Klima's word space runs a middot into its neighbours. */
export function joinDetails(parts: Array<string | null | undefined | false>): string {
	return parts.filter(Boolean).join('\u2002·\u2002');
}

export interface ShedSong {
	id: string;
	title: string;
	status: string | null;
}

export interface StatusCounts {
	solid: number;
	learning: number;
	needs_work: number;
	unmarked: number;
}

/** What to shed next: the next gig's songs when there is one, else whatever's flagged */
export interface GigPrep {
	/** Only for a gig: a song you've never marked still has to be played that night */
	counts: StatusCounts | null;
	songs: ShedSong[];
	moreSongs: number;
}

export interface DemoActivity {
	key: string;
	href: string;
	title: string;
	bandName: string | null;
	kind: 'version' | 'comment';
	/** "You", or the member's name */
	actor: string;
	at: string;
	versionNumber: number;
	body: string | null;
	timestampSeconds: number | null;
}

export interface BandSummary {
	id: string;
	name: string;
	memberCount: number;
	nextGigDate: string | null;
}
