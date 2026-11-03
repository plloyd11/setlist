<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import Knob from '#lib/components/ui/Knob.svelte';
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

	let { songId }: { /** Remembers a tempo per song when given */ songId?: string } = $props();

	let bpm = $state(100);
	let beatsPerBar = $state(4);
	let volume = $state(0.8);
	let running = $state(false);
	let activeBeat = $state(-1);
	let taps: number[] = [];

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
	}
</script>

<section
	aria-label="Metronome"
	class="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-800"
>
	<div class="flex items-center justify-between gap-3">
		<h2
			class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
		>
			Metronome
		</h2>
		<!-- Lamps: lit only while it's running, because lit means live -->
		<div class="flex items-center gap-1.5" aria-hidden="true" data-beat={activeBeat}>
			{#each { length: beatsPerBar } as _, beat (beat)}
				<span
					class="rounded-full {beat === 0 ? 'h-2.5 w-2.5' : 'h-2 w-2'} {running &&
					beat === activeBeat
						? 'bg-neon-600 shadow-glow-neon dark:bg-neon-400'
						: 'bg-surface-300 dark:bg-surface-600'}"
				></span>
			{/each}
		</div>
	</div>

	<div class="mt-2 flex items-center justify-between gap-3">
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
		<div class="flex items-center gap-1">
			<button
				type="button"
				onclick={() => setBpm(bpm - 1)}
				aria-label="Slower"
				class="focus-live flex h-11 w-11 items-center justify-center rounded-lg text-lg text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-700"
			>
				&minus;
			</button>
			<p class="w-16 text-center">
				<span
					class="block font-display text-3xl leading-none font-bold text-surface-900 tabular-nums dark:text-surface-100"
				>
					{bpm}
				</span>
				<span
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
				>
					BPM
				</span>
			</p>
			<button
				type="button"
				onclick={() => setBpm(bpm + 1)}
				aria-label="Faster"
				class="focus-live flex h-11 w-11 items-center justify-center rounded-lg text-lg text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-700"
			>
				+
			</button>
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
			class="focus-live min-h-11 flex-1 rounded-lg bg-accent-500 px-4 font-semibold text-white shadow-sm hover:bg-accent-600"
		>
			{running ? 'Stop' : 'Start'}<span class="sr-only"> metronome</span>
		</button>
		<button
			type="button"
			onclick={tap}
			aria-label="Tap tempo"
			class="focus-live min-h-11 rounded-lg border border-surface-300 px-4 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-700"
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
