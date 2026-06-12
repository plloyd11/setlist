import { browser } from '$app/environment';
import type { SongAudio } from '$lib/types/database';
import { isTransitionPair } from '$lib/utils/setlistTiming';
import { loadVariantChoices, saveVariantChoices } from '$lib/utils/variantChoice';

// Peaks are deliberately absent: they're heavy (~10KB/variant) and fetched
// lazily per-variant by the rehearse page, not shipped in the load payload.
export type RehearseVariant = Omit<SongAudio, 'waveform_peaks'> & { signedUrl: string | null };

export type RehearseItem =
	| {
			kind: 'song';
			key: string;
			songId: string | null;
			title: string;
			notes: string | null;
			durationSeconds: number;
			variants: RehearseVariant[];
	  }
	| { kind: 'gap'; key: string; label: string | null; seconds: number }
	| { kind: 'transition'; key: string; seconds: number };

export interface RehearseSourceRow {
	id: string;
	song_id: string | null;
	gap_seconds: number | null;
	gap_label: string | null;
	song: { id: string; title: string; duration_seconds: number; notes: string | null } | null;
	variants: RehearseVariant[];
}

/**
 * Build the rehearse timeline from ordered setlist rows. Transitions are
 * synthesized only between consecutive song-song pairs — same rule as
 * TimingBar ("an explicit gap IS the break"), so the totals here agree with
 * the builder's.
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
				// RLS — keep the slot so the set timing survives, just without audio
				songId: row.song?.id ?? row.song_id,
				title: row.song?.title ?? 'Unavailable song',
				notes: row.song?.notes ?? null,
				durationSeconds: row.song?.duration_seconds ?? 0,
				variants: row.variants
			});
		}
	});
	return items;
}

export type RehearseStatus = 'idle' | 'running' | 'paused' | 'waiting' | 'finished';

/**
 * The rehearse player's logical state. The page owns the actual audio
 * element (WaveformPlayer) and the wall-clock interval; this class owns the
 * timeline position and what should be happening at it:
 *
 * - song with playable audio  -> running/paused, advanced by onAudioFinished()
 * - song without audio        -> 'waiting' (pause-and-wait: the band plays it
 *                                live), advanced only by next()
 * - gap/transition            -> countdown driven by tick(now) on wall-clock
 *                                deltas (self-corrects after tab throttling)
 */
export class RehearseState {
	readonly items: RehearseItem[] = [];

	index = $state(0);
	status = $state<RehearseStatus>('idle');
	countdownRemaining = $state(0);
	songElapsed = $state(0);

	#variantChoice = $state<Record<string, string>>({});
	#lastTickMs: number | null = null;

	constructor(items: RehearseItem[]) {
		this.items = items;
		if (browser) {
			this.#variantChoice = loadVariantChoices();
			this.#pruneChoices();
		}
	}

	/** Drop remembered choices that point at deleted variants (only judgeable
	 * for songs present in this session — other songs' entries are kept) and
	 * cap the map so it can't grow forever. */
	#pruneChoices() {
		const entries = Object.entries(this.#variantChoice);
		if (entries.length === 0) return;

		const variantsBySong = new Map<string, Set<string>>();
		for (const item of this.items) {
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

		if (kept.length !== entries.length) {
			this.#variantChoice = Object.fromEntries(kept);
			this.#persistChoices();
		}
	}

	#persistChoices() {
		saveVariantChoices(this.#variantChoice);
	}

	current = $derived(this.status === 'idle' ? null : (this.items[this.index] ?? null));

	currentVariant = $derived.by(() => {
		const item = this.current;
		if (!item || item.kind !== 'song') return null;
		return this.variantFor(item);
	});

	totalSeconds = $derived(
		this.items.reduce(
			(sum, item) => sum + (item.kind === 'song' ? item.durationSeconds : item.seconds),
			0
		)
	);

	#elapsedBefore = $derived(
		this.items
			.slice(0, this.status === 'finished' ? this.items.length : this.index)
			.reduce((sum, item) => sum + (item.kind === 'song' ? item.durationSeconds : item.seconds), 0)
	);

	elapsedSeconds = $derived.by(() => {
		if (this.status === 'finished') return this.totalSeconds;
		const item = this.current;
		if (!item) return 0;
		// Nominal progress: clamp song audio time to the library duration so the
		// total never overshoots when the recording runs long
		const within =
			item.kind === 'song'
				? Math.min(this.songElapsed, item.durationSeconds)
				: Math.max(item.seconds - this.countdownRemaining, 0);
		return this.#elapsedBefore + within;
	});

	upNext = $derived.by(() => {
		for (let i = this.index + 1; i < this.items.length; i++) {
			const item = this.items[i];
			if (item.kind === 'song') return item.title;
			if (item.kind === 'gap') return item.label ?? 'Break';
		}
		return null;
	});

	/** The variant that should play for a song: remembered choice if it still
	 * exists and is playable, else the first playable one. Null = no audio. */
	variantFor(item: Extract<RehearseItem, { kind: 'song' }>): RehearseVariant | null {
		const playable = item.variants.filter((v) => v.signedUrl);
		if (playable.length === 0) return null;
		const remembered = item.songId ? this.#variantChoice[item.songId] : undefined;
		return playable.find((v) => v.id === remembered) ?? playable[0];
	}

	selectVariant(songId: string, variantId: string) {
		this.#variantChoice = { ...this.#variantChoice, [songId]: variantId };
		if (browser) this.#persistChoices();
	}

	start() {
		if (this.items.length === 0) return;
		this.#enter(0);
	}

	next() {
		if (this.index + 1 >= this.items.length) {
			this.status = 'finished';
			return;
		}
		this.#enter(this.index + 1);
	}

	prev() {
		this.#enter(Math.max(0, this.index - 1));
	}

	/** Pause/resume the countdown for gap/transition items. Song items are
	 * paused through the audio player; its events call setAudioPlaying(). */
	togglePause() {
		const item = this.current;
		if (!item || item.kind === 'song') return;
		if (this.status === 'running') {
			this.status = 'paused';
		} else if (this.status === 'paused') {
			this.status = 'running';
		}
	}

	/** Mirror of the real audio element's play/pause state (covers both our
	 * own controls and the player's built-in transport). */
	setAudioPlaying(playing: boolean) {
		const item = this.current;
		if (!item || item.kind !== 'song') return;
		if (this.status !== 'running' && this.status !== 'paused') return;
		this.status = playing ? 'running' : 'paused';
	}

	onAudioFinished() {
		if (this.current?.kind === 'song') this.next();
	}

	/** Drive gap/transition countdowns. Call on an interval with Date.now();
	 * deltas come from the clock, not tick counts, so throttled background
	 * tabs self-correct on wake. */
	tick(nowMs: number) {
		const dt = this.#lastTickMs === null ? 0 : (nowMs - this.#lastTickMs) / 1000;
		this.#lastTickMs = nowMs;
		const item = this.current;
		if (this.status !== 'running' || !item || item.kind === 'song') return;
		this.countdownRemaining = Math.max(this.countdownRemaining - dt, 0);
		if (this.countdownRemaining <= 0) this.next();
	}

	#enter(index: number) {
		this.index = index;
		this.songElapsed = 0;
		const item = this.items[index];
		if (item.kind === 'song') {
			this.countdownRemaining = 0;
			// 'running' is intent — the page autoplays when the player is ready
			// and downgrades to 'paused' if the browser blocks it
			this.status = this.variantFor(item) ? 'running' : 'waiting';
		} else {
			this.countdownRemaining = item.seconds;
			this.status = 'running';
		}
	}
}
