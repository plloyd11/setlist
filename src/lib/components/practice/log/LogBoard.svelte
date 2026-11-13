<script lang="ts">
	import SessionStrip from '#lib/components/practice/SessionStrip.svelte';
	import {
		KIND_TONES,
		microLabel,
		panel,
		reading
	} from '#lib/components/practice/practiceStyles.js';
	import { formatPracticeTime } from '#lib/utils/practiceTime.js';
	import {
		KIND_NAMES,
		LOG_KINDS,
		LOG_RANGES,
		bucketLabels,
		bucketsOf,
		daysElapsed,
		logHref,
		noSeconds,
		periodTitle,
		secondsOf,
		shortDay,
		type LogKind,
		type LogSummary
	} from '#lib/utils/practiceLog.js';
	import LogChart from './LogChart.svelte';

	let {
		log,
		kind = $bindable(null),
		loading = false
	}: {
		log: LogSummary;
		/** One kind on its own, across the board and everything under it. Null is all three. */
		kind?: LogKind | null;
		/** Another period is on its way: the frame holds, dimmed, until it lands */
		loading?: boolean;
	} = $props();

	const RANGE_NAMES = { week: 'Week', month: 'Month', year: 'Year' };

	let period = $derived(log.period);
	let range = $derived(period.range);
	let heading = $derived(periodTitle(period, log.today));
	let buckets = $derived(bucketsOf(period, log.days, log.today));

	let totals = $derived.by(() => {
		const sum = noSeconds();
		for (const day of log.days) for (const k of LOG_KINDS) sum[k] += day.seconds[k];
		return sum;
	});
	let everything = $derived(secondsOf(totals, null));
	let total = $derived(secondsOf(totals, kind));

	let practiced = $derived(log.days.filter((day) => secondsOf(day.seconds, kind) > 0));
	let elapsed = $derived(daysElapsed(period, log.today));
	let longest = $derived(
		practiced.reduce<(typeof practiced)[number] | null>(
			(best, day) =>
				!best || secondsOf(day.seconds, kind) > secondsOf(best.seconds, kind) ? day : best,
			null
		)
	);

	const time = (seconds: number) => (seconds === 0 ? '0m' : formatPracticeTime(seconds));

	/** One plain sentence on how the period stands, as on the gig board */
	let standing = $derived.by(() => {
		const when = `${period.isCurrent ? 'this' : 'that'} ${range}`;
		if (total === 0) {
			return kind
				? `No ${KIND_NAMES[kind].toLowerCase()} logged ${when}.`
				: `Nothing logged ${when}.`;
		}
		const before = secondsOf(log.previous, kind);
		if (before === 0) return null;
		const gap = total - before;
		const amount = formatPracticeTime(Math.abs(gap));
		if (period.isCurrent) {
			if (Math.abs(gap) < 60) return `Level with this point last ${range}.`;
			return `${amount} ${gap > 0 ? 'ahead of' : 'behind'} this point last ${range}.`;
		}
		if (Math.abs(gap) < 60) return `The same as the ${range} before.`;
		return `${amount} ${gap > 0 ? 'more' : 'less'} than the ${range} before.`;
	});

	let pointed = $state<string | null>(null);
	let pointedAt = $derived.by(() => {
		const bucket = buckets.find((b) => b.key === pointed);
		if (!bucket) return null;
		return {
			name: bucketLabels(range, bucket).name,
			total: secondsOf(bucket.seconds, kind),
			kinds: (kind ? [] : LOG_KINDS).filter((k) => bucket.seconds[k] > 0),
			seconds: bucket.seconds
		};
	});

	let segments = $derived(
		LOG_KINDS.filter((k) => totals[k] > 0).map((k) => ({
			key: k,
			label: KIND_NAMES[k],
			seconds: totals[k],
			tone: KIND_TONES[k]
		}))
	);

	// Nothing earlier to page back to once the first session is on screen
	let hasEarlier = $derived(!!log.earliest && log.earliest < period.start);
	// Switching range keeps you where you'd paged to
	const at = () => (period.isCurrent ? undefined : period.start);

	const stepButton =
		'focus-live flex h-9 w-9 items-center justify-center rounded-lg border border-surface-300 text-surface-700 transition-colors duration-150 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-200 dark:hover:bg-surface-700 pointer-coarse:h-11 pointer-coarse:w-11';
	const stepOff =
		'flex h-9 w-9 items-center justify-center rounded-lg border border-surface-200 text-surface-300 dark:border-surface-700 dark:text-surface-600 pointer-coarse:h-11 pointer-coarse:w-11';
	const smallReading =
		'font-display text-xl leading-none font-bold text-surface-900 dark:text-surface-100';
	const aside = 'text-xs font-normal text-surface-500 dark:text-surface-300';
</script>

{#snippet chevron(d: string)}
	<svg viewBox="0 0 16 16" class="h-4 w-4" fill="none" aria-hidden="true">
		<path
			{d}
			stroke="currentColor"
			stroke-width="1.75"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	</svg>
{/snippet}

<div class="{panel} overflow-hidden">
	<section aria-label="Your {range}" class="p-4 md:p-5">
		<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
			<div class="min-w-0">
				<h2
					class="font-display text-xl leading-tight font-semibold text-surface-900 dark:text-surface-100"
				>
					{heading.title}
				</h2>
				{#if heading.detail}
					<p class="mt-0.5 text-sm text-surface-500 dark:text-surface-300">{heading.detail}</p>
				{/if}
			</div>

			<div class="flex w-full items-center justify-between gap-3 sm:w-auto">
				<nav aria-label="Range" class="flex">
					{#each LOG_RANGES as option (option)}
						<a
							href={logHref(option, at())}
							aria-current={range === option ? 'page' : undefined}
							data-sveltekit-noscroll
							data-sveltekit-replacestate
							data-sveltekit-keepfocus
							class="focus-live relative -ml-px flex h-9 items-center border px-3.5 text-sm font-medium transition-colors duration-150 first:ml-0 first:rounded-l-lg last:rounded-r-lg focus-visible:z-10 pointer-coarse:h-11 {range ===
							option
								? 'z-[1] border-accent-500 bg-accent-500 text-white'
								: 'border-surface-300 text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-700'}"
						>
							{RANGE_NAMES[option]}
						</a>
					{/each}
				</nav>

				<div class="flex items-center gap-1.5">
					{#if !period.isCurrent}
						<a
							href={logHref(range)}
							data-sveltekit-noscroll
							data-sveltekit-replacestate
							class="focus-live hit-44 mr-1.5 rounded-md text-sm font-medium text-accent-600 hover:underline dark:text-accent-300"
						>
							This {range}
						</a>
					{/if}
					{#if hasEarlier}
						<a
							href={logHref(range, period.previous)}
							aria-label="The {range} before"
							data-sveltekit-noscroll
							data-sveltekit-replacestate
							data-sveltekit-keepfocus
							class={stepButton}
						>
							{@render chevron('M10 3.5 5.5 8l4.5 4.5')}
						</a>
					{:else}
						<span class={stepOff}>{@render chevron('M10 3.5 5.5 8l4.5 4.5')}</span>
					{/if}
					{#if period.next}
						<a
							href={logHref(range, period.next)}
							aria-label="The {range} after"
							data-sveltekit-noscroll
							data-sveltekit-replacestate
							data-sveltekit-keepfocus
							class={stepButton}
						>
							{@render chevron('M6 3.5 10.5 8 6 12.5')}
						</a>
					{:else}
						<span class={stepOff}>{@render chevron('M6 3.5 10.5 8 6 12.5')}</span>
					{/if}
				</div>
			</div>
		</div>

		<div class="transition-opacity duration-150 {loading ? 'opacity-50' : ''}">
			<dl class="mt-5 flex flex-wrap items-end gap-x-8 gap-y-4">
				<div class="w-full sm:w-auto">
					<dt class={microLabel}>{kind ? KIND_NAMES[kind] : 'Practiced'}</dt>
					<dd class="mt-1.5 {reading} text-4xl">{time(total)}</dd>
				</div>
				<div>
					<dt class={microLabel}>Days</dt>
					<dd class="mt-1.5 {smallReading}">
						{practiced.length} <span class={aside}>of {elapsed}</span>
					</dd>
				</div>
				<div>
					<dt class={microLabel}>Average day</dt>
					<dd class="mt-1.5 {smallReading}">
						{practiced.length > 0 ? time(total / practiced.length) : '0m'}
					</dd>
				</div>
				<div>
					<dt class={microLabel}>Longest day</dt>
					<dd class="mt-1.5 {smallReading}">
						{#if longest}
							{time(secondsOf(longest.seconds, kind))}
							<span class={aside}>{shortDay(range, longest.date)}</span>
						{:else}
							0m
						{/if}
					</dd>
				</div>
			</dl>

			<!-- One line, two jobs: how the period stands, or the bar being pointed at.
			     Its height is held, so pointing never moves the chart. -->
			<p
				class="mt-4 flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-surface-500 sm:min-h-5 dark:text-surface-300"
			>
				{#if pointedAt}
					<span class="font-medium text-surface-900 dark:text-surface-100">{pointedAt.name}</span>
					<span class="font-semibold text-surface-900 dark:text-surface-100">
						{time(pointedAt.total)}
					</span>
					{#each pointedAt.kinds as k (k)}
						<span class="inline-flex items-center gap-1.5">
							<span class="h-2.5 w-2.5 rounded-[2px] {KIND_TONES[k]}" aria-hidden="true"></span>
							{KIND_NAMES[k]}
							{time(pointedAt.seconds[k])}
						</span>
					{/each}
				{:else if standing}
					{standing}
				{/if}
			</p>

			<div class="mt-3">
				<LogChart {range} {buckets} {kind} bind:pointed />
			</div>
		</div>
	</section>

	<section
		aria-label="By type"
		class="@container border-t border-surface-200 p-4 transition-opacity duration-150 md:p-5 dark:border-surface-700 {loading
			? 'opacity-50'
			: ''}"
	>
		<div class="flex min-h-5 items-center justify-between gap-3">
			<h3 class={microLabel}>By type</h3>
			{#if kind}
				<button
					type="button"
					onclick={() => (kind = null)}
					class="focus-live rounded-md text-sm font-medium text-accent-600 hover:underline dark:text-accent-300"
				>
					All types
				</button>
			{/if}
		</div>
		<div class="mt-2.5">
			{#if segments.length > 0}
				<SessionStrip {segments} label="How the time splits" highlight={kind} />
			{:else}
				<div class="h-2.5 rounded-full bg-surface-200 dark:bg-surface-700"></div>
			{/if}
		</div>
		<!-- The legend is the filter: press a type to see it on its own -->
		<!-- Three across needs the board's own width, not the window's: beside the rail on
		     a tablet the board is no wider than a phone -->
		<div class="mt-3 grid gap-2 @xl:grid-cols-3">
			{#each LOG_KINDS as k (k)}
				<button
					type="button"
					aria-pressed={kind === k}
					onclick={() => (kind = kind === k ? null : k)}
					class="focus-live flex min-h-11 items-center gap-2.5 rounded-lg border px-3 text-left text-sm transition-colors duration-150 {kind ===
					k
						? 'border-accent-500 bg-surface-100 dark:border-accent-400 dark:bg-surface-700'
						: 'border-surface-200 hover:bg-surface-100 dark:border-surface-700 dark:hover:bg-surface-700/50'}"
				>
					<span class="h-3 w-3 shrink-0 rounded-[3px] {KIND_TONES[k]}" aria-hidden="true"></span>
					<span class="min-w-0 flex-1 truncate font-medium text-surface-900 dark:text-surface-100">
						{KIND_NAMES[k]}
					</span>
					<span class="shrink-0 font-semibold text-surface-900 dark:text-surface-100">
						{time(totals[k])}
					</span>
					{#if everything > 0}
						<span class="w-9 shrink-0 text-right text-xs text-surface-500 dark:text-surface-300">
							{Math.round((totals[k] / everything) * 100)}%
						</span>
					{/if}
				</button>
			{/each}
		</div>
	</section>
</div>
