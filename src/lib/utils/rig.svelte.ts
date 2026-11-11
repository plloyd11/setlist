import { browser } from '$app/env';
import type { NamNode } from 'neural-amp-modeler-wasm/engine';
import {
	deleteRigFile,
	getRigFileBytes,
	listRigFiles,
	looksLikeNamModel,
	MAX_IR_BYTES,
	MAX_MODEL_BYTES,
	renameRigFile,
	rigFileName,
	saveRigFile,
	updateRigFile,
	type RigFile,
	type RigFileKind,
	type RigFileSource
} from './rigStore.js';
import { AttackDetector } from './attackDetector.js';
import type { RigCloud } from './rigCloud.js';

/**
 * The rig: an audio interface's input played back into the same headphones as the
 * practice track. Either an amp through its load box, given a cab IR, or a guitar
 * plugged straight in, given a NAM amp model (and an IR, unless the model is a full
 * rig with the cab in it).
 *
 * One instance for the whole app, so monitoring carries on from one practice screen
 * to the next, and stops only when it's turned off. Nothing here touches the
 * database: settings are per browser in localStorage, files in IndexedDB (rigStore).
 *
 * Each mode keeps its own input, gains, filters and IR, because a load box's line out
 * and a guitar plugged straight in want very different settings.
 *
 * Chain: input channel → gain (metered) → amp model (NAM mode) → low cut → high cut
 *        → IR (or two, blended) → level → limiter (metered) → out
 *
 * Two IRs run side by side and are mixed, like two mics on one cab. The blend is a
 * straight crossfade, not an equal-power one: two IRs of a cab are mostly the same
 * sound, and those add up in level, so equal power would swell in the middle.
 *
 * Uploaded IRs also follow the account (rigCloud.ts): `sync` brings this browser's
 * copies and the account's into line. Everything else stays in this browser.
 *
 * A saved rig is one mode's whole setup under a name: loading it switches to that mode
 * and puts its settings there. The two modes still each keep their own.
 */

export type RigBuffer = 'smallest' | 'normal';
/** A real amp through its load box, or a guitar straight in through a NAM model */
export type RigMode = 'amp' | 'nam';

/** What each mode remembers on its own, so switching between them is one tap */
export interface RigSetup {
	/** 0 or 1: which of the interface's first two inputs */
	channel: number;
	inputDb: number;
	/** Output level, 0–1 */
	level: number;
	/** Hz; the minimum means off */
	lowCut: number;
	/** Hz; the maximum means off */
	highCut: number;
	irId: string | null;
	/** A second IR, blended with the first */
	irId2: string | null;
	/** How much of the mix is the second IR, 0–1. Only matters with both chosen. */
	irBlend: number;
}

/** The first IR or the second */
export type IrSlot = 0 | 1;
const IR_KEYS = ['irId', 'irId2'] as const;

/** What the IR library has to do with the account */
export type RigSyncState = 'off' | 'syncing' | 'synced' | 'failed';

export interface RigSettings {
	deviceId: string | null;
	buffer: RigBuffer;
	mode: RigMode;
	setups: Record<RigMode, RigSetup>;
	/** The NAM model, used in NAM mode */
	modelId: string | null;
}

/** One mode's whole setup, kept under a name */
export interface RigPreset {
	id: string;
	name: string;
	mode: RigMode;
	setup: RigSetup;
	/** The amp model, for a NAM rig; a real amp has none */
	modelId: string | null;
}

export const INPUT_DB = { min: -24, max: 12 } as const;
export const LOW_CUT = { min: 20, max: 250 } as const;
export const HIGH_CUT = { min: 2000, max: 20000 } as const;

export const PRESET_NAME_MAX = 60;
export const FILE_NAME_MAX = 120;
/** Plenty for one musician's sounds, and it keeps the list short enough to scan */
export const MAX_PRESETS = 24;

const STORAGE_KEY = 'practice:rig:v1';
const PRESETS_KEY = 'practice:rig:presets:v1';
/** The limiter only counts as working once it's taking off more than this */
const LIMITING_DB = -0.5;
/** How long after the last pick attack the rig still counts as being played */
const PLAYING_HOLD_MS = 5000;
/** NAM models report their loudness; this evens them out, as the NAM plugin does */
const MODEL_LOUDNESS_DB = -18;
/** A model's metadata isn't trusted to ask for more than this either way */
const MAX_LOUDNESS_TRIM_DB = 20;

const DEFAULT_SETUP: RigSetup = {
	channel: 0,
	inputDb: 0,
	// Low on purpose: a hot line out into a loud IR is a shock in headphones
	level: 0.3,
	lowCut: LOW_CUT.min,
	highCut: HIGH_CUT.max,
	irId: null,
	irId2: null,
	irBlend: 0.5
};

const DEFAULTS: RigSettings = {
	deviceId: null,
	buffer: 'smallest',
	mode: 'amp',
	setups: { amp: { ...DEFAULT_SETUP }, nam: { ...DEFAULT_SETUP } },
	modelId: null
};

// Chrome's call-audio processing wrecks guitar tone and adds latency: all of it off
const INPUT_CONSTRAINTS: MediaTrackConstraints = {
	echoCancellation: false,
	noiseSuppression: false,
	autoGainControl: false,
	channelCount: { ideal: 2 }
};

function bounded(value: unknown, fallback: number, min: number, max: number): number {
	const n = Number(value);
	return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function optionalId(value: unknown): string | null {
	return typeof value === 'string' && value ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
	return (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
}

function sanitizeSetup(value: unknown): RigSetup {
	const v = asRecord(value);
	return {
		channel: v.channel === 1 ? 1 : 0,
		inputDb: bounded(v.inputDb, DEFAULT_SETUP.inputDb, INPUT_DB.min, INPUT_DB.max),
		level: bounded(v.level, DEFAULT_SETUP.level, 0, 1),
		lowCut: bounded(v.lowCut, DEFAULT_SETUP.lowCut, LOW_CUT.min, LOW_CUT.max),
		highCut: bounded(v.highCut, DEFAULT_SETUP.highCut, HIGH_CUT.min, HIGH_CUT.max),
		irId: optionalId(v.irId),
		irId2: optionalId(v.irId2),
		irBlend: bounded(v.irBlend, DEFAULT_SETUP.irBlend, 0, 1)
	};
}

export function sanitizeRigSettings(value: unknown): RigSettings {
	const v = asRecord(value);
	const setups = asRecord(v.setups);
	return {
		deviceId: optionalId(v.deviceId),
		buffer: v.buffer === 'normal' ? 'normal' : 'smallest',
		mode: v.mode === 'nam' ? 'nam' : 'amp',
		setups: {
			// Before there were modes, the one setup was the real amp's
			amp: sanitizeSetup(v.setups ? setups.amp : v),
			nam: sanitizeSetup(setups.nam)
		},
		modelId: optionalId(v.modelId)
	};
}

function loadSettings(): RigSettings {
	try {
		return sanitizeRigSettings(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'));
	} catch {
		// Corrupt or blocked storage just means starting from the defaults
		return { ...DEFAULTS };
	}
}

export function sanitizeRigPresets(value: unknown): RigPreset[] {
	if (!Array.isArray(value)) return [];
	const presets: RigPreset[] = [];
	for (const item of value.slice(0, MAX_PRESETS)) {
		const v = asRecord(item);
		const name = typeof v.name === 'string' ? v.name.trim().slice(0, PRESET_NAME_MAX) : '';
		if (typeof v.id !== 'string' || !v.id || !name) continue;
		const mode: RigMode = v.mode === 'nam' ? 'nam' : 'amp';
		presets.push({
			id: v.id,
			name,
			mode,
			setup: sanitizeSetup(v.setup),
			modelId: mode === 'nam' ? optionalId(v.modelId) : null
		});
	}
	return presets;
}

function loadPresets(): RigPreset[] {
	try {
		return sanitizeRigPresets(JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]'));
	} catch {
		return [];
	}
}

function sameSetup(a: RigSetup, b: RigSetup): boolean {
	return (
		a.channel === b.channel &&
		a.inputDb === b.inputDb &&
		a.level === b.level &&
		a.lowCut === b.lowCut &&
		a.highCut === b.highCut &&
		a.irId === b.irId &&
		a.irId2 === b.irId2 &&
		// The blend only makes a difference once there are two IRs to blend
		(!(a.irId && a.irId2) || a.irBlend === b.irBlend)
	);
}

/** Each IR's share of the mix. One on its own is all of it, wherever the blend sits. */
export function irShares(blend: number, hasFirst: boolean, hasSecond: boolean): [number, number] {
	if (hasFirst && hasSecond) return [1 - blend, blend];
	return [hasFirst ? 1 : 0, hasSecond ? 1 : 0];
}

/** Peak of a block of samples, in dBFS */
function blockPeakDb(samples: Float32Array): number {
	let peak = 0;
	for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
	return peak > 0 ? 20 * Math.log10(peak) : -Infinity;
}

/** Fast up, slow down, like a real meter */
function meterFall(previous: number, db: number): number {
	const next = Number.isFinite(previous) ? Math.max(db, previous - 1.2) : db;
	// Silence settles at silence, rather than falling for ever
	return next < -120 ? -Infinity : next;
}

function dbToGain(db: number): number {
	return Math.pow(10, db / 20);
}

/** A built-in mic into built-in speakers howls the moment monitoring starts */
export function wouldFeedBack(inputLabel: string, outputLabel: string | null): boolean {
	return (
		/microphone/i.test(inputLabel) &&
		/built-?in|macbook/i.test(inputLabel) &&
		outputLabel !== null &&
		/speakers/i.test(outputLabel)
	);
}

export function loudnessTrimDb(modelLoudness: number): number {
	const trim = MODEL_LOUDNESS_DB - modelLoudness;
	return Math.min(MAX_LOUDNESS_TRIM_DB, Math.max(-MAX_LOUDNESS_TRIM_DB, trim));
}

/** NAM doesn't resample: a model runs at whatever rate the interface does */
export function sampleRateNote(modelRate: number, interfaceRate: number): string | null {
	if (modelRate <= 0 || Math.abs(modelRate - interfaceRate) < 1) return null;
	const khz = (hz: number) => `${Number((hz / 1000).toFixed(1))} kHz`;
	return `This model was made at ${khz(modelRate)} and your interface is running at ${khz(interfaceRate)}, so it won't sound quite right. Set the interface to ${khz(modelRate)} (Audio MIDI Setup on a Mac), then turn Monitor off and on.`;
}

function tooBig(label: string, kind: 'model' | 'ir'): string {
	return kind === 'model'
		? `${label} is over 10 MB, which is too big for a NAM model.`
		: `${label} is over 2 MB. Cab IRs are usually well under 1 MB.`;
}

function describe(e: unknown): string {
	if (e instanceof DOMException) {
		if (e.name === 'NotAllowedError') {
			return 'Input access is blocked for this site. Allow the microphone from the icon at the left of the address bar, then try again.';
		}
		if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') {
			return "That input isn't connected. Plug it in, or choose another.";
		}
		if (e.name === 'NotReadableError') {
			return 'Another app has that input. Close it and try again.';
		}
	}
	return "Couldn't start the rig. Try again.";
}

type Graph = {
	source: MediaStreamAudioSourceNode;
	splitter: ChannelSplitterNode;
	input: GainNode;
	analyser: AnalyserNode;
	samples: Float32Array<ArrayBuffer>;
	/** Created the first time a model is chosen, then reused for every model */
	ampNode: Promise<NamNode> | null;
	/** Evens out model loudness; unity when there's no model */
	ampOut: GainNode;
	lowCut: BiquadFilterNode;
	highCut: BiquadFilterNode;
	/** One per IR slot, made fresh for each IR */
	convolvers: [ConvolverNode | null, ConvolverNode | null];
	/** Each IR's share of the blend */
	irGains: [GainNode, GainNode];
	level: GainNode;
	limiter: DynamicsCompressorNode;
	/** What reaches the headphones, after the limiter */
	outAnalyser: AnalyserNode;
	outSamples: Float32Array<ArrayBuffer>;
};

function buildGraph(
	ctx: AudioContext,
	stream: MediaStream,
	channels: number,
	setup: RigSetup
): Graph {
	const source = ctx.createMediaStreamSource(stream);
	const splitter = ctx.createChannelSplitter(channels);
	const input = ctx.createGain();
	const analyser = ctx.createAnalyser();
	const ampOut = ctx.createGain();
	const lowCut = ctx.createBiquadFilter();
	const highCut = ctx.createBiquadFilter();
	const irGains: [GainNode, GainNode] = [ctx.createGain(), ctx.createGain()];
	const level = ctx.createGain();
	const limiter = ctx.createDynamicsCompressor();
	const outAnalyser = ctx.createAnalyser();

	input.gain.value = dbToGain(setup.inputDb);
	analyser.fftSize = 1024;
	outAnalyser.fftSize = 1024;
	lowCut.type = 'highpass';
	lowCut.frequency.value = setup.lowCut;
	highCut.type = 'lowpass';
	highCut.frequency.value = setup.highCut;
	level.gain.value = setup.level;
	// Ear safety, not tone: catches the spike when a loud IR meets a hot input
	limiter.threshold.value = -3;
	limiter.knee.value = 0;
	limiter.ratio.value = 20;
	limiter.attack.value = 0.001;
	limiter.release.value = 0.05;

	source.connect(splitter);
	input.connect(analyser);
	input.connect(ampOut);
	ampOut.connect(lowCut).connect(highCut);
	for (const gain of irGains) gain.connect(level);
	level.connect(limiter).connect(ctx.destination);
	limiter.connect(outAnalyser);

	return {
		source,
		splitter,
		input,
		analyser,
		samples: new Float32Array(analyser.fftSize),
		ampNode: null,
		ampOut,
		lowCut,
		highCut,
		convolvers: [null, null],
		irGains,
		level,
		limiter,
		outAnalyser,
		outSamples: new Float32Array(outAnalyser.fftSize)
	};
}

class Rig {
	/** False until the first panel mounts in the browser */
	ready = $state(false);
	supported = $state(false);
	devices = $state<{ id: string; label: string }[]>([]);
	settings = $state<RigSettings>({ ...DEFAULTS });
	models = $state<RigFile[]>([]);
	irs = $state<RigFile[]>([]);
	monitoring = $state(false);
	busy = $state(false);
	modelLoading = $state(false);
	/** Something worth knowing about the loaded model, like a sample-rate mismatch */
	modelNote = $state<string | null>(null);
	error = $state<string | null>(null);
	channelCount = $state(2);
	peakDb = $state(-Infinity);
	/** Peak level going out to the headphones */
	outDb = $state(-Infinity);
	/** The safety limiter is turning the output down right now */
	limiting = $state(false);
	latencyMs = $state<number | null>(null);
	/** The rate the interface is running at, while the rig is on */
	sampleRate = $state<number | null>(null);
	presets = $state<RigPreset[]>([]);
	/** Where the IR library stands with the account: 'off' when nobody's signed in */
	syncState = $state<RigSyncState>('off');
	/** Rig panels on screen. With none, the app shell shows a way to turn the rig off. */
	panels = $state(0);

	/** The saved rig that matches what's dialed in now, if one does */
	activePresetId = $derived.by(() => {
		const { mode, modelId } = this.settings;
		const setup = this.settings.setups[mode];
		const match = this.presets.find(
			(preset) =>
				preset.mode === mode &&
				sameSetup(preset.setup, setup) &&
				(mode !== 'nam' || preset.modelId === modelId)
		);
		return match?.id ?? null;
	});

	#outputLabel: string | null = null;
	#ctx: AudioContext | null = null;
	#stream: MediaStream | null = null;
	#graph: Graph | null = null;
	#raf = 0;
	#lastAttack = 0;
	#attacks = new AttackDetector();
	#lastLatency = 0;
	/** Bumped by every open and stop, so a slow open that's been overtaken backs out */
	#openSeq = 0;
	#cloud: RigCloud | null = null;
	/** The account whose IRs are synced here; for the UI, which can't see #cloud */
	#account = $state<string | null>(null);
	#filesLoaded: Promise<void> = Promise.resolve();
	#syncing = false;
	/** A sync was asked for while one was running: go round again when it's done */
	#syncAgain = false;

	/** The current mode's channel, gains, filters and IR */
	get setup(): RigSetup {
		return this.settings.setups[this.settings.mode];
	}

	/** Browsers only name inputs once access has been granted */
	get canList(): boolean {
		return this.devices.some((device) => device.label !== '');
	}

	/** Safe to call from every panel: only the first call does anything */
	init() {
		if (!browser || this.ready) return;
		this.ready = true;
		this.supported = !!navigator.mediaDevices?.getUserMedia;
		this.settings = loadSettings();
		this.presets = loadPresets();
		if (!this.supported) return;
		navigator.mediaDevices.addEventListener('devicechange', () => void this.#refreshDevices());
		void this.#refreshDevices();
		this.#filesLoaded = this.#refreshFiles();
		void this.sync();
	}

	/**
	 * Whose account uploaded IRs are kept with, from the app layout: null when nobody
	 * is signed in. Nothing is fetched until a rig screen has been opened.
	 */
	connect(cloud: RigCloud | null) {
		if ((cloud?.userId ?? null) === this.#account) return;
		this.#cloud = cloud;
		this.#account = cloud?.userId ?? null;
		this.syncState = 'off';
		void this.sync();
	}

	/** This IR is kept with the signed-in account, so it's on their other devices too */
	isSynced(file: RigFile): boolean {
		return !!file.owner && file.owner === this.#account;
	}

	/** Uploaded IRs can sync; TONE3000's files stay on the device they were picked on */
	get canSync(): boolean {
		return this.#account !== null;
	}

	/**
	 * Bring this browser's IRs and the account's into line: fetch what was added on
	 * another device, drop what was removed there, take its names, and send up what
	 * was uploaded here and hasn't gone yet. One file failing doesn't stop the rest.
	 */
	async sync() {
		const cloud = this.#cloud;
		if (!cloud || !this.ready) return;
		if (this.#syncing) {
			this.#syncAgain = true;
			return;
		}
		this.#syncing = true;
		this.syncState = 'syncing';
		let failed = false;
		let removedAny = false;
		try {
			await this.#filesLoaded;
			// This browser's list first. An IR marked as synced here was in the account
			// before this moment, so if the account's list (read after) lacks it, it was
			// removed there. The other way round, one sent up in between would look removed.
			const local = await listRigFiles('irs');
			const remote = await cloud.list();
			const remoteIds = new Set(remote.map((ir) => ir.id));

			// Removed on another device: its copy here goes too
			for (const file of local) {
				if (file.owner !== cloud.userId || remoteIds.has(file.id)) continue;
				try {
					await deleteRigFile('irs', file.id);
					this.#dropIr(file.id);
					removedAny = true;
				} catch {
					failed = true;
				}
			}

			for (const ir of remote) {
				const mine = local.find((file) => file.id === ir.id);
				try {
					if (!mine) {
						// Added here since this browser's list was read: nothing to fetch
						if (this.irs.some((file) => file.id === ir.id)) continue;
						// Added on another device
						const bytes = await cloud.download(ir.id);
						const saved = await saveRigFile('irs', ir.name, bytes, undefined, {
							id: ir.id,
							owner: cloud.userId
						});
						this.irs = [...this.irs.filter((file) => file.id !== saved.id), saved];
					} else if (mine.name !== ir.name || mine.owner !== cloud.userId) {
						// Renamed on another device, or sent up before this browser noted it
						await updateRigFile('irs', ir.id, { name: ir.name, owner: cloud.userId });
						this.#patchIr(ir.id, { name: ir.name, owner: cloud.userId });
					}
				} catch {
					failed = true;
				}
			}

			// Uploaded here and not in the account yet
			for (const file of local) {
				if (file.owner || file.source || remoteIds.has(file.id)) continue;
				if (!(await this.#sendIr(cloud, file))) failed = true;
			}
		} catch {
			failed = true;
		} finally {
			this.#syncing = false;
		}
		// Signed out, or into another account, while this ran: its answer is stale
		if (cloud !== this.#cloud) return;
		this.syncState = failed ? 'failed' : 'synced';
		if (removedAny) await this.#loadIrs();
		if (this.#syncAgain) {
			this.#syncAgain = false;
			void this.sync();
		}
	}

	/**
	 * Send one IR up to the account and note that it's there. The upload takes a
	 * moment, and the IR can be renamed or removed here while it's on its way: the
	 * account is brought into line with that before this is done.
	 */
	async #sendIr(cloud: RigCloud, file: RigFile): Promise<boolean> {
		const { id } = file;
		try {
			const bytes = await getRigFileBytes('irs', id);
			if (!bytes) return false;
			const sentAs = this.irs.find((ir) => ir.id === id)?.name ?? file.name;
			await cloud.upload(id, sentAs, bytes);
			const now = this.irs.find((ir) => ir.id === id);
			if (!now) {
				await cloud.remove(id);
				return true;
			}
			if (now.name !== sentAs) await cloud.rename(id, now.name);
			await updateRigFile('irs', id, { owner: cloud.userId });
			this.#patchIr(id, { owner: cloud.userId });
			return true;
		} catch {
			return false;
		}
	}

	#patchIr(id: string, patch: Partial<RigFile>) {
		this.irs = this.irs.map((file) => (file.id === id ? { ...file, ...patch } : file));
	}

	/** An IR that's gone from this browser: off the list, the modes and the saved rigs */
	#dropIr(id: string) {
		this.irs = this.irs.filter((ir) => ir.id !== id);
		this.#forgetIr(id);
		this.#forgetInPresets('irs', (irId) => irId === id);
	}

	/** For the practice clock: sound coming in means someone's playing */
	isPlaying(): boolean {
		return this.monitoring && performance.now() - this.#lastAttack < PLAYING_HOLD_MS;
	}

	/** Ask once for input access, so the browser will name the inputs */
	async allowAccess() {
		this.busy = true;
		this.error = null;
		try {
			const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
			probe.getTracks().forEach((track) => track.stop());
			await this.#refreshDevices();
			const saved = this.settings.deviceId;
			if (saved && !this.devices.some((device) => device.id === saved)) {
				this.#update({ deviceId: null });
			}
		} catch (e) {
			this.error = describe(e);
		} finally {
			this.busy = false;
		}
	}

	toggle() {
		return this.monitoring ? this.stop() : this.start();
	}

	async start() {
		if (!this.settings.deviceId) {
			this.error = 'Choose an input first.';
			return;
		}
		await this.#open();
	}

	stop() {
		this.#openSeq++;
		this.#teardown();
		this.busy = false;
	}

	async selectDevice(id: string) {
		this.#update({ deviceId: id || null });
		if (this.monitoring) await this.#open();
	}

	/** Switch between the real amp and NAM, each with the settings it had last */
	async setMode(mode: RigMode) {
		if (mode === this.settings.mode) return;
		this.#update({ mode });
		await this.#applySetup();
	}

	/** Bring the running graph in line with the current mode's setup */
	async #applySetup() {
		const graph = this.#graph;
		if (!graph) return;
		const setup = this.setup;
		this.#ramp(graph.input.gain, dbToGain(setup.inputDb));
		this.#ramp(graph.lowCut.frequency, setup.lowCut);
		this.#ramp(graph.highCut.frequency, setup.highCut);
		this.#ramp(graph.level.gain, setup.level);
		this.#connectChannel();
		await Promise.all([this.#loadModel(), this.#loadIrs()]);
	}

	/**
	 * Keep what's dialed in under a name. A name already taken is saved over, which
	 * is how a saved rig gets updated. Returns what went wrong, if anything.
	 */
	savePreset(name: string): string | null {
		const clean = name.trim().slice(0, PRESET_NAME_MAX);
		if (!clean) return 'Give the rig a name first.';
		const { mode, modelId } = this.settings;
		const saved = {
			name: clean,
			mode,
			setup: { ...this.setup },
			modelId: mode === 'nam' ? modelId : null
		};
		const existing = this.presets.find(
			(preset) => preset.name.toLowerCase() === clean.toLowerCase()
		);
		if (existing) {
			this.#setPresets(
				this.presets.map((preset) => (preset === existing ? { ...saved, id: preset.id } : preset))
			);
			return null;
		}
		if (this.presets.length >= MAX_PRESETS) {
			return `That's ${MAX_PRESETS} saved rigs, which is the most this keeps. Remove one first.`;
		}
		this.#setPresets([...this.presets, { ...saved, id: crypto.randomUUID() }]);
		return null;
	}

	/** Switch to a saved rig's mode and put its settings there */
	async applyPreset(id: string) {
		const preset = this.presets.find((item) => item.id === id);
		if (!preset) return;
		this.error = null;
		this.#update({
			mode: preset.mode,
			setups: { ...this.settings.setups, [preset.mode]: { ...preset.setup } },
			...(preset.mode === 'nam' ? { modelId: preset.modelId } : {})
		});
		await this.#applySetup();
	}

	renamePreset(id: string, name: string): string | null {
		const clean = name.trim().slice(0, PRESET_NAME_MAX);
		if (!clean) return 'Give the rig a name first.';
		const taken = this.presets.some(
			(preset) => preset.id !== id && preset.name.toLowerCase() === clean.toLowerCase()
		);
		if (taken) return `There's already a rig called ${clean}.`;
		this.#setPresets(
			this.presets.map((preset) => (preset.id === id ? { ...preset, name: clean } : preset))
		);
		return null;
	}

	removePreset(id: string) {
		this.#setPresets(this.presets.filter((preset) => preset.id !== id));
	}

	#setPresets(presets: RigPreset[]) {
		this.presets = presets;
		try {
			localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
		} catch {
			// Blocked storage: the saved rigs last until the tab closes
		}
	}

	/** A file that's gone comes out of every saved rig that used it */
	#forgetInPresets(kind: RigFileKind, gone: (id: string) => boolean) {
		let changed = false;
		const presets = this.presets.map((preset) => {
			if (kind === 'models' && preset.modelId && gone(preset.modelId)) {
				changed = true;
				return { ...preset, modelId: null };
			}
			if (kind === 'irs') {
				const { irId, irId2 } = preset.setup;
				const first = irId && gone(irId) ? null : irId;
				const second = irId2 && gone(irId2) ? null : irId2;
				if (first !== irId || second !== irId2) {
					changed = true;
					return { ...preset, setup: { ...preset.setup, irId: first, irId2: second } };
				}
			}
			return preset;
		});
		if (changed) this.#setPresets(presets);
	}

	setChannel(channel: number) {
		this.#updateSetup({ channel: channel === 1 ? 1 : 0 });
		this.#connectChannel();
	}

	async setBuffer(buffer: RigBuffer) {
		this.#update({ buffer });
		// The buffer is fixed when the audio context is made
		if (this.monitoring) await this.#open();
	}

	setInputDb(inputDb: number) {
		this.#updateSetup({ inputDb });
		this.#ramp(this.#graph?.input.gain, dbToGain(inputDb));
	}

	setLowCut(lowCut: number) {
		this.#updateSetup({ lowCut });
		this.#ramp(this.#graph?.lowCut.frequency, lowCut);
	}

	setHighCut(highCut: number) {
		this.#updateSetup({ highCut });
		this.#ramp(this.#graph?.highCut.frequency, highCut);
	}

	setLevel(level: number) {
		this.#updateSetup({ level });
		this.#ramp(this.#graph?.level.gain, level);
	}

	async addModel(file: File) {
		this.error = null;
		this.error = await this.#addModelFile(file, true);
	}

	async #addModelFile(file: File, select: boolean): Promise<string | null> {
		if (!/\.nam$/i.test(file.name)) return 'Amp models need to be .nam files.';
		// Checked again on the bytes, but no need to read in a huge file first
		if (file.size > MAX_MODEL_BYTES) return tooBig(file.name, 'model');
		let bytes: ArrayBuffer;
		try {
			bytes = await file.arrayBuffer();
		} catch {
			return `Couldn't read ${file.name}.`;
		}
		return this.keepModel(bytes, rigFileName(file.name), file.name, undefined, select);
	}

	/**
	 * Several files at once, sorted by what they are: .nam models and .wav IRs. One of
	 * a kind is chosen straight away, as adding it from its picker would. A batch is
	 * only kept, so the sound doesn't change ten times on the way in.
	 */
	async addFiles(files: File[]) {
		this.error = null;
		const models = files.filter((file) => /\.nam$/i.test(file.name));
		const irs = files.filter((file) => /\.wav$/i.test(file.name));
		const others = files.filter((file) => !/\.(nam|wav)$/i.test(file.name));
		const problems: string[] = [];
		for (const file of models) {
			const problem = await this.#addModelFile(file, models.length === 1);
			if (problem) problems.push(problem);
		}
		for (const file of irs) {
			const problem = await this.#addIrFile(file, irs.length === 1);
			if (problem) problems.push(problem);
		}
		if (others.length === 1) {
			problems.push(`${others[0].name} isn't a .nam model or a .wav IR.`);
		} else if (others.length > 1) {
			problems.push(`${others.length} of those aren't .nam models or .wav IRs.`);
		}
		this.error = problems.length > 0 ? problems.join(' ') : null;
	}

	/**
	 * Check a model, keep it in this browser and choose it: from a file, or from
	 * TONE3000 with its `source`. Returns what went wrong, if anything.
	 */
	async keepModel(
		bytes: ArrayBuffer,
		name: string,
		label = name,
		source?: RigFileSource,
		select = true
	): Promise<string | null> {
		if (bytes.byteLength > MAX_MODEL_BYTES) return tooBig(label, 'model');
		if (!looksLikeNamModel(new TextDecoder().decode(bytes))) {
			return `${label} isn't a NAM model.`;
		}
		try {
			const saved = await saveRigFile('models', name, bytes, source);
			this.models = [...this.models, saved];
			if (select) await this.selectModel(saved.id);
			return null;
		} catch {
			return "Couldn't save the model in this browser. A private window may not allow it.";
		}
	}

	async selectModel(id: string | null) {
		this.#update({ modelId: id });
		await this.#loadModel();
	}

	async removeModel(id: string) {
		this.error = null;
		try {
			await deleteRigFile('models', id);
		} catch {
			this.error = "Couldn't remove that model.";
			return;
		}
		this.models = this.models.filter((model) => model.id !== id);
		this.#forgetInPresets('models', (modelId) => modelId === id);
		if (this.settings.modelId === id) await this.selectModel(null);
	}

	async addIr(file: File, slot: IrSlot = 0) {
		this.error = null;
		this.error = await this.#addIrFile(file, true, slot);
	}

	async #addIrFile(file: File, select: boolean, slot: IrSlot = 0): Promise<string | null> {
		if (!/\.wav$/i.test(file.name)) return 'IRs need to be .wav files.';
		if (file.size > MAX_IR_BYTES) return tooBig(file.name, 'ir');
		let bytes: ArrayBuffer;
		try {
			bytes = await file.arrayBuffer();
		} catch {
			return `Couldn't read ${file.name} as audio.`;
		}
		return this.keepIr(bytes, rigFileName(file.name), file.name, undefined, select, slot);
	}

	/**
	 * keepModel's twin for cab IRs: chosen for the mode that's on, as its first IR or
	 * its second. One that was uploaded (no `source`) goes up to the account as well.
	 */
	async keepIr(
		bytes: ArrayBuffer,
		name: string,
		label = name,
		source?: RigFileSource,
		select = true,
		slot: IrSlot = 0
	): Promise<string | null> {
		if (bytes.byteLength > MAX_IR_BYTES) return tooBig(label, 'ir');
		try {
			// Only keep what decodes. decodeAudioData takes its buffer, so give it a copy.
			await new OfflineAudioContext(1, 1, 48_000).decodeAudioData(bytes.slice(0));
		} catch {
			return `Couldn't read ${label} as audio.`;
		}
		try {
			const saved = await saveRigFile('irs', name, bytes, source);
			this.irs = [...this.irs, saved];
			if (select) await this.selectIr(saved.id, slot);
			// Not waited for: the IR is ready to play, and a failed upload goes on the next sync
			const cloud = this.#cloud;
			if (cloud && !source) {
				void this.#sendIr(cloud, saved).then((sent) => {
					if (!sent && cloud === this.#cloud) this.syncState = 'failed';
				});
			}
			return null;
		} catch {
			return "Couldn't save the IR in this browser. A private window may not allow it.";
		}
	}

	/** Choose the first IR or the second. An IR sits in one place: picking it moves it. */
	async selectIr(id: string | null, slot: IrSlot = 0) {
		const other = IR_KEYS[slot === 0 ? 1 : 0];
		this.#updateSetup({
			[IR_KEYS[slot]]: id,
			...(id && this.setup[other] === id ? { [other]: null } : {})
		});
		await this.#loadIrs();
	}

	/** How much of the mix is the second IR */
	setIrBlend(irBlend: number) {
		this.#updateSetup({ irBlend });
		this.#applyBlend();
	}

	async removeIr(id: string) {
		this.error = null;
		const file = this.irs.find((ir) => ir.id === id);
		const cloud = this.#cloud;
		// From the account first: removed only here, the next sync would bring it back
		if (file && cloud && this.isSynced(file)) {
			try {
				await cloud.remove(id);
			} catch {
				this.error = "Couldn't remove that IR from your account. Check you're online.";
				return;
			}
		}
		try {
			await deleteRigFile('irs', id);
		} catch {
			this.error = "Couldn't remove that IR.";
			return;
		}
		this.#dropIr(id);
		await this.#loadIrs();
	}

	/** A new name for a kept file. Its TONE3000 credit, if it has one, stays as it was. */
	async renameFile(kind: RigFileKind, id: string, name: string): Promise<boolean> {
		const clean = name.trim().slice(0, FILE_NAME_MAX);
		if (!clean) return false;
		this.error = null;
		const synced = kind === 'irs' ? this.irs.find((ir) => ir.id === id) : undefined;
		const cloud = this.#cloud;
		// In the account first: renamed only here, the next sync would put the old name back
		if (synced && cloud && this.isSynced(synced)) {
			try {
				await cloud.rename(id, clean);
			} catch {
				this.error = "Couldn't rename that IR in your account. Check you're online.";
				return false;
			}
		}
		try {
			await renameRigFile(kind, id, clean);
		} catch {
			this.error = "Couldn't rename that in this browser.";
			return false;
		}
		const renamed = (files: RigFile[]) =>
			files.map((file) => (file.id === id ? { ...file, name: clean } : file));
		if (kind === 'models') this.models = renamed(this.models);
		else this.irs = renamed(this.irs);
		return true;
	}

	/** An IR that's gone comes off whichever modes were using it, in either place */
	#forgetIr(id: string) {
		const without = (setup: RigSetup): RigSetup =>
			setup.irId === id || setup.irId2 === id
				? {
						...setup,
						irId: setup.irId === id ? null : setup.irId,
						irId2: setup.irId2 === id ? null : setup.irId2
					}
				: setup;
		const { amp, nam } = this.settings.setups;
		this.#update({ setups: { amp: without(amp), nam: without(nam) } });
	}

	#update(patch: Partial<RigSettings>) {
		this.settings = { ...this.settings, ...patch };
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
		} catch {
			// Blocked storage: the settings still apply until the tab closes
		}
	}

	#updateSetup(patch: Partial<RigSetup>) {
		const { mode, setups } = this.settings;
		this.#update({ setups: { ...setups, [mode]: { ...setups[mode], ...patch } } });
	}

	#ramp(param: AudioParam | undefined, value: number) {
		if (param && this.#ctx) param.setTargetAtTime(value, this.#ctx.currentTime, 0.015);
	}

	async #refreshDevices() {
		const all = await navigator.mediaDevices.enumerateDevices();
		this.devices = all
			.filter((device) => device.kind === 'audioinput')
			.map((device) => ({ id: device.deviceId, label: device.label }));
		const outputs = all.filter((device) => device.kind === 'audiooutput');
		this.#outputLabel =
			(outputs.find((device) => device.deviceId === 'default') ?? outputs[0])?.label || null;
	}

	async #refreshFiles() {
		try {
			const [models, irs] = await Promise.all([listRigFiles('models'), listRigFiles('irs')]);
			this.models = models;
			this.irs = irs;
			const { modelId, setups } = this.settings;
			if (modelId && !models.some((model) => model.id === modelId)) this.#update({ modelId: null });
			for (const { irId, irId2 } of Object.values(setups)) {
				for (const id of [irId, irId2]) {
					if (id && !irs.some((ir) => ir.id === id)) this.#forgetIr(id);
				}
			}
			this.#forgetInPresets('models', (id) => !models.some((model) => model.id === id));
			this.#forgetInPresets('irs', (id) => !irs.some((ir) => ir.id === id));
		} catch {
			// No IndexedDB (some private windows): the rig still runs, without saved files
		}
	}

	async #open() {
		const seq = ++this.#openSeq;
		const deviceId = this.settings.deviceId;
		this.#teardown();
		if (!deviceId) return;
		this.busy = true;
		this.error = null;
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: { ...INPUT_CONSTRAINTS, deviceId: { exact: deviceId } }
			});
			if (seq !== this.#openSeq) {
				stream.getTracks().forEach((track) => track.stop());
				return;
			}
			const track = stream.getAudioTracks()[0];
			await this.#refreshDevices();
			if (seq !== this.#openSeq) {
				stream.getTracks().forEach((track) => track.stop());
				return;
			}
			if (wouldFeedBack(track.label, this.#outputLabel)) {
				stream.getTracks().forEach((track) => track.stop());
				this.error =
					"That would feed back: the built-in mic into the built-in speakers. Plug in headphones, or choose your interface's input.";
				return;
			}

			const trackSettings = track.getSettings();
			this.channelCount = Math.max(1, trackSettings.channelCount ?? 1);
			// Match the device's rate, so nothing is resampled on the way through
			const ctx = new AudioContext({
				latencyHint: this.settings.buffer === 'smallest' ? 0 : 'interactive',
				...(trackSettings.sampleRate ? { sampleRate: trackSettings.sampleRate } : {})
			});
			this.#stream = stream;
			this.#ctx = ctx;
			this.sampleRate = ctx.sampleRate;
			this.#graph = buildGraph(ctx, stream, this.channelCount, this.setup);
			this.#connectChannel();
			track.addEventListener('ended', () => {
				if (this.#stream !== stream) return;
				this.stop();
				this.error = 'The input went away. Check it’s plugged in, then turn the rig back on.';
			});

			await Promise.all([this.#loadModel(), this.#loadIrs()]);
			if (seq !== this.#openSeq) return;
			await ctx.resume();
			if (seq !== this.#openSeq) return;
			this.monitoring = true;
			this.#lastLatency = 0;
			// A new input, a new resting level
			this.#attacks = new AttackDetector();
			this.#raf = requestAnimationFrame(this.#tick);
		} catch (e) {
			if (seq !== this.#openSeq) return;
			this.#teardown();
			this.error = describe(e);
		} finally {
			if (seq === this.#openSeq) this.busy = false;
		}
	}

	#teardown() {
		cancelAnimationFrame(this.#raf);
		this.#stream?.getTracks().forEach((track) => track.stop());
		// Closing the context ends the model's worklet with it
		void this.#ctx?.close();
		this.#stream = null;
		this.#ctx = null;
		this.#graph = null;
		this.monitoring = false;
		this.modelLoading = false;
		this.modelNote = null;
		this.peakDb = -Infinity;
		this.outDb = -Infinity;
		this.limiting = false;
		this.latencyMs = null;
		this.sampleRate = null;
	}

	#connectChannel() {
		const graph = this.#graph;
		if (!graph) return;
		graph.splitter.disconnect();
		graph.splitter.connect(graph.input, Math.min(this.setup.channel, this.channelCount - 1));
	}

	/** The engine loads only when a model is first used: it's half a megabyte of wasm */
	#ampNode(ctx: AudioContext, graph: Graph): Promise<NamNode> {
		graph.ampNode ??= (async () => {
			const { NamEngine } = await import('neural-amp-modeler-wasm/engine');
			const engine = await NamEngine.attach(ctx);
			const node = await engine.createNode();
			node.connect(graph.ampOut);
			return node;
		})().catch((e) => {
			// Let the next choice try again
			graph.ampNode = null;
			throw e;
		});
		return graph.ampNode;
	}

	/** Through the model, or straight past it */
	#routeAmp(graph: Graph, amp: NamNode | null) {
		graph.input.disconnect();
		graph.input.connect(graph.analyser);
		graph.input.connect(amp ?? graph.ampOut);
	}

	/** The model in play: only NAM mode has one */
	#activeModelId(): string | null {
		return this.settings.mode === 'nam' ? this.settings.modelId : null;
	}

	/** Load the chosen model into the running context, then route through it or around it */
	async #loadModel() {
		const ctx = this.#ctx;
		const graph = this.#graph;
		const id = this.#activeModelId();
		if (!ctx || !graph) return;
		this.modelNote = null;

		if (!id) {
			this.modelLoading = false;
			this.#routeAmp(graph, null);
			this.#ramp(graph.ampOut.gain, 1);
			if (graph.ampNode) void graph.ampNode.then((amp) => amp.unloadModel()).catch(() => {});
			return;
		}

		this.modelLoading = true;
		try {
			const bytes = await getRigFileBytes('models', id);
			if (!bytes) throw new Error('Model missing from storage');
			const amp = await this.#ampNode(ctx, graph);
			if (ctx !== this.#ctx || id !== this.#activeModelId()) return;
			// Parses on the audio thread; the node fades its own output around the swap
			const info = await amp.loadModel(new TextDecoder().decode(bytes));
			if (ctx !== this.#ctx || id !== this.#activeModelId()) return;
			this.#ramp(graph.ampOut.gain, info.hasLoudness ? dbToGain(loudnessTrimDb(info.loudness)) : 1);
			this.#routeAmp(graph, amp);
			this.modelNote = sampleRateNote(info.expectedSampleRate, ctx.sampleRate);
		} catch {
			if (ctx !== this.#ctx || id !== this.#activeModelId()) return;
			this.#routeAmp(graph, null);
			this.#ramp(graph.ampOut.gain, 1);
			this.error = "Couldn't load that amp model. It may be from a newer version of NAM.";
		} finally {
			if (ctx === this.#ctx && id === this.#activeModelId()) this.modelLoading = false;
		}
	}

	/**
	 * Decode the chosen IRs for the running context, then route through them (side by
	 * side, each with its share of the blend) or straight past
	 */
	async #loadIrs() {
		const ctx = this.#ctx;
		const graph = this.#graph;
		const ids = [this.setup.irId, this.setup.irId2];
		if (!ctx || !graph) return;

		const buffers = await Promise.all(
			ids.map(async (id) => {
				if (!id) return null;
				try {
					const bytes = await getRigFileBytes('irs', id);
					return bytes ? await ctx.decodeAudioData(bytes) : null;
				} catch {
					if (ctx === this.#ctx) this.error = "Couldn't load that IR. Try adding it again.";
					return null;
				}
			})
		);
		// A newer choice or a new context got here first
		if (ctx !== this.#ctx || ids[0] !== this.setup.irId || ids[1] !== this.setup.irId2) return;

		graph.highCut.disconnect();
		graph.convolvers.forEach((convolver) => convolver?.disconnect());
		graph.convolvers = [null, null];
		buffers.forEach((buffer, slot) => {
			if (!buffer) return;
			// A fresh node per IR, rather than swapping the buffer on a live one
			const convolver = ctx.createConvolver();
			convolver.buffer = buffer;
			graph.highCut.connect(convolver).connect(graph.irGains[slot]);
			graph.convolvers[slot] = convolver;
		});
		if (!buffers[0] && !buffers[1]) graph.highCut.connect(graph.level);
		this.#applyBlend();
	}

	/** Set each IR's share from the blend, going by the IRs that actually loaded */
	#applyBlend() {
		const graph = this.#graph;
		if (!graph) return;
		const shares = irShares(this.setup.irBlend, !!graph.convolvers[0], !!graph.convolvers[1]);
		shares.forEach((share, slot) => this.#ramp(graph.irGains[slot].gain, share));
	}

	#tick = () => {
		const graph = this.#graph;
		const ctx = this.#ctx;
		if (!graph || !ctx) return;
		graph.analyser.getFloatTimeDomainData(graph.samples);
		let squares = 0;
		for (const sample of graph.samples) squares += sample * sample;
		// The meter shows peaks; attacks are judged on RMS, which a click or crackle barely moves
		const rms = Math.sqrt(squares / graph.samples.length);
		const now = performance.now();
		if (this.#attacks.feed(rms > 0 ? 20 * Math.log10(rms) : -Infinity, now)) {
			this.#lastAttack = now;
		}
		this.peakDb = meterFall(this.peakDb, blockPeakDb(graph.samples));
		graph.outAnalyser.getFloatTimeDomainData(graph.outSamples);
		this.outDb = meterFall(this.outDb, blockPeakDb(graph.outSamples));
		this.limiting = graph.limiter.reduction < LIMITING_DB;

		if (now - this.#lastLatency > 1000) {
			this.#lastLatency = now;
			// Chrome reports input latency on the track; it isn't in TS's DOM types
			const input = (
				this.#stream?.getAudioTracks()[0]?.getSettings() as
					(MediaTrackSettings & { latency?: number }) | undefined
			)?.latency;
			const seconds =
				(typeof input === 'number' ? input : 0) + (ctx.baseLatency ?? 0) + (ctx.outputLatency ?? 0);
			this.latencyMs = seconds * 1000;
		}
		this.#raf = requestAnimationFrame(this.#tick);
	};
}

export const rig = new Rig();
