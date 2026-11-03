import { browser } from '$app/env';

export const MIN_BPM = 30;
export const MAX_BPM = 300;
export const BEAT_OPTIONS = [2, 3, 4, 5, 6, 7] as const;

const STORAGE_KEY = 'practice:metronome:v1';
const MAX_REMEMBERED_SONGS = 200;
/** Taps further apart than this start a new count */
const TAP_RESET_MS = 2000;
const MAX_TAPS = 6;

export interface MetronomeSettings {
	bpm: number;
	beatsPerBar: number;
	volume: number;
}

const DEFAULTS: MetronomeSettings = { bpm: 100, beatsPerBar: 4, volume: 0.8 };

export function clampBpm(bpm: number): number {
	return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));
}

/** Add a tap, forgetting older taps once the gap says this is a new count */
export function addTap(taps: number[], now: number): number[] {
	const last = taps[taps.length - 1];
	const kept = last !== undefined && now - last > TAP_RESET_MS ? [] : taps;
	return [...kept, now].slice(-MAX_TAPS);
}

/** The tempo implied by a run of taps, or null until there are two */
export function tempoFromTaps(taps: number[]): number | null {
	if (taps.length < 2) return null;
	const averageMs = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
	return averageMs > 0 ? clampBpm(60_000 / averageMs) : null;
}

/**
 * Clicks are scheduled ahead on the audio clock, not fired from timers: JavaScript
 * timers drift and stall under load, which a metronome can't afford. A short timer
 * just keeps the schedule topped up.
 */
export class MetronomeEngine {
	bpm = DEFAULTS.bpm;
	beatsPerBar = DEFAULTS.beatsPerBar;
	volume = DEFAULTS.volume;

	#context: AudioContext | null = null;
	#timer: ReturnType<typeof setInterval> | null = null;
	#nextClick = 0;
	#beat = 0;
	#pendingLamps = new Set<ReturnType<typeof setTimeout>>();
	#onBeat: (beat: number) => void;

	constructor(onBeat: (beat: number) => void) {
		this.#onBeat = onBeat;
	}

	/** Call from a tap or key press: browsers only start audio from a user gesture */
	start() {
		this.#context ??= new AudioContext();
		void this.#context.resume();
		this.#beat = 0;
		this.#nextClick = this.#context.currentTime + 0.05;
		this.#timer = setInterval(() => this.#topUp(), 25);
		this.#topUp();
	}

	stop() {
		if (this.#timer) clearInterval(this.#timer);
		this.#timer = null;
		for (const lamp of this.#pendingLamps) clearTimeout(lamp);
		this.#pendingLamps.clear();
	}

	destroy() {
		this.stop();
		void this.#context?.close();
		this.#context = null;
	}

	#topUp() {
		const context = this.#context;
		if (!context) return;
		// Hidden tabs only get a timer about once a second, so schedule further ahead
		const horizon = context.currentTime + (document.hidden ? 1.5 : 0.1);
		while (this.#nextClick < horizon) {
			this.#click(context, this.#nextClick, this.#beat === 0);
			const beat = this.#beat;
			const lamp = setTimeout(
				() => {
					this.#pendingLamps.delete(lamp);
					this.#onBeat(beat);
				},
				Math.max(0, (this.#nextClick - context.currentTime) * 1000)
			);
			this.#pendingLamps.add(lamp);
			this.#nextClick += 60 / this.bpm;
			this.#beat = (this.#beat + 1) % this.beatsPerBar;
		}
	}

	#click(context: AudioContext, time: number, accent: boolean) {
		const oscillator = context.createOscillator();
		const gain = context.createGain();
		oscillator.frequency.value = accent ? 1600 : 1000;
		const level = Math.max(0.0001, this.volume * (accent ? 1 : 0.7));
		gain.gain.setValueAtTime(level, time);
		gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
		oscillator.connect(gain).connect(context.destination);
		oscillator.start(time);
		oscillator.stop(time + 0.03);
	}
}

type Stored = {
	last?: Partial<MetronomeSettings>;
	songs?: Record<string, Partial<MetronomeSettings>>;
};

function readStore(): Stored {
	if (!browser) return {};
	try {
		const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		// Corrupt/blocked storage just means no remembered tempo
		return {};
	}
}

function sanitize(value: Partial<MetronomeSettings> | undefined): MetronomeSettings {
	const bpm = Number(value?.bpm);
	const beats = Number(value?.beatsPerBar);
	const volume = Number(value?.volume);
	return {
		bpm: Number.isFinite(bpm) ? clampBpm(bpm) : DEFAULTS.bpm,
		beatsPerBar: (BEAT_OPTIONS as readonly number[]).includes(beats) ? beats : DEFAULTS.beatsPerBar,
		volume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULTS.volume
	};
}

/** A song's own tempo if it has one, else whatever was used last */
export function loadMetronomeSettings(songId?: string): MetronomeSettings {
	const store = readStore();
	return sanitize((songId && store.songs?.[songId]) || store.last);
}

export function saveMetronomeSettings(settings: MetronomeSettings, songId?: string) {
	if (!browser) return;
	try {
		const store = readStore();
		store.last = settings;
		if (songId) {
			const songs = { ...store.songs };
			// Re-insert so key order tracks recency for the cap below
			delete songs[songId];
			songs[songId] = settings;
			const ids = Object.keys(songs);
			for (const id of ids.slice(0, Math.max(0, ids.length - MAX_REMEMBERED_SONGS))) {
				delete songs[id];
			}
			store.songs = songs;
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
	} catch {
		// Quota/blocked storage: the settings still apply for this session
	}
}
