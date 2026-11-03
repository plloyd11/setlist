<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Metronome from '#lib/components/practice/Metronome.svelte';
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
	const STATUS_LABELS: Record<string, string> = {
		learning: 'Learning',
		needs_work: 'Needs work'
	};

	let minutes = $state(30);
	// The choice lives in this browser, so it can only be applied after hydration
	onMount(() => (minutes = loadSessionMinutes()));

	let steps = $derived(buildSession(data.pools, minutes));
	let totalSeconds = $derived(steps.reduce((sum, step) => sum + step.seconds, 0));
	/** Worth saying when what's planned can't fill the time you've got */
	let comesUpShort = $derived(totalSeconds < minutes * 60 * 0.75);

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
	<title>Practice — Setlist</title>
</svelte:head>

<div class="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
	<div class="min-w-0">
		{#if data.gig}
			<p
				class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
			>
				Getting ready for
			</p>
			<h2
				class="mt-1 font-display text-3xl leading-[1.1] text-balance break-words text-surface-900 md:text-4xl dark:text-surface-100"
			>
				{data.gig.name}
			</h2>
			<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
				<span class="font-medium text-accent-600 dark:text-accent-hot">
					{countdown(data.gig.date)}
				</span>
				· {[formatGigDate(data.gig.date), data.gig.venue, data.gig.bandName]
					.filter(Boolean)
					.join(' · ')}
			</p>
		{/if}

		{#if steps.length > 0}
			<section aria-label="Today's session" class={data.gig ? 'mt-6' : ''}>
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h3 class="font-display text-lg font-semibold text-surface-900 dark:text-surface-100">
						Today's session
						<span
							class="ml-1 text-sm font-normal text-surface-500 tabular-nums dark:text-surface-300"
						>
							about {formatPracticeTime(totalSeconds)}
						</span>
					</h3>
					<!-- The hero CTA: the one always-energized button on this screen -->
					<button
						type="button"
						onclick={start}
						class="focus-live rounded-lg bg-accent-hot px-6 py-3 font-display font-bold text-surface-950 shadow-glow-accent hover:brightness-105"
					>
						Start session
					</button>
				</div>
				<div
					role="group"
					aria-labelledby="session-length"
					class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2"
				>
					<span id="session-length" class="text-sm text-surface-500 dark:text-surface-300">
						How long do you have?
					</span>
					<div class="flex gap-1">
						{#each SESSION_LENGTHS as length (length)}
							<button
								type="button"
								aria-pressed={minutes === length}
								aria-label="{length} minutes"
								onclick={() => chooseMinutes(length)}
								class="focus-live h-11 w-11 rounded-lg border text-sm font-medium tabular-nums {minutes ===
								length
									? 'border-accent-500 bg-accent-500 text-white'
									: 'border-surface-300 text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800'}"
							>
								{length}
							</button>
						{/each}
					</div>
				</div>
				<ol
					class="mt-3 divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-surface-50 dark:divide-surface-700 dark:border-surface-700 dark:bg-surface-800/50"
				>
					{#each steps as step (step.key)}
						<li>
							<a
								href={step.href}
								class="focus-live flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-800"
							>
								<span class="min-w-0 flex-1">
									<span
										class="block text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
									>
										{KIND_LABELS[step.kind]}
									</span>
									<span
										class="block truncate text-sm font-medium text-surface-900 dark:text-surface-100"
									>
										{step.label}
									</span>
								</span>
								{#if step.status}
									<span
										class="shrink-0 rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-800 dark:bg-accent-900/30 dark:text-accent-400"
									>
										{STATUS_LABELS[step.status]}
									</span>
								{/if}
								{#if step.hasChart}
									<span class="sr-only">Has a chart</span>
								{/if}
								{#if step.hasAudio}
									<span class="sr-only">Has audio</span>
								{/if}
								<span class="shrink-0 text-sm text-surface-500 tabular-nums dark:text-surface-300">
									{formatPracticeTime(step.seconds)}
								</span>
							</a>
						</li>
					{/each}
				</ol>
				{#if comesUpShort}
					<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
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
			<div class={data.gig ? 'mt-6' : ''}>
				<p class="font-display text-xl text-surface-900 dark:text-surface-100">
					Nothing planned yet
				</p>
				<p class="mt-1 max-w-prose text-sm text-surface-500 dark:text-surface-300">
					Set up a warm-up, pick a technique, or mark a song you're learning, and Today builds a
					session from them.
				</p>
				<div class="mt-5 flex flex-wrap gap-2">
					<a
						href="/practice/shed"
						class="focus-live inline-block rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
					>
						Pick a song
					</a>
					<a
						href="/practice/warm-up"
						class="focus-live inline-block rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800"
					>
						Set up a warm-up
					</a>
					<a
						href="/practice/techniques"
						class="focus-live inline-block rounded-lg border border-surface-300 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800"
					>
						Browse techniques
					</a>
				</div>
			</div>
		{/if}
	</div>

	<Metronome />
</div>
