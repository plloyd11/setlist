<script lang="ts">
	import Digits from '#lib/components/ui/Digits.svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import MediaIcons from '#lib/components/practice/MediaIcons.svelte';
	import Metronome from '#lib/components/practice/Metronome.svelte';
	import SessionStrip from '#lib/components/practice/SessionStrip.svelte';
	import StatusChip from '#lib/components/practice/StatusChip.svelte';
	import WeekStrip from '#lib/components/practice/WeekStrip.svelte';
	import {
		heroButton,
		KIND_TONES,
		microLabel,
		panel,
		panelRows,
		primaryButton,
		reading,
		secondaryButton
	} from '#lib/components/practice/practiceStyles.js';
	import { daysUntil, formatGigDate } from '#lib/utils/gigDate.js';
	import { startPlan } from '#lib/utils/practicePlan.js';
	import {
		SESSION_LENGTHS,
		buildSession,
		loadSessionMinutes,
		saveSessionMinutes
	} from '#lib/utils/sessionPlan.js';
	import { formatPracticeTime } from '#lib/utils/practiceTime.js';

	let { data } = $props();

	const KIND_LABELS = { 'warm-up': 'Warm-up', technique: 'Technique', song: 'Song' };

	let minutes = $state(30);
	// The choice lives in this browser, so it can only be applied after hydration
	onMount(() => (minutes = loadSessionMinutes()));

	let steps = $derived(buildSession(data.pools, minutes));
	let totalSeconds = $derived(steps.reduce((sum, step) => sum + step.seconds, 0));
	/** Worth saying when what's planned can't fill the time you've got */
	let comesUpShort = $derived(totalSeconds < minutes * 60 * 0.75);
	let segments = $derived(
		steps.map((step) => ({
			key: step.key,
			label: step.label,
			seconds: step.seconds,
			tone: KIND_TONES[step.kind]
		}))
	);
	/** The step being pointed at or focused, so its slice of the strip stands out */
	let pointedAt = $state<string | null>(null);

	function chooseMinutes(value: number) {
		minutes = value;
		saveSessionMinutes(value);
	}

	function countdown(date: string): string {
		const days = daysUntil(date);
		if (days <= 0) return 'Today';
		return days === 1 ? 'Tomorrow' : `In ${days} days`;
	}

	function start() {
		startPlan(steps.map((step) => ({ href: step.href, label: step.label })));
		goto(steps[0].href);
	}
</script>

<svelte:head>
	<title>Practice · Setlist</title>
</svelte:head>

<div class="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
	<div class="min-w-0">
		{#if data.gig}
			<div class="mb-5">
				<p class={microLabel}>Getting ready for</p>
				<h2
					class="mt-1 font-display text-2xl leading-tight font-bold text-balance break-words text-surface-900 dark:text-surface-100"
				>
					{data.gig.name}
				</h2>
				<p class="mt-1 text-sm text-surface-500 dark:text-surface-300">
					<span class="font-medium text-accent-600 dark:text-accent-hot">
						{countdown(data.gig.date)}
					</span>
					· {[formatGigDate(data.gig.date), data.gig.venue, data.gig.bandName]
						.filter(Boolean)
						.join(' · ')}
				</p>
			</div>
		{/if}

		{#if steps.length > 0}
			<section aria-label="Today's session" class="{panel} overflow-hidden">
				<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4 md:p-5">
					<div>
						<h2 class={microLabel}>Today's session</h2>
						<p class="mt-1.5 {reading} text-4xl">{formatPracticeTime(totalSeconds)}</p>
					</div>
					<!-- The hero CTA: the one always-energized button on this screen -->
					<button type="button" onclick={start} class="{heroButton} grow sm:grow-0">
						Start session
					</button>
				</div>

				<div
					role="group"
					aria-labelledby="session-length"
					class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 md:px-5"
				>
					<span id="session-length" class="text-sm text-surface-500 dark:text-surface-300">
						How many minutes do you have?
					</span>
					<div class="flex w-full sm:w-auto">
						{#each SESSION_LENGTHS as length (length)}
							<button
								type="button"
								aria-pressed={minutes === length}
								aria-label="{length} minutes"
								onclick={() => chooseMinutes(length)}
								class="focus-live relative -ml-px h-11 min-w-11 flex-1 border text-sm font-medium transition-colors duration-150 first:ml-0 first:rounded-l-lg last:rounded-r-lg focus-visible:z-10 sm:w-12 sm:flex-none {minutes ===
								length
									? 'z-[1] border-accent-500 bg-accent-500 text-white'
									: 'border-surface-300 text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-700'}"
							>
								{length}
							</button>
						{/each}
					</div>
				</div>

				<div class="p-4 md:px-5">
					<SessionStrip {segments} label="How the session splits" highlight={pointedAt} />
				</div>

				<ol class="{panelRows} border-t border-surface-200 dark:border-surface-700">
					{#each steps as step, i (step.key)}
						{@const startsKind = steps[i - 1]?.kind !== step.kind}
						<li>
							<a
								href={step.href}
								onpointerenter={() => (pointedAt = step.key)}
								onpointerleave={() => (pointedAt = null)}
								onfocus={() => (pointedAt = step.key)}
								onblur={() => (pointedAt = null)}
								class="focus-inset flex min-h-13 items-center gap-3 px-4 py-2.5 transition-[background-color] duration-150 hover:bg-surface-100 md:px-5 dark:hover:bg-surface-700/50"
							>
								<span
									class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold {KIND_TONES[
										step.kind
									]}"
									aria-hidden="true"
								>
									{i + 1}
								</span>
								<span class="min-w-0 flex-1">
									{#if startsKind || step.status}
										<span class="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
											<span class={startsKind ? microLabel : 'sr-only'}>
												{KIND_LABELS[step.kind]}
											</span>
											{#if step.status}
												<StatusChip status={step.status} />
											{/if}
										</span>
									{:else}
										<span class="sr-only">{KIND_LABELS[step.kind]}</span>
									{/if}
									<span
										class="block truncate text-sm font-medium text-surface-900 dark:text-surface-100"
									>
										{step.label}
									</span>
								</span>
								<MediaIcons hasChart={step.hasChart} hasAudio={step.hasAudio} />
								<span
									class="min-w-10 shrink-0 text-right text-sm font-medium text-surface-700 dark:text-surface-200"
								>
									<Digits value={formatPracticeTime(step.seconds)} />
								</span>
							</a>
						</li>
					{/each}
				</ol>
				{#if comesUpShort}
					<p
						class="border-t border-surface-200 px-4 py-3 text-sm text-surface-500 md:px-5 dark:border-surface-700 dark:text-surface-300"
					>
						That's everything you have lined up. Add a <a
							href="/practice/techniques"
							class="focus-live underline hover:text-surface-700 dark:hover:text-surface-100"
							>technique</a
						>
						or flag a song in
						<a
							href="/practice/shed"
							class="focus-live underline hover:text-surface-700 dark:hover:text-surface-100"
							>Shed</a
						> to fill the rest.
					</p>
				{/if}
			</section>
		{:else}
			<div class="{panel} p-4 md:p-5">
				<p class="font-display text-xl text-surface-900 dark:text-surface-100">
					Nothing planned yet
				</p>
				<p class="mt-1 max-w-prose text-sm text-surface-500 dark:text-surface-300">
					Set up a warm-up, pick a technique, or mark a song you're learning, and Today builds a
					session from them.
				</p>
				<div class="mt-4 flex flex-wrap gap-2">
					<a href="/practice/shed" class="{primaryButton} inline-flex items-center">
						Pick a song
					</a>
					<a href="/practice/warm-up" class="{secondaryButton} inline-flex items-center">
						Set up a warm-up
					</a>
					<a href="/practice/techniques" class="{secondaryButton} inline-flex items-center">
						Browse techniques
					</a>
				</div>
			</div>
		{/if}
	</div>

	<div class="flex min-w-0 flex-col gap-4">
		<Metronome />
		{#if data.week.length > 0}
			<WeekStrip sessions={data.week} />
		{/if}
	</div>
</div>
