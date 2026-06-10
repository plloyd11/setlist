<script lang="ts">
	import type WaveSurfer from 'wavesurfer.js';
	import { formatDuration } from '$lib/utils/duration';

	export interface WaveformMarker {
		id: string;
		time: number;
		label: string;
		resolved: boolean;
		/** The marker the playhead is currently inside — lit as a live signal */
		active?: boolean;
	}

	let {
		url,
		peaks = null,
		duration = null,
		markers = [],
		ontimeupdate,
		onmarkerclick,
		onloaderror
	}: {
		url: string;
		peaks?: number[] | null;
		duration?: number | null;
		markers?: WaveformMarker[];
		ontimeupdate?: (time: number) => void;
		onmarkerclick?: (id: string) => void;
		onloaderror?: () => void;
	} = $props();

	let container: HTMLDivElement;
	let ws: WaveSurfer | null = null;
	let ready = $state(false);
	let playing = $state(false);
	let currentTime = $state(0);
	let totalDuration = $state(0);
	let lastEmitted = 0;

	function themeColor(name: string, fallback: string): string {
		const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		return value || fallback;
	}

	// Recreate the player whenever the audio source changes (version switch).
	// $effect only runs client-side, and wavesurfer.js is imported dynamically —
	// a top-level import would break SSR.
	$effect(() => {
		const sourceUrl = url;
		const sourcePeaks = peaks;
		const sourceDuration = duration;

		ready = false;
		playing = false;
		currentTime = 0;
		totalDuration = sourceDuration ?? 0;

		let cancelled = false;
		let instance: WaveSurfer | null = null;

		(async () => {
			const { default: WaveSurferCtor } = await import('wavesurfer.js');
			if (cancelled) return;

			instance = WaveSurferCtor.create({
				container,
				url: sourceUrl,
				// Stored peaks + duration let wavesurfer render immediately and
				// stream playback via media element instead of downloading and
				// decoding the whole file.
				peaks: sourcePeaks ? [sourcePeaks] : undefined,
				duration: sourceDuration ?? undefined,
				height: 80,
				normalize: true,
				barWidth: 2,
				barGap: 1,
				barRadius: 2,
				waveColor: themeColor('--color-surface-400', '#5a7190'),
				progressColor: themeColor('--color-accent-500', '#8a6a4f'),
				cursorColor: themeColor('--color-neon-400', '#bbc92a')
			});
			ws = instance;

			instance.on('ready', (d: number) => {
				ready = true;
				if (d > 0) totalDuration = d;
			});
			instance.on('play', () => (playing = true));
			instance.on('pause', () => (playing = false));
			instance.on('finish', () => (playing = false));
			instance.on('timeupdate', (t: number) => {
				currentTime = t;
				// Throttle to ~4/sec for the comment-list highlight
				if (Math.abs(t - lastEmitted) >= 0.25) {
					lastEmitted = t;
					ontimeupdate?.(t);
				}
			});
			instance.on('error', () => {
				// Most common cause: signed URL expired mid-session
				onloaderror?.();
			});
		})();

		return () => {
			cancelled = true;
			instance?.destroy();
			ws = null;
		};
	});

	export function seekTo(time: number) {
		ws?.setTime(time);
		currentTime = time;
		ontimeupdate?.(time);
	}

	export function playPause() {
		void ws?.playPause();
	}

	export function getCurrentTime(): number {
		return currentTime;
	}

	// Keyboard seek for the slider — wavesurfer's canvas is click-only
	function handleSeekKeydown(e: KeyboardEvent) {
		if (!ready) return;
		let next: number | null = null;
		switch (e.key) {
			case 'ArrowRight':
			case 'ArrowUp':
				next = Math.min(currentTime + 5, totalDuration);
				break;
			case 'ArrowLeft':
			case 'ArrowDown':
				next = Math.max(currentTime - 5, 0);
				break;
			case 'Home':
				next = 0;
				break;
			case 'End':
				next = totalDuration;
				break;
			case ' ':
			case 'Enter':
				e.preventDefault();
				playPause();
				return;
		}
		if (next !== null) {
			e.preventDefault();
			seekTo(next);
		}
	}

	// Deterministic pseudo-waveform for the loading skeleton (stable across SSR/hydration)
	const skeletonBars = Array.from({ length: 48 }, (_, i) => 20 + 55 * Math.abs(Math.sin(i * 1.7)));
</script>

<div
	class="rounded-xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-900"
>
	<!-- Waveform + comment markers -->
	<div class="relative">
		<!-- Click-to-seek is wavesurfer's; arrow keys + Space come from the slider role -->
		<div
			bind:this={container}
			role="slider"
			tabindex="0"
			aria-label="Seek"
			aria-valuemin={0}
			aria-valuemax={Math.round(totalDuration)}
			aria-valuenow={Math.round(currentTime)}
			aria-valuetext="{formatDuration(Math.round(currentTime))} of {formatDuration(
				Math.round(totalDuration)
			)}"
			onkeydown={handleSeekKeydown}
			class="focus-live min-h-[80px] rounded"
		></div>

		{#if totalDuration > 0}
			{#each markers as marker (marker.id)}
				<!-- 44px hit area around a 10px dot — the dot is the lamp, the button is the target -->
				<button
					type="button"
					class="focus-live group absolute -bottom-5 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center
						{marker.resolved ? 'opacity-40' : ''}"
					style="left: {Math.min((marker.time / totalDuration) * 100, 100)}%"
					title="{formatDuration(Math.round(marker.time))} — {marker.label}"
					aria-label="Comment at {formatDuration(Math.round(marker.time))}: {marker.label}"
					onclick={() => {
						seekTo(marker.time);
						onmarkerclick?.(marker.id);
					}}
				>
					<span
						class="block h-2.5 w-2.5 rounded-full ring-2 ring-surface-50 transition-transform group-hover:scale-125 motion-reduce:transition-none dark:ring-surface-900
							{marker.active && !marker.resolved
							? 'shadow-glow-neon scale-125 bg-neon-600 dark:bg-neon-400'
							: 'bg-accent-500 dark:bg-accent-400'}"
					></span>
				</button>
			{/each}
		{/if}

		{#if !ready}
			<div
				class="absolute inset-0 flex animate-pulse items-end justify-center gap-[3px] overflow-hidden rounded bg-surface-50/70 px-2 motion-reduce:animate-none dark:bg-surface-900/70"
				aria-hidden="true"
			>
				{#each skeletonBars as height, i (i)}
					<span
						class="w-[2px] rounded-full bg-surface-300 dark:bg-surface-600"
						style="height: {height}%"
					></span>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Transport -->
	<div class="mt-3 flex items-center gap-3">
		<button
			type="button"
			onclick={playPause}
			disabled={!ready}
			class="focus-live flex h-10 w-10 items-center justify-center rounded-full bg-accent-500 text-white shadow-sm hover:bg-accent-600 disabled:opacity-50"
			aria-label={playing ? 'Pause' : 'Play'}
		>
			{#if playing}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<rect x="6" y="4" width="4" height="16" rx="1" />
					<rect x="14" y="4" width="4" height="16" rx="1" />
				</svg>
			{:else}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
					<path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z" />
				</svg>
			{/if}
		</button>
		<span class="text-sm text-surface-600 tabular-nums dark:text-surface-300">
			{formatDuration(Math.round(currentTime))}
			<span class="text-surface-400 dark:text-surface-300">/</span>
			{formatDuration(Math.round(totalDuration))}
		</span>
	</div>
</div>
