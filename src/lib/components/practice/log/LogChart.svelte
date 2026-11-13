<script lang="ts">
	import { KIND_TONES } from '#lib/components/practice/practiceStyles.js';
	import { formatPracticeTime } from '#lib/utils/practiceTime.js';
	import {
		LOG_KINDS,
		bucketLabels,
		formatAxisTime,
		logHref,
		secondsOf,
		timeAxis,
		type LogBucket,
		type LogKind,
		type LogRange
	} from '#lib/utils/practiceLog.js';

	let {
		range,
		buckets,
		kind = null,
		pointed = $bindable(null)
	}: {
		range: LogRange;
		buckets: LogBucket[];
		/** Draws one kind on its own, from the baseline, so its shape can be read */
		kind?: LogKind | null;
		/** The bucket under the pointer or with focus, for the readout beside the chart */
		pointed?: string | null;
	} = $props();

	let bars = $derived(
		buckets.map((bucket) => {
			const day = Number(bucket.date.slice(8));
			return {
				...bucket,
				...bucketLabels(range, bucket),
				total: secondsOf(bucket.seconds, kind),
				segments: (kind ? [kind] : LOG_KINDS)
					.filter((k) => bucket.seconds[k] > 0)
					.map((k) => ({ kind: k, seconds: bucket.seconds[k] })),
				// A month's worth of numbers won't fit on a phone: one a week does
				sparse: range === 'month' && (day - 1) % 7 !== 0,
				// A month with practice in it opens, whatever kind is being shown
				href:
					range === 'year' && secondsOf(bucket.seconds, null) > 0
						? logHref('month', bucket.date)
						: null
			};
		})
	);
	let axis = $derived(timeAxis(Math.max(0, ...bars.map((bar) => bar.total))));
	let opens = $derived(bars.some((bar) => bar.href));

	const time = (seconds: number) => (seconds === 0 ? '0m' : formatPracticeTime(seconds));
	// A week reads out whole. Anything longer names only what was practiced.
	let summary = $derived.by(() => {
		const said = range === 'week' ? bars : bars.filter((bar) => bar.total > 0);
		return said.length > 0
			? said.map((bar) => `${bar.name} ${time(bar.total)}`).join(', ')
			: 'No practice';
	});

	const bucketAt = (event: Event) =>
		(event.target as Element | null)?.closest<HTMLElement>('[data-bucket]')?.dataset.bucket ?? null;

	// A mouse points as it moves. A finger has no hover, so a tap holds the readout
	// on a bar until the next tap.
	function onpointermove(event: PointerEvent) {
		if (event.pointerType !== 'touch') pointed = bucketAt(event);
	}
	function onpointerleave(event: PointerEvent) {
		if (event.pointerType !== 'touch') pointed = null;
	}
	function onpointerdown(event: PointerEvent) {
		if (event.pointerType !== 'touch') return;
		const bucket = bucketAt(event);
		pointed = pointed === bucket ? null : bucket;
	}
</script>

{#snippet stack(bar: (typeof bars)[number])}
	{#if bar.total > 0}
		<span
			class="flex w-full max-w-6 flex-col-reverse gap-0.5"
			style="height: max(3px, {(bar.total / axis.top) * 100}%)"
		>
			{#each bar.segments as segment (segment.kind)}
				<span
					class="min-h-0.5 last:rounded-t-[4px] {KIND_TONES[segment.kind]}"
					style="flex: {segment.seconds} 1 0"
				></span>
			{/each}
		</span>
	{/if}
{/snippet}

<div class="@container pt-2 pl-10">
	<!-- Pointing only fills in the readout: everything it says is in the chart's own
	     label and the sessions below, so the wrapper itself is nothing to a screen reader -->
	<div
		role="presentation"
		class="relative h-36 md:h-44"
		{onpointermove}
		{onpointerleave}
		{onpointerdown}
		onfocusin={(event) => (pointed = bucketAt(event))}
		onfocusout={() => (pointed = null)}
	>
		{#each axis.ticks as tick (tick)}
			<div
				aria-hidden="true"
				class="absolute inset-x-0 border-t border-surface-200 dark:border-surface-700"
				style="bottom: {(tick / axis.top) * 100}%"
			>
				<span
					class="absolute right-full mr-2 -translate-y-1/2 text-label leading-none tracking-normal whitespace-nowrap text-surface-500 dark:text-surface-300"
				>
					{formatAxisTime(tick)}
				</span>
			</div>
		{/each}

		<div
			role={opens ? 'list' : 'img'}
			aria-label={opens ? 'Months' : summary}
			class="absolute inset-0 flex border-b border-surface-300 dark:border-surface-600"
		>
			{#each bars as bar (bar.key)}
				{@const slot = `flex h-full min-w-0 flex-1 items-end justify-center rounded-t-md px-px transition-[background-color] duration-150 ${
					pointed === bar.key ? 'bg-surface-200/70 dark:bg-surface-700/60' : ''
				}`}
				{#if bar.href}
					<div role="listitem" class="flex min-w-0 flex-1">
						<a
							href={bar.href}
							data-bucket={bar.key}
							data-sveltekit-noscroll
							data-sveltekit-replacestate
							aria-label="{bar.name}, {time(bar.total)}. Open the month."
							class="focus-inset {slot}"
						>
							{@render stack(bar)}
						</a>
					</div>
				{:else}
					<div
						data-bucket={bar.key}
						role={opens ? 'listitem' : undefined}
						aria-label={opens ? `${bar.name}, ${time(bar.total)}` : undefined}
						class={slot}
					>
						{@render stack(bar)}
					</div>
				{/if}
			{/each}
		</div>
	</div>

	<div aria-hidden="true" class="mt-1.5 flex">
		{#each bars as bar (bar.key)}
			<span
				class="flex min-w-0 flex-1 justify-center text-label leading-none tracking-normal whitespace-nowrap {bar.isToday
					? 'font-bold text-surface-900 dark:text-surface-100'
					: 'text-surface-500 dark:text-surface-300'}"
			>
				<span class={bar.sparse ? 'hidden @xl:inline' : ''}>{bar.axis}</span>
			</span>
		{/each}
	</div>
</div>
