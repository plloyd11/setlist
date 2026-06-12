<script lang="ts">
	import type WaveSurfer from 'wavesurfer.js';
	import type RegionsPlugin from 'wavesurfer.js/plugins/regions';
	import type { Region } from 'wavesurfer.js/plugins/regions';
	import { formatDuration } from '$lib/utils/duration';
	import { PRE_ROLL_SECONDS } from '$lib/utils/practicePrefs';

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
		practice = false,
		ontimeupdate,
		onmarkerclick,
		onloaderror,
		onready,
		onfinish,
		onplaystatechange,
		onregionchange
	}: {
		url: string;
		peaks?: number[] | null;
		duration?: number | null;
		markers?: WaveformMarker[];
		/** Enables the DAW practice surface: loop region drag-selection + skip buttons */
		practice?: boolean;
		ontimeupdate?: (time: number) => void;
		onmarkerclick?: (id: string) => void;
		onloaderror?: () => void;
		onready?: () => void;
		onfinish?: () => void;
		onplaystatechange?: (playing: boolean) => void;
		/** Practice mode: the user dragged or resized the loop region */
		onregionchange?: (region: { start: number; end: number } | null) => void;
	} = $props();

	const MIN_LOOP_SECONDS = 0.5;

	let container: HTMLDivElement;
	let ws: WaveSurfer | null = null;
	let regions: RegionsPlugin | null = null;
	let loopRegion: Region | null = null;
	let loopEnabled = $state(false);
	let preRollOn = false;
	let lastTick = 0;
	let ready = $state(false);
	let playing = $state(false);
	let currentTime = $state(0);
	let totalDuration = $state(0);
	let lastEmitted = 0;

	function themeColor(name: string, fallback: string): string {
		const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		return value || fallback;
	}

	// Armed loop = live signal (chartreuse, like the playhead cursor); a parked
	// region is just surface-toned. Tokens are hex-6, so alpha appends as hex-8.
	function regionColor(active: boolean): string {
		return active
			? themeColor('--color-neon-400', '#bbc92a') + '2e'
			: themeColor('--color-surface-400', '#5a7190') + '26';
	}

	function loopJumpTarget(): number {
		if (!loopRegion) return 0;
		return Math.max(0, loopRegion.start - (preRollOn ? PRE_ROLL_SECONDS : 0));
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
		let disableDragSelection: (() => void) | null = null;

		(async () => {
			const [{ default: WaveSurferCtor }, regionsModule] = await Promise.all([
				import('wavesurfer.js'),
				practice ? import('wavesurfer.js/plugins/regions') : Promise.resolve(null)
			]);
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

			if (regionsModule) {
				regions = instance.registerPlugin(regionsModule.default.create());
				// 3px threshold: plain clicks still fall through to click-to-seek
				disableDragSelection = regions.enableDragSelection(
					{ color: regionColor(loopEnabled), minLength: MIN_LOOP_SECONDS },
					3
				);
				regions.on('region-created', (region) => {
					// Single-region rule: the newest drag wins
					regions?.getRegions().forEach((r) => {
						if (r !== region) r.remove();
					});
					loopRegion = region;
					region.setOptions({ color: regionColor(loopEnabled) });
					onregionchange?.({ start: region.start, end: region.end });
				});
				regions.on('region-updated', (region) => {
					onregionchange?.({ start: region.start, end: region.end });
				});
			}

			instance.on('ready', (d: number) => {
				ready = true;
				if (d > 0) totalDuration = d;
				onready?.();
			});
			instance.on('play', () => {
				playing = true;
				onplaystatechange?.(true);
			});
			instance.on('pause', () => {
				playing = false;
				onplaystatechange?.(false);
			});
			instance.on('finish', () => {
				// A loop whose B point sits at the end of the file can hit the media
				// 'ended' event before the tick check below — re-arm instead of stopping
				if (loopEnabled && loopRegion && loopRegion.end >= totalDuration - 0.1) {
					instance?.setTime(loopJumpTarget());
					void instance?.play().catch(() => {});
					return;
				}
				playing = false;
				onfinish?.();
			});
			instance.on('timeupdate', (t: number) => {
				// Loop engine: jump back only on a *natural* crossing of B (previous
				// tick before B, forward delta of ~one frame) — user seeks past B are
				// left alone and re-trap on the next pass
				if (
					loopEnabled &&
					loopRegion &&
					playing &&
					t >= loopRegion.end &&
					lastTick < loopRegion.end &&
					t - lastTick < 0.35
				) {
					instance?.setTime(loopJumpTarget());
				}
				lastTick = t;
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
			disableDragSelection?.();
			instance?.destroy();
			ws = null;
			regions = null;
			loopRegion = null;
		};
	});

	export function seekTo(time: number) {
		ws?.setTime(time);
		currentTime = time;
		ontimeupdate?.(time);
	}

	// DAW semantics: pre-roll plays on every transport start into the armed
	// loop, not just on the wrap — pressing play inside the region rewinds to
	// the lead-in so your hands are ready when the section hits.
	function applyPreRollOnPlayStart() {
		if (
			!playing &&
			loopEnabled &&
			preRollOn &&
			loopRegion &&
			currentTime >= loopRegion.start &&
			currentTime <= loopRegion.end
		) {
			ws?.setTime(loopJumpTarget());
		}
	}

	export function playPause() {
		applyPreRollOnPlayStart();
		void ws?.playPause();
	}

	/** Returns false when playback was blocked (browser autoplay policy). */
	export async function play(): Promise<boolean> {
		try {
			applyPreRollOnPlayStart();
			await ws?.play();
			return true;
		} catch {
			return false;
		}
	}

	export function pause() {
		ws?.pause();
	}

	export function getCurrentTime(): number {
		return currentTime;
	}

	export function getDuration(): number {
		return totalDuration;
	}

	export function setVolume(v: number) {
		ws?.setVolume(Math.min(1, Math.max(0, v)));
	}

	export function setPlaybackRate(rate: number) {
		// preservePitch always — slowing down for practice must stay in key
		ws?.setPlaybackRate(rate, true);
	}

	/** Create, move, or remove the single practice loop region. */
	export function setLoop(range: { start: number; end: number } | null) {
		if (!regions) return;
		if (!range) {
			loopRegion?.remove();
			loopRegion = null;
			return;
		}
		const end = Math.min(range.end, totalDuration || range.end);
		const start = Math.max(0, Math.min(range.start, end - MIN_LOOP_SECONDS));
		if (loopRegion) {
			loopRegion.setOptions({ start, end });
		} else {
			// Triggers region-created, which stores the ref and echoes onregionchange
			regions.addRegion({
				start,
				end,
				color: regionColor(loopEnabled),
				minLength: MIN_LOOP_SECONDS
			});
		}
	}

	export function setLoopEnabled(enabled: boolean) {
		loopEnabled = enabled;
		loopRegion?.setOptions({ color: regionColor(enabled) });
		// Arming from outside the region jumps in — "L" means "trap me in the loop"
		if (enabled && loopRegion && (currentTime < loopRegion.start || currentTime > loopRegion.end)) {
			seekTo(loopJumpTarget());
		}
	}

	export function setPreRoll(enabled: boolean) {
		preRollOn = enabled;
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
			class="focus-live waveform-region-host min-h-[80px] rounded {loopEnabled
				? 'loop-active'
				: ''}"
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
							? 'scale-125 bg-neon-600 shadow-glow-neon dark:bg-neon-400'
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
		{#if practice}
			<button
				type="button"
				onclick={() => seekTo(Math.max(0, currentTime - 5))}
				disabled={!ready}
				class="focus-live flex h-11 w-11 items-center justify-center rounded-full text-surface-600 hover:bg-surface-100 disabled:opacity-50 dark:text-surface-300 dark:hover:bg-surface-800"
				aria-label="Back 5 seconds"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M3 12a9 9 0 1 0 9-9 9.7 9.7 0 0 0-6.7 2.8L3 8" />
					<path d="M3 3v5h5" />
				</svg>
			</button>
		{/if}
		<button
			type="button"
			onclick={playPause}
			disabled={!ready}
			class="focus-live flex h-11 w-11 items-center justify-center rounded-full bg-accent-500 text-white shadow-sm hover:bg-accent-600 disabled:opacity-50"
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
		{#if practice}
			<button
				type="button"
				onclick={() => seekTo(Math.min(totalDuration, currentTime + 5))}
				disabled={!ready}
				class="focus-live flex h-11 w-11 items-center justify-center rounded-full text-surface-600 hover:bg-surface-100 disabled:opacity-50 dark:text-surface-300 dark:hover:bg-surface-800"
				aria-label="Forward 5 seconds"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M21 12a9 9 0 1 1-9-9 9.7 9.7 0 0 1 6.7 2.8L21 8" />
					<path d="M21 3v5h-5" />
				</svg>
			</button>
		{/if}
		<span class="text-sm text-surface-600 tabular-nums dark:text-surface-300">
			{formatDuration(Math.round(currentTime))}
			<span class="text-surface-400 dark:text-surface-300">/</span>
			{formatDuration(Math.round(totalDuration))}
		</span>
	</div>
</div>

<style>
	/* Region resize handles ship with inline rgba(0,0,0,.5) borders — invisible
	   on navy. The shadow root is open, so ::part can restyle them (inline
	   styles need !important). Armed loop lights the handles chartreuse. */
	:global(.waveform-region-host > div::part(region-handle)) {
		border-color: color-mix(in srgb, var(--color-surface-400) 80%, transparent) !important;
	}
	:global(.waveform-region-host.loop-active > div::part(region-handle)) {
		border-color: var(--color-neon-400) !important;
	}
</style>
