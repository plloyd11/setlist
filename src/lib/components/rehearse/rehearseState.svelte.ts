import { browser } from '$app/env';
import type { SongAudio, SongFile } from '#lib/types/database.js';
import { isTransitionPair } from '#lib/utils/setlistTiming.js';
import { loadVariantChoices, saveVariantChoices } from '#lib/utils/variantChoice.js';

// Peaks are deliberately absent: they're heavy (~10KB/variant) and fetched
// lazily per-variant by the rehearse page, not shipped in the load payload.
export type RehearseVariant = Omit<SongAudio, 'waveform_peaks'> & { signedUrl: string | null };
export type RehearseChart = SongFile & { signedUrl: string | null };

export type RehearseItem =
	| {
			kind: 'song';
			key: string;
			songId: string | null;
			title: string;
			notes: string | null;
			durationSeconds: number;
			variants: RehearseVariant[];
			charts: RehearseChart[];
	  }
	| {
			kind: 'gap';
			key: string;
			label: string | null;
			seconds: number;
	  }
	| { kind: 'transition'; key: string; seconds: number };

export interface RehearseSourceRow {
	id: string;
	song_id: string | null;
	gap_seconds: number | null;
	gap_label: string | null;
	song: { id: string; title: string; duration_seconds: number; notes: string | null } | null;
	variants: RehearseVariant[];
	charts: RehearseChart[];
}

/**
 * Build the rehearse timeline from ordered setlist rows. Transitions are
 * synthesized only between consecutive song-song pairs: same rule as TimingBar
 * ("an explicit gap IS the break"), so the totals here agree with the builder's.
 */
export function buildRehearseItems(
	rows: RehearseSourceRow[],
	transitionSeconds: number
): RehearseItem[] {
	const items: RehearseItem[] = [];
	rows.forEach((row, i) => {
		if (i > 0 && transitionSeconds > 0 && isTransitionPair(rows[i - 1], row)) {
			items.push({ kind: 'transition', key: `transition-${row.id}`, seconds: transitionSeconds });
		}
		if (row.gap_seconds != null) {
			items.push({ kind: 'gap', key: row.id, label: row.gap_label, seconds: row.gap_seconds });
		} else {
			items.push({
				kind: 'song',
				key: row.id,
				// row.songs join can be null when the song is no longer visible via
				// RLS: keep the slot so the set timing survives, just without audio
				songId: row.song?.id ?? row.song_id,
				title: row.song?.title ?? 'Unavailable song',
				notes: row.song?.notes ?? null,
				durationSeconds: row.song?.duration_seconds ?? 0,
				variants: row.variants,
				charts: row.charts
			});
		}
	});
	return items;
}

/** Drop remembered mix choices that point at deleted variants (only judgeable for
 * songs in this set; other songs' entries are kept) and cap the map's size. */
function pruneVariantChoices(items: RehearseItem[]) {
	const choices = loadVariantChoices();
	const entries = Object.entries(choices);
	if (entries.length === 0) return;

	const variantsBySong = new Map<string, Set<string>>();
	for (const item of items) {
		if (item.kind === 'song' && item.songId) {
			variantsBySong.set(item.songId, new Set(item.variants.map((v) => v.id)));
		}
	}

	let kept = entries.filter(([songId, variantId]) => {
		const known = variantsBySong.get(songId);
		return known === undefined || known.has(variantId);
	});
	// Insertion order ≈ age; keep the most recent choices
	if (kept.length > 300) kept = kept.slice(kept.length - 300);

	if (kept.length !== entries.length) saveVariantChoices(Object.fromEntries(kept));
}

export type RehearseStatus = 'idle' | 'running' | 'paused' | 'finished';

/**
 * A solo practice session's logical state. The page owns the actual audio
 * (SongPracticePanel) and the wall-clock interval; this class owns the position in
 * the set and what should be happening at it:
 *
 * - song with audio    -> played by the panel; its events call setAudioPlaying()
 *                         and onAudioFinished()
 * - song without audio -> a stopwatch the musician starts: they're playing it live
 * - gap/transition     -> countdown, only reached while running the set
 *
 * "Running" a song with audio is intent: the page autoplays when the player is
 * ready and downgrades to paused if the browser blocks it.
 */
export class RehearseState {
	readonly items: RehearseItem[] = [];

	index = $state(0);
	status = $state<RehearseStatus>('idle');
	/** On: tracks autoplay and advance, and breaks count down. Off: stay on one song. */
	runSet = $state(true);
	countdownRemaining = $state(0);
	stopwatchSeconds = $state(0);
	/** Real time spent playing, as opposed to the set's library durations */
	practicedSeconds = $state(0);
	/** The track reached its end with runSet off: offer Again or Next */
	trackEnded = $state(false);

	#lastTickMs: number | null = null;

	constructor(items: RehearseItem[]) {
		this.items = items;
		if (browser) pruneVariantChoices(items);
	}

	current = $derived(this.status === 'idle' ? null : (this.items[this.index] ?? null));

	totalSeconds = $derived(
		this.items.reduce(
			(sum, item) => sum + (item.kind === 'song' ? item.durationSeconds : item.seconds),
			0
		)
	);

	upNext = $derived.by(() => {
		for (let i = this.index + 1; i < this.items.length; i++) {
			const item = this.items[i];
			if (item.kind === 'song') return item.title;
			if (item.kind === 'gap' && this.runSet) return item.label ?? 'Break';
		}
		return null;
	});

	hasPrevious = $derived(this.#neighbor(-1) !== null);

	/** The next index in a direction: breaks only exist while running the set */
	#neighbor(direction: 1 | -1): number | null {
		let i = this.index + direction;
		while (i >= 0 && i < this.items.length) {
			if (this.runSet || this.items[i].kind === 'song') return i;
			i += direction;
		}
		return null;
	}

	start() {
		this.practicedSeconds = 0;
		const first = this.runSet ? 0 : this.items.findIndex((item) => item.kind === 'song');
		if (first < 0 || this.items.length === 0) {
			this.status = 'finished';
			return;
		}
		this.#enter(first);
	}

	next() {
		const i = this.#neighbor(1);
		if (i === null) {
			this.status = 'finished';
			return;
		}
		this.#enter(i);
	}

	previous() {
		const i = this.#neighbor(-1);
		if (i !== null) this.#enter(i);
	}

	goTo(index: number) {
		if (index >= 0 && index < this.items.length) this.#enter(index);
	}

	end() {
		this.status = 'finished';
	}

	/** Start/stop for what the page drives itself: breaks and the stopwatch. Songs
	 * with audio are paused through the player; its events call setAudioPlaying(). */
	togglePause() {
		if (this.status === 'running') {
			this.status = 'paused';
		} else if (this.status === 'paused') {
			this.status = 'running';
		}
	}

	/** Mirror of the real audio element's play/pause state */
	setAudioPlaying(playing: boolean) {
		const item = this.current;
		if (!item || item.kind !== 'song' || item.variants.length === 0) return;
		if (this.status !== 'running' && this.status !== 'paused') return;
		this.status = playing ? 'running' : 'paused';
		if (playing) this.trackEnded = false;
	}

	onAudioFinished() {
		if (this.current?.kind !== 'song') return;
		if (this.runSet) {
			this.next();
		} else {
			this.status = 'paused';
			this.trackEnded = true;
		}
	}

	/** Drive time. Call on an interval with Date.now(); deltas come from the clock,
	 * not tick counts, so throttled background tabs self-correct on wake. */
	tick(nowMs: number) {
		const dt = this.#lastTickMs === null ? 0 : (nowMs - this.#lastTickMs) / 1000;
		this.#lastTickMs = nowMs;
		const item = this.current;
		if (this.status !== 'running' || !item) return;
		if (item.kind === 'song') {
			this.practicedSeconds += dt;
			if (item.variants.length === 0) this.stopwatchSeconds += dt;
			return;
		}
		this.countdownRemaining = Math.max(this.countdownRemaining - dt, 0);
		if (this.countdownRemaining <= 0) this.next();
	}

	#enter(index: number) {
		this.index = index;
		this.stopwatchSeconds = 0;
		this.trackEnded = false;
		const item = this.items[index];
		if (item.kind === 'song') {
			this.countdownRemaining = 0;
			this.status = this.runSet && item.variants.length > 0 ? 'running' : 'paused';
		} else {
			this.countdownRemaining = item.seconds;
			this.status = 'running';
		}
	}
}
