<script lang="ts">
	import Digits from '#lib/components/ui/Digits.svelte';
	import { formatDuration } from '#lib/utils/duration.js';
	import { formatPracticeTime } from '#lib/utils/practiceTime.js';
	import type { PracticeTracker } from './practiceTracker.svelte.js';

	/**
	 * The practice clock: time on this item, and the day's total under it. It waits to be
	 * started, so the button reads as an action until it's running, and the reading stays
	 * out of the copper until it counts.
	 */
	let { tracker }: { tracker: PracticeTracker } = $props();

	let action = $derived(
		!tracker.paused ? 'Pause clock' : tracker.seconds >= 1 ? 'Resume' : 'Start clock'
	);
	let today = $derived(tracker.today);
</script>

<div class="flex shrink-0 items-center gap-2">
	<p class="text-right" aria-live="off">
		<span class="sr-only">Practiced </span>
		<span
			data-testid="practice-clock"
			class="font-display text-lg leading-tight font-bold md:text-xl {tracker.paused
				? 'text-surface-500 dark:text-surface-300'
				: 'text-accent-600 dark:text-accent-hot'}"
		>
			<Digits value={formatDuration(Math.floor(tracker.seconds))} />
		</span>
		{#if today !== null}
			<span class="sr-only">, </span>
			<span
				data-testid="practice-today"
				class="block text-label leading-tight whitespace-nowrap text-surface-500 uppercase dark:text-surface-300"
			>
				Today <Digits value={today < 1 ? '0m' : formatPracticeTime(today)} />
			</span>
		{/if}
	</p>
	<button
		type="button"
		onclick={() => tracker.togglePause()}
		data-practice-clock-button
		class="focus-live min-h-11 rounded-lg border px-3 text-sm font-medium whitespace-nowrap transition-colors duration-150 {tracker.paused
			? 'border-surface-300 text-surface-800 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-100 dark:hover:bg-surface-700'
			: 'border-transparent text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800'}"
	>
		{action}
	</button>
</div>
