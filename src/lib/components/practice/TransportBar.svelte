<script lang="ts">
	import Digits from '#lib/components/ui/Digits.svelte';
	import { microLabel, reading } from './practiceStyles.js';
	import { formatDuration } from '#lib/utils/duration.js';
	import type { LoopRange } from '#lib/utils/practicePrefs.js';

	let {
		playing,
		returnOnStop = false,
		disabled = false,
		currentTime,
		duration,
		section,
		hasSections,
		canNext,
		canMark,
		loop,
		loopEnabled,
		onplaypause,
		onback,
		onforward,
		onprevious,
		onnext,
		onlooptoggle,
		onmark
	}: {
		playing: boolean;
		/** The key stops and goes back, so it reads Stop, not Pause */
		returnOnStop?: boolean;
		disabled?: boolean;
		currentTime: number;
		duration: number;
		/** Name of the section under the playhead */
		section: string | null;
		hasSections: boolean;
		canNext: boolean;
		canMark: boolean;
		loop: LoopRange | null;
		loopEnabled: boolean;
		onplaypause: () => void;
		onback: () => void;
		onforward: () => void;
		onprevious: () => void;
		onnext: () => void;
		onlooptoggle: () => void;
		onmark: () => void;
	} = $props();

	const key =
		'focus-live flex h-11 min-w-0 flex-[0_1_3rem] items-center md:w-12 md:flex-none justify-center rounded-lg border border-surface-300 bg-surface-100/60 text-surface-700 hover:border-accent-400 hover:text-accent-600 disabled:opacity-40 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-200 dark:hover:border-accent-600 dark:hover:text-accent-400';
	const stroke = {
		width: 20,
		height: 20,
		viewBox: '0 0 24 24',
		fill: 'none',
		stroke: 'currentColor',
		'stroke-width': 2,
		'stroke-linecap': 'round',
		'stroke-linejoin': 'round',
		'aria-hidden': true
	} as const;
</script>

<!-- Transport: the position, where you are in the song, and the keys to move
     through it. At the bottom, within reach of a hand off the strings. -->
<div
	class="shrink-0 border-t border-surface-200 bg-surface-50 pb-[env(safe-area-inset-bottom)] dark:border-surface-700 dark:bg-surface-900"
>
	<div class="bar">
		<div class="readings">
			<p>
				<span class="{microLabel} hidden md:block">Position</span>
				<span class="sr-only md:hidden">Position</span>
				<span class="flex items-baseline gap-1.5">
					<span class="{reading} text-base md:text-2xl">
						<Digits value={formatDuration(Math.floor(currentTime))} />
					</span>
					<span class="text-xs text-surface-500 md:text-sm dark:text-surface-300">
						/ {formatDuration(Math.round(duration))}
					</span>
				</span>
			</p>
			{#if hasSections}
				<p class="min-w-0">
					<span class="{microLabel} hidden md:block">Section</span>
					<span class="sr-only md:hidden">Section</span>
					<span
						data-testid="transport-section"
						class="block truncate text-sm font-medium md:mt-1 md:text-base md:leading-6 {section
							? 'text-surface-900 dark:text-surface-100'
							: 'text-surface-500 dark:text-surface-300'}"
					>
						{section ?? 'Unmarked'}
					</span>
				</p>
			{/if}
		</div>

		<div class="keys">
			<button
				type="button"
				onclick={onprevious}
				{disabled}
				class={key}
				aria-label={hasSections ? 'Previous section' : 'Back to the start'}
				title={hasSections ? 'Previous section (,)' : 'Back to the start (,)'}
			>
				<svg {...stroke}>
					<path d="M19 20 9 12l10-8z" fill="currentColor" />
					<path d="M5 19V5" />
				</svg>
			</button>
			<button
				type="button"
				onclick={onback}
				{disabled}
				class={key}
				aria-label="Back 5 seconds"
				title="Back 5 seconds (←)"
			>
				<svg {...stroke} width="22" height="22">
					<path d="M3 12a9 9 0 1 0 9-9 9.7 9.7 0 0 0-6.7 2.8L3 8" />
					<path d="M3 3v5h5" />
					<text
						x="12"
						y="15.5"
						text-anchor="middle"
						font-size="8.5"
						font-weight="700"
						fill="currentColor"
						stroke="none">5</text
					>
				</svg>
			</button>
			<button
				type="button"
				onclick={onplaypause}
				{disabled}
				class="focus-live flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white shadow-sm hover:bg-accent-600 disabled:opacity-50"
				aria-label={playing ? (returnOnStop ? 'Stop' : 'Pause') : 'Play'}
			>
				{#if playing && returnOnStop}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<rect x="5" y="5" width="14" height="14" rx="2" />
					</svg>
				{:else if playing}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<rect x="6" y="4" width="4" height="16" rx="1" />
						<rect x="14" y="4" width="4" height="16" rx="1" />
					</svg>
				{:else}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"
						/>
					</svg>
				{/if}
			</button>
			<button
				type="button"
				onclick={onforward}
				{disabled}
				class={key}
				aria-label="Forward 5 seconds"
				title="Forward 5 seconds (→)"
			>
				<svg {...stroke} width="22" height="22">
					<path d="M21 12a9 9 0 1 1-9-9 9.7 9.7 0 0 1 6.7 2.8L21 8" />
					<path d="M21 3v5h-5" />
					<text
						x="12"
						y="15.5"
						text-anchor="middle"
						font-size="8.5"
						font-weight="700"
						fill="currentColor"
						stroke="none">5</text
					>
				</svg>
			</button>
			<button
				type="button"
				onclick={onnext}
				disabled={disabled || !canNext}
				class={key}
				aria-label="Next section"
				title="Next section (.)"
			>
				<svg {...stroke}>
					<path d="m5 4 10 8-10 8z" fill="currentColor" />
					<path d="M19 5v14" />
				</svg>
			</button>
		</div>

		<div class="modes">
			<button
				type="button"
				onclick={onmark}
				disabled={disabled || !canMark}
				class="mark focus-live flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg border border-surface-300 px-3 text-sm font-medium text-surface-700 hover:border-accent-400 hover:text-accent-600 disabled:opacity-50 dark:border-surface-600 dark:text-surface-300 dark:hover:border-accent-600 dark:hover:text-accent-400"
				aria-label="Mark a section here"
				title="Start a new section where the song is now (S)"
			>
				<svg {...stroke} width="16" height="16">
					<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
					<path d="M4 22v-7" />
				</svg>
				<span class="hidden md:inline" aria-hidden="true">Mark</span>
			</button>
			<button
				type="button"
				onclick={onlooptoggle}
				disabled={disabled || !loop}
				aria-pressed={loopEnabled}
				aria-label="Loop"
				title={loop
					? 'Loop (L)'
					: 'Drag on the waveform, press [ and ], or pick a section to set a loop'}
				class="loop focus-live flex h-11 min-w-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 {loopEnabled
					? 'border-accent-500 bg-accent-500 text-white shadow-sm'
					: 'border-surface-300 text-surface-700 hover:border-accent-400 hover:text-accent-600 dark:border-surface-600 dark:text-surface-300 dark:hover:border-accent-600 dark:hover:text-accent-400'}"
			>
				<svg {...stroke} width="16" height="16">
					<path d="m17 2 4 4-4 4" />
					<path d="M3 11v-1a4 4 0 0 1 4-4h14" />
					<path d="m7 22-4-4 4-4" />
					<path d="M21 13v1a4 4 0 0 1-4 4H3" />
				</svg>
				<span class="hidden md:inline" aria-hidden="true">Loop</span>
				{#if loop}
					<span class="hidden text-xs opacity-80 lg:inline" data-testid="loop-range">
						{formatDuration(Math.round(loop.start))}–{formatDuration(Math.round(loop.end))}
					</span>
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	/* Phone: the readings on one line, then one row of keys with the two modes at
	   its ends. `.modes` dissolves so Loop and Mark can sit either side of the keys. */
	.bar {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		grid-template-areas:
			'readings readings readings'
			'loop keys mark';
		align-items: center;
		column-gap: 0.25rem;
		padding: 0.25rem 0.75rem 0.5rem;
	}
	.readings {
		grid-area: readings;
		display: flex;
		align-items: baseline;
		gap: 0.75rem;
		min-width: 0;
		padding: 0 0.25rem;
	}
	.keys {
		grid-area: keys;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(0rem, 1.5vw, 0.5rem);
		min-width: 0;
	}
	.modes {
		display: contents;
	}
	.loop {
		grid-area: loop;
	}
	.mark {
		grid-area: mark;
	}

	/* Wider: one row, the keys dead centre whatever sits either side of them */
	@media (min-width: 768px) {
		.bar {
			grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
			grid-template-areas: 'readings keys modes';
			column-gap: 1.5rem;
			padding: 0.5rem 1.5rem;
		}
		.readings {
			align-items: flex-start;
			gap: 1.5rem;
			padding: 0;
		}
		.keys {
			gap: 0.5rem;
		}
		.modes {
			grid-area: modes;
			display: flex;
			justify-content: flex-end;
			gap: 0.5rem;
		}
	}
</style>
