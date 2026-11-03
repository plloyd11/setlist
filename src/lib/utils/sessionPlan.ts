import { browser } from '$app/env';

export const SESSION_LENGTHS = [15, 30, 45, 60, 90];
const DEFAULT_MINUTES = 30;
const STORAGE_KEY = 'practice:session-minutes';

/** Warming up is a slice of the session, and most of what's left goes to songs */
const WARM_UP_SHARE = 0.2;
const TECHNIQUE_SHARE_OF_REST = 0.375;
/** A song needs this long to get anywhere, so short sessions stick to one */
const SECONDS_PER_SONG = 15 * 60;
const MAX_SONGS = 3;
const TWO_TECHNIQUES_FROM_MINUTES = 60;
/** Don't suggest a warm-up cut down to less than this */
const SHORTEST_WARM_UP_SECONDS = 2 * 60;

export interface SessionItem {
	kind: 'warm-up' | 'technique' | 'song';
	key: string;
	href: string;
	label: string;
	/** Warm-ups have their own length. Other steps get theirs from the time you have. */
	seconds: number | null;
	status: string | null;
	hasAudio: boolean;
	hasChart: boolean;
}

export type SessionStep = SessionItem & { seconds: number };

export interface SessionPools {
	/** The routine, in its order */
	warmUps: SessionItem[];
	/** Longest since you practiced them first */
	techniques: SessionItem[];
	/** Songs you've flagged first, then the next gig's */
	songs: SessionItem[];
}

const toWholeMinutes = (seconds: number) => Math.max(60, Math.round(seconds / 60) * 60);

/** Split time evenly, in whole minutes, without losing any to rounding */
function share(items: SessionItem[], seconds: number): SessionStep[] {
	let left = toWholeMinutes(seconds);
	return items.map((item, i) => {
		const each = i === items.length - 1 ? left : toWholeMinutes(left / (items.length - i));
		left -= each;
		return { ...item, seconds: each };
	});
}

/**
 * Warm up, then technique, then songs, fitted to the time you have. The routine runs
 * in order until its slice is used, and whatever it doesn't use goes to the rest. If
 * there aren't enough things to fill the time this comes up short rather than padding:
 * nobody needs a 40 minute chromatic exercise.
 */
export function buildSession(pools: SessionPools, minutes: number): SessionStep[] {
	const total = minutes * 60;
	const hasMoreToDo = pools.techniques.length > 0 || pools.songs.length > 0;
	const warmUpBudget = hasMoreToDo ? total * WARM_UP_SHARE : total;

	const warmUps: SessionStep[] = [];
	let warmUpSeconds = 0;
	for (const item of pools.warmUps) {
		const length = item.seconds ?? SHORTEST_WARM_UP_SECONDS;
		const left = warmUpBudget - warmUpSeconds;
		if (length <= left) {
			warmUps.push({ ...item, seconds: length });
			warmUpSeconds += length;
		} else if (warmUps.length === 0 && left >= SHORTEST_WARM_UP_SECONDS) {
			// The first one is too long for this session, but don't skip warming up
			warmUps.push({ ...item, seconds: toWholeMinutes(left) });
			warmUpSeconds = left;
			break;
		} else {
			break;
		}
	}

	const rest = Math.max(total - warmUpSeconds, 0);
	const hasSongs = pools.songs.length > 0;
	// Whole minutes here, so songs get exactly what's left and the total adds up
	const techniqueSeconds = hasSongs ? toWholeMinutes(rest * TECHNIQUE_SHARE_OF_REST) : rest;
	const techniqueCount = minutes >= TWO_TECHNIQUES_FROM_MINUTES ? 2 : 1;
	const techniques = pools.techniques.slice(0, techniqueCount);
	const songSeconds = techniques.length > 0 ? rest - techniqueSeconds : rest;
	const songCount = Math.min(
		Math.max(Math.round(songSeconds / SECONDS_PER_SONG), 1),
		MAX_SONGS,
		pools.songs.length
	);

	return [
		...warmUps,
		...share(techniques, techniqueSeconds),
		...share(pools.songs.slice(0, songCount), songSeconds)
	];
}

export function loadSessionMinutes(): number {
	if (!browser) return DEFAULT_MINUTES;
	try {
		const saved = Number(localStorage.getItem(STORAGE_KEY));
		return SESSION_LENGTHS.includes(saved) ? saved : DEFAULT_MINUTES;
	} catch {
		return DEFAULT_MINUTES;
	}
}

export function saveSessionMinutes(minutes: number) {
	try {
		localStorage.setItem(STORAGE_KEY, String(minutes));
	} catch {
		// Blocked storage just means asking again next time
	}
}
