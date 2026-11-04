<script lang="ts">
	import { formatPracticeTime, weekOf } from '#lib/utils/practiceTime.js';
	import { microLabel, panel, reading } from './practiceStyles.js';

	let {
		sessions,
		quiet = false
	}: {
		sessions: { startedAt: string; seconds: number }[];
		/** Keeps the total out of the copper, on a page where another reading is the peak */
		quiet?: boolean;
	} = $props();

	let days = $derived(weekOf(sessions, new Date()));
	let total = $derived(days.reduce((sum, day) => sum + day.seconds, 0));
	let longest = $derived(Math.max(...days.map((day) => day.seconds), 1));
	const time = (seconds: number) => (seconds === 0 ? '0m' : formatPracticeTime(seconds));
	let summary = $derived(days.map((day) => `${day.name} ${time(day.seconds)}`).join(', '));
</script>

<section aria-label="Your week" class="{panel} px-4 py-3.5">
	<div class="flex items-end justify-between gap-3">
		<div>
			<h2 class={microLabel}>This week</h2>
			<p
				class="mt-1 {quiet
					? 'font-display text-2xl leading-none font-bold text-surface-900 dark:text-surface-100'
					: `${reading} text-3xl`}"
			>
				{time(total)}
			</p>
		</div>
		<div role="img" aria-label={summary} class="grid w-40 grid-cols-7 gap-1">
			{#each days as day (day.key)}
				<div class="flex flex-col items-center gap-1" title="{day.name}, {time(day.seconds)}">
					<div
						class="flex h-10 w-full items-end justify-center border-b border-surface-300 dark:border-surface-600"
					>
						{#if day.seconds > 0}
							<span
								class="w-full max-w-4 rounded-t-[4px] {day.isToday
									? 'bg-accent-600 dark:bg-accent-hot'
									: 'bg-accent-400 dark:bg-accent-500'}"
								style="height: max(3px, {(day.seconds / longest) * 100}%)"
							></span>
						{/if}
					</div>
					<span
						class="text-label leading-none tracking-normal {day.isToday
							? 'text-surface-900 dark:text-surface-100'
							: 'text-surface-500 dark:text-surface-300'}"
					>
						{day.initial}
					</span>
				</div>
			{/each}
		</div>
	</div>
</section>
