<script lang="ts">
	import Digits from '#lib/components/ui/Digits.svelte';
	import { formatDuration } from '#lib/utils/duration.js';
	import { formatGigDate, gigCountdown } from '#lib/utils/gigDate.js';
	import { joinDetails, setlistHref, type DashboardSet } from './shared.js';

	let {
		set,
		bandName,
		today,
		dateFirst = false
	}: {
		set: DashboardSet;
		bandName: string | null;
		today: string;
		/** Coming-up rows lead with the date; other sets keep it with the venue */
		dateFirst?: boolean;
	} = $props();

	let diff = $derived(set.target_seconds ? set.totalSeconds - set.target_seconds : null);
	let details = $derived(
		joinDetails([
			set.venue,
			!dateFirst && set.gig_date && formatGigDate(set.gig_date),
			bandName,
			set.songCount === 1 ? '1 song' : `${set.songCount} songs`
		])
	);
</script>

<a
	href={setlistHref(set)}
	class="focus-live -mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-150 hover:bg-surface-100 sm:gap-4 dark:hover:bg-surface-900"
>
	{#if dateFirst && set.gig_date}
		<div class="w-22 shrink-0">
			<p class="text-sm font-medium whitespace-nowrap text-surface-900 dark:text-surface-100">
				{formatGigDate(set.gig_date)}
			</p>
			<p class="text-xs text-surface-500 dark:text-surface-300">
				{gigCountdown(set.gig_date, today)}
			</p>
		</div>
	{/if}
	<div class="min-w-0 flex-1">
		<p class="truncate font-display font-semibold text-surface-900 dark:text-surface-100">
			{set.name}
		</p>
		<p class="truncate text-xs text-surface-500 dark:text-surface-300">{details}</p>
	</div>
	<div class="w-14 shrink-0 text-right">
		<p class="text-sm font-semibold text-surface-900 dark:text-surface-100">
			<Digits value={formatDuration(set.totalSeconds)} />
		</p>
		{#if diff}
			<p
				class="text-xs font-semibold {diff > 0
					? 'text-danger-600 dark:text-danger-300'
					: 'text-success-600 dark:text-success-300'}"
			>
				<span class="sr-only">{diff > 0 ? 'Over target by' : 'Under target by'}</span>
				<span aria-hidden="true">{diff > 0 ? '+' : '-'}</span><Digits
					value={formatDuration(Math.abs(diff))}
				/>
			</p>
		{/if}
	</div>
</a>
