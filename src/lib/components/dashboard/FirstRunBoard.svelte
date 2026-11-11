<script lang="ts">
	import { heroButton, microLabel, panel } from '#lib/components/practice/practiceStyles.js';
	import { formatRunTime } from '#lib/utils/duration.js';

	let { songCount, librarySeconds }: { songCount: number; librarySeconds: number } = $props();

	let hasSongs = $derived(songCount > 0);
</script>

<!-- One step in the signal chain: a lamp reports its state (lamp-live is in layout.css) -->
{#snippet chainStep(state: 'done' | 'live' | 'next', label: string, sub: string)}
	<li class="flex items-start gap-2.5">
		{#if state === 'done'}
			<span class="mt-[3px] h-2 w-2 shrink-0 rounded-full bg-accent-500 dark:bg-accent-400"></span>
		{:else if state === 'live'}
			<span class="lamp-live mt-[3px] h-2 w-2 shrink-0 rounded-full bg-neon-600 dark:bg-neon-400"
			></span>
		{:else}
			<span
				class="mt-[3px] h-2 w-2 shrink-0 rounded-full border border-surface-300 dark:border-surface-600"
			></span>
		{/if}
		<div class="min-w-0">
			<p
				class="text-label uppercase {state === 'next'
					? 'text-surface-500 dark:text-surface-300'
					: 'text-surface-900 dark:text-surface-100'}"
			>
				<span class="sr-only">
					{state === 'done' ? 'Done: ' : state === 'live' ? 'Current step: ' : 'Coming up: '}
				</span>
				{label}
			</p>
			<p class="mt-0.5 text-xs text-surface-500 dark:text-surface-300">{sub}</p>
		</div>
	</li>
{/snippet}

<!-- The activation moment. Same silhouette as the gig board, not yet powered on -->
<div class="{panel} p-5 md:p-6">
	<div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
		<div class="min-w-0">
			<p class={microLabel}>Nothing on the board yet</p>
			<h1 class="mt-1 font-display text-3xl text-surface-900 md:text-4xl dark:text-surface-50">
				Build your first set
			</h1>
			<p class="mt-1 max-w-md text-sm text-surface-500 dark:text-surface-300">
				{hasSongs
					? 'Your songs are in. Drag them into a set and watch the total close on your gig time.'
					: 'Your next gig will live up here: the set, its running total, the countdown. It starts with songs.'}
			</p>
		</div>

		<!-- Unpowered readings: what the board shows once a set exists -->
		<div class="flex shrink-0 items-end gap-5 lg:items-center lg:gap-7" aria-hidden="true">
			<div class="lg:text-center">
				<p class="text-label text-surface-400 uppercase dark:text-surface-500">Total</p>
				<p
					class="font-display text-2xl font-bold text-surface-300 md:text-3xl dark:text-surface-600"
				>
					--:--
				</p>
			</div>
			<div class="lg:text-center">
				<p class="text-label text-surface-400 uppercase dark:text-surface-500">Target</p>
				<p
					class="font-display text-2xl font-bold text-surface-300 md:text-3xl dark:text-surface-600"
				>
					--:--
				</p>
			</div>
			<div class="lg:text-center">
				<p
					class="text-label uppercase {hasSongs
						? 'text-surface-500 dark:text-surface-300'
						: 'text-surface-400 dark:text-surface-500'}"
				>
					Songs
				</p>
				<p
					class="font-display text-2xl font-bold md:text-3xl {hasSongs
						? 'text-surface-900 dark:text-surface-100'
						: 'text-surface-300 dark:text-surface-600'}"
				>
					{songCount}
				</p>
			</div>
		</div>
	</div>

	<!-- The signal chain: three moves between here and showtime -->
	<div
		class="mt-6 flex flex-col gap-5 border-t border-surface-200 pt-5 lg:flex-row lg:items-center lg:justify-between dark:border-surface-700"
	>
		<ol class="grid gap-4 sm:grid-cols-3 lg:flex lg:gap-8">
			{@render chainStep(
				hasSongs ? 'done' : 'live',
				'Songs',
				hasSongs
					? `${songCount} ${songCount === 1 ? 'song' : 'songs'} · ${formatRunTime(librarySeconds)} ready`
					: 'A name and a length is all each one needs'
			)}
			{@render chainStep(hasSongs ? 'live' : 'next', 'The set', 'Drag songs in, fit the time')}
			{@render chainStep('next', 'Share', 'One link the whole band can open')}
		</ol>
		<a
			href={hasSongs ? '/setlists?new' : '/songs/new'}
			class="{heroButton} inline-flex shrink-0 items-center justify-center self-start lg:self-auto"
		>
			{hasSongs ? 'Start the set' : 'Add your first song'}
		</a>
	</div>
</div>
