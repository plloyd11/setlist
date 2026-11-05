import { browser } from '$app/env';
import type { NamNode } from 'neural-amp-modeler-wasm/engine';
import {
	deleteRigFile,
	getRigFileBytes,
	listRigFiles,
	looksLikeNamModel,
	MAX_IR_BYTES,
	MAX_MODEL_BYTES,
	rigFileName,
	saveRigFile,
	type RigFile,
	type RigFileSource
} from './rigStore.js';
import { AttackDetector } from './attackDetector.js';

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
 *        → IR → level → limiter → out
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
}

export interface RigSettings {
	deviceId: string | null;
	buffer: RigBuffer;
	mode: RigMode;
	setups: Record<RigMode, RigSetup>;
	/** The NAM model, used in NAM mode */
	modelId: string | null;
}

export const INPUT_DB = { min: -24, max: 12 } as const;
export const LOW_CUT = { min: 20, max: 250 } as const;
export const HIGH_CUT = { min: 2000, max: 20000 } as const;

const STORAGE_KEY = 'practice:rig:v1';
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
	irId: null
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
		irId: optionalId(v.irId)
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
	convolver: ConvolverNode | null;
	level: GainNode;
	limiter: DynamicsCompressorNode;
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
	const level = ctx.createGain();
	const limiter = ctx.createDynamicsCompressor();

	input.gain.value = dbToGain(setup.inputDb);
	analyser.fftSize = 1024;
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
	level.connect(limiter).connect(ctx.destination);

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
		convolver: null,
		level,
		limiter
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
	latencyMs = $state<number | null>(null);
	/** Rig panels on screen. With none, the app shell shows a way to turn the rig off. */
	panels = $state(0);

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
		if (!this.supported) return;
		navigator.mediaDevices.addEventListener('devicechange', () => void this.#refreshDevices());
		void this.#refreshDevices();
		void this.#refreshFiles();
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
		const graph = this.#graph;
		if (!graph) return;
		const setup = this.setup;
		this.#ramp(graph.input.gain, dbToGain(setup.inputDb));
		this.#ramp(graph.lowCut.frequency, setup.lowCut);
		this.#ramp(graph.highCut.frequency, setup.highCut);
		this.#ramp(graph.level.gain, setup.level);
		this.#connectChannel();
		await Promise.all([this.#loadModel(), this.#loadIr()]);
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
		if (!/\.nam$/i.test(file.name)) {
			this.error = 'Amp models need to be .nam files.';
			return;
		}
		// Checked again on the bytes, but no need to read in a huge file first
		if (file.size > MAX_MODEL_BYTES) {
			this.error = tooBig(file.name, 'model');
			return;
		}
		let bytes: ArrayBuffer;
		try {
			bytes = await file.arrayBuffer();
		} catch {
			this.error = `Couldn't read ${file.name}.`;
			return;
		}
		this.error = await this.keepModel(bytes, rigFileName(file.name), file.name);
	}

	/**
	 * Check a model, keep it in this browser and choose it: from a file, or from
	 * TONE3000 with its `source`. Returns what went wrong, if anything.
	 */
	async keepModel(
		bytes: ArrayBuffer,
		name: string,
		label = name,
		source?: RigFileSource
	): Promise<string | null> {
		if (bytes.byteLength > MAX_MODEL_BYTES) return tooBig(label, 'model');
		if (!looksLikeNamModel(new TextDecoder().decode(bytes))) {
			return `${label} isn't a NAM model.`;
		}
		try {
			const saved = await saveRigFile('models', name, bytes, source);
			this.models = [...this.models, saved];
			await this.selectModel(saved.id);
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
		try {
			await deleteRigFile('models', id);
		} catch {
			this.error = "Couldn't remove that model.";
			return;
		}
		this.models = this.models.filter((model) => model.id !== id);
		if (this.settings.modelId === id) await this.selectModel(null);
	}

	async addIr(file: File) {
		this.error = null;
		if (!/\.wav$/i.test(file.name)) {
			this.error = 'IRs need to be .wav files.';
			return;
		}
		if (file.size > MAX_IR_BYTES) {
			this.error = tooBig(file.name, 'ir');
			return;
		}
		let bytes: ArrayBuffer;
		try {
			bytes = await file.arrayBuffer();
		} catch {
			this.error = `Couldn't read ${file.name} as audio.`;
			return;
		}
		this.error = await this.keepIr(bytes, rigFileName(file.name), file.name);
	}

	/** keepModel's twin for cab IRs: chosen for the mode that's on */
	async keepIr(
		bytes: ArrayBuffer,
		name: string,
		label = name,
		source?: RigFileSource
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
			await this.selectIr(saved.id);
			return null;
		} catch {
			return "Couldn't save the IR in this browser. A private window may not allow it.";
		}
	}

	async selectIr(id: string | null) {
		this.#updateSetup({ irId: id });
		await this.#loadIr();
	}

	async removeIr(id: string) {
		try {
			await deleteRigFile('irs', id);
		} catch {
			this.error = "Couldn't remove that IR.";
			return;
		}
		this.irs = this.irs.filter((ir) => ir.id !== id);
		this.#forgetIr(id);
		await this.#loadIr();
	}

	/** An IR that's gone comes off whichever modes were using it */
	#forgetIr(id: string) {
		const { amp, nam } = this.settings.setups;
		this.#update({
			setups: {
				amp: amp.irId === id ? { ...amp, irId: null } : amp,
				nam: nam.irId === id ? { ...nam, irId: null } : nam
			}
		});
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
			for (const { irId } of Object.values(setups)) {
				if (irId && !irs.some((ir) => ir.id === irId)) this.#forgetIr(irId);
			}
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
			this.#graph = buildGraph(ctx, stream, this.channelCount, this.setup);
			this.#connectChannel();
			track.addEventListener('ended', () => {
				if (this.#stream !== stream) return;
				this.stop();
				this.error = 'The input went away. Check it’s plugged in, then turn the rig back on.';
			});

			await Promise.all([this.#loadModel(), this.#loadIr()]);
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
		this.latencyMs = null;
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

	/** Decode the chosen IR for the running context, then route through it or around it */
	async #loadIr() {
		const ctx = this.#ctx;
		const graph = this.#graph;
		const id = this.setup.irId;
		if (!ctx || !graph) return;

		let buffer: AudioBuffer | null = null;
		if (id) {
			try {
				const bytes = await getRigFileBytes('irs', id);
				buffer = bytes ? await ctx.decodeAudioData(bytes) : null;
			} catch {
				if (ctx === this.#ctx) this.error = "Couldn't load that IR. Try adding it again.";
			}
		}
		// A newer choice or a new context got here first
		if (ctx !== this.#ctx || id !== this.setup.irId) return;

		graph.highCut.disconnect();
		graph.convolver?.disconnect();
		graph.convolver = null;
		if (buffer) {
			// A fresh node per IR, rather than swapping the buffer on a live one
			graph.convolver = ctx.createConvolver();
			graph.convolver.buffer = buffer;
			graph.highCut.connect(graph.convolver).connect(graph.level);
		} else {
			graph.highCut.connect(graph.level);
		}
	}

	#tick = () => {
		const graph = this.#graph;
		const ctx = this.#ctx;
		if (!graph || !ctx) return;
		graph.analyser.getFloatTimeDomainData(graph.samples);
		let peak = 0;
		let squares = 0;
		for (const sample of graph.samples) {
			peak = Math.max(peak, Math.abs(sample));
			squares += sample * sample;
		}
		const db = peak > 0 ? 20 * Math.log10(peak) : -Infinity;
		// The meter shows peaks; attacks are judged on RMS, which a click or crackle barely moves
		const rms = Math.sqrt(squares / graph.samples.length);
		const now = performance.now();
		if (this.#attacks.feed(rms > 0 ? 20 * Math.log10(rms) : -Infinity, now)) {
			this.#lastAttack = now;
		}
		// Fast up, slow down, like a real meter
		this.peakDb = Number.isFinite(this.peakDb) ? Math.max(db, this.peakDb - 1.2) : db;

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
