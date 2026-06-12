import { browser } from '$app/environment';

// Practice prefs are song-scoped like the variant choice: how you shed a song
// (volume, speed, the loop you're drilling) belongs to the song, not the mix.
// One key holds a per-song record so pruning can keep the store bounded.
const STORAGE_KEY = 'practice:prefs:v1';

export const SPEED_DETENTS = [0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1] as const;
export const PRE_ROLL_SECONDS = 2;
export const MAX_SECTIONS = 20;
const MAX_LABEL_LENGTH = 40;
const MAX_SONGS = 100;

export interface LoopRange {
	start: number;
	end: number;
}

export interface SavedSection extends LoopRange {
	id: string;
	label: string;
}

export interface PracticePrefs {
	/** 0..1 */
	volume: number;
	/** One of SPEED_DETENTS */
	speed: number;
	/** Last loop region — restored with the loop toggle OFF */
	loop: LoopRange | null;
	preRoll: boolean;
	sections: SavedSection[];
	updatedAt: number;
}

const DEFAULTS: PracticePrefs = {
	volume: 1,
	speed: 1,
	loop: null,
	preRoll: false,
	sections: [],
	updatedAt: 0
};

function clamp01(n: number): number {
	return Math.min(1, Math.max(0, n));
}

function snapToDetent(speed: number): number {
	let best: number = SPEED_DETENTS[SPEED_DETENTS.length - 1];
	for (const d of SPEED_DETENTS) {
		if (Math.abs(d - speed) < Math.abs(best - speed)) best = d;
	}
	return best;
}

function sanitizeRange(value: unknown): LoopRange | null {
	if (!value || typeof value !== 'object') return null;
	const { start, end } = value as Record<string, unknown>;
	if (typeof start !== 'number' || typeof end !== 'number') return null;
	if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
	if (start < 0 || end <= start) return null;
	return { start, end };
}

function sanitize(value: unknown): PracticePrefs {
	if (!value || typeof value !== 'object') return { ...DEFAULTS };
	const raw = value as Record<string, unknown>;
	const sections: SavedSection[] = [];
	if (Array.isArray(raw.sections)) {
		for (const s of raw.sections) {
			const range = sanitizeRange(s);
			const { id, label } = (s ?? {}) as Record<string, unknown>;
			if (!range || typeof id !== 'string' || typeof label !== 'string') continue;
			sections.push({ ...range, id, label: label.slice(0, MAX_LABEL_LENGTH) });
			if (sections.length >= MAX_SECTIONS) break;
		}
	}
	return {
		volume: typeof raw.volume === 'number' && Number.isFinite(raw.volume) ? clamp01(raw.volume) : 1,
		speed:
			typeof raw.speed === 'number' && Number.isFinite(raw.speed) ? snapToDetent(raw.speed) : 1,
		loop: sanitizeRange(raw.loop),
		preRoll: raw.preRoll === true,
		sections,
		updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0
	};
}

function loadAll(): Record<string, unknown> {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) {
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === 'object') return parsed;
		}
	} catch {
		// Corrupt/blocked storage just means no remembered prefs
	}
	return {};
}

export function loadPracticePrefs(songId: string): PracticePrefs {
	return sanitize(loadAll()[songId]);
}

export function savePracticePrefs(songId: string, prefs: PracticePrefs): void {
	if (!browser) return;
	try {
		const all = loadAll();
		all[songId] = prefs;
		const ids = Object.keys(all);
		if (ids.length > MAX_SONGS) {
			// Prune least-recently-updated songs so the store stays bounded
			ids
				.sort((a, b) => sanitize(all[a]).updatedAt - sanitize(all[b]).updatedAt)
				.slice(0, ids.length - MAX_SONGS)
				.forEach((id) => delete all[id]);
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
	} catch {
		// Quota/blocked storage — settings still apply for this session
	}
}
