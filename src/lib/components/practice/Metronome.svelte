<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Knob from '#lib/components/ui/Knob.svelte';
	import { microLabel, panel } from './practiceStyles.js';
	import {
		addTap,
		clampBpm,
		loadMetronomeSettings,
		MAX_BPM,
		MetronomeEngine,
		MIN_BPM,
		BEAT_OPTIONS,
		saveMetronomeSettings,
		tempoFromTaps
	} from '#lib/utils/metronome.js';

	let {
		songId,
		onrunningchange
	}: {
		/** Remembers a tempo per song when given */
		songId?: string;
		onrunningchange?: (running: boolean) => void;
	} = $props();

	let bpm = $state(100);
	let beatsPerBar = $state(4);
	let volume = $state(0.8);
	let running = $state(false);
	let activeBeat = $state(-1);
	let taps: number[] = [];

	const stepperClass =
		'focus-live flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-surface-300 text-lg leading-none text-surface-700 transition-colors duration-150 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-200 dark:hover:bg-surface-700';

	const engine = new MetronomeEngine((beat) => (activeBeat = beat));

	onMount(() => {
		const saved = loadMetronomeSettings(songId);
		bpm = saved.bpm;
		beatsPerBar = saved.beatsPerBar;
		volume = saved.volume;
		sync();
	});

	onDestroy(() => engine.destroy());

	function sync() {
		engine.bpm = bpm;
		engine.beatsPerBar = beatsPerBar;
		engine.volume = volume;
	}

	function changed() {
		sync();
		saveMetronomeSettings({ bpm, beatsPerBar, volume }, songId);
	}

	function setBpm(value: number) {
		bpm = clampBpm(value);
		changed();
	}

	function setBeats(e: Event) {
		beatsPerBar = Number((e.currentTarget as HTMLSelectElement).value);
		activeBeat = -1;
		changed();
	}

	function setVolume(value: number) {
		volume = value;
		changed();
	}

	function tap() {
		taps = addTap(taps, performance.now());
		const tempo = tempoFromTaps(taps);
		if (tempo !== null) setBpm(tempo);
	}

	export function toggle() {
		if (running) {
			engine.stop();
			running = false;
			activeBeat = -1;
		} else {
			sync();
			engine.start();
			running = true;
		}
		onrunningchange?.(running);
	}
</script>

<section aria-label="Metronome" class="{panel} px-4 py-3.5">
	<h2 class={microLabel}>Metronome</h2>

	<!-- Lamps: lit only while it's running, because lit means live. The downbeat is wider. -->
	<div class="mt-2.5 flex items-center gap-1.5" aria-hidden="true" data-beat={activeBeat}>
		{#each { length: beatsPerBar } as _, beat (beat)}
			<span
				class="h-2 rounded-sm {beat === 0 ? 'flex-[1.5]' : 'flex-1'} {running && beat === activeBeat
					? 'bg-neon-600 shadow-glow-neon dark:bg-neon-400'
					: 'bg-surface-200 dark:bg-surface-700'}"
			></span>
		{/each}
	</div>

	<!-- Three columns with their labels on one line, whatever each knob shows below it -->
	<div class="mt-4 grid grid-cols-[3.5rem_minmax(0,1fr)_3.5rem] items-start gap-2">
		<Knob
			value={bpm}
			min={MIN_BPM}
			max={MAX_BPM}
			step={1}
			label="Tempo"
			format={(v) => `${v} BPM`}
			showValue={false}
			onchange={setBpm}
		/>
		<div class="flex flex-col items-center gap-1">
			<div class="flex h-12 w-full items-center justify-center">
				<button
					type="button"
					onclick={() => setBpm(bpm - 1)}
					aria-label="Slower"
					class={stepperClass}
				>
					&minus;
				</button>
				<span
					class="w-14 text-center font-display text-3xl leading-none font-bold text-surface-900 sm:w-16 dark:text-surface-100"
				>
					{bpm}
				</span>
				<button
					type="button"
					onclick={() => setBpm(bpm + 1)}
					aria-label="Faster"
					class={stepperClass}
				>
					+
				</button>
			</div>
			<span class={microLabel}>BPM</span>
		</div>
		<Knob
			value={volume}
			label="Click"
			format={(v) => `${Math.round(v * 100)}%`}
			onchange={setVolume}
		/>
	</div>

	<div class="mt-3 flex items-center gap-2">
		<button
			type="button"
			onclick={toggle}
			aria-pressed={running}
			class="focus-live flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-lg border px-3 font-semibold transition-colors duration-150 {running
				? 'border-accent-500 bg-accent-500 text-white shadow-sm hover:bg-accent-600'
				: 'border-accent-300 bg-accent-100 text-accent-800 hover:bg-accent-200 dark:border-accent-600 dark:bg-accent-800/50 dark:text-accent-200 dark:hover:bg-accent-800'}"
		>
			{#if running}
				<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<rect x="4" y="4" width="16" height="16" rx="2" />
				</svg>
			{:else}
				<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z" />
				</svg>
			{/if}
			{running ? 'Stop' : 'Start'}<span class="sr-only"> metronome</span>
		</button>
		<button
			type="button"
			onclick={tap}
			aria-label="Tap tempo"
			class="focus-live min-h-11 shrink-0 rounded-lg border border-surface-300 px-3 text-sm font-medium text-surface-700 transition-colors duration-150 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-700"
		>
			Tap
		</button>
		<label class="sr-only" for="metronome-beats">Beats per bar</label>
		<select
			id="metronome-beats"
			value={beatsPerBar}
			onchange={setBeats}
			class="focus-live min-h-11 rounded-lg border border-surface-300 bg-surface-50 px-2 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
		>
			{#each BEAT_OPTIONS as beats (beats)}
				<option value={beats}>{beats} beats</option>
			{/each}
		</select>
	</div>
</section>
