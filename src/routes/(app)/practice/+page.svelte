<script lang="ts">
	import Metronome from '#lib/components/practice/Metronome.svelte';
	import SongRows from '#lib/components/practice/SongRows.svelte';
	import { daysUntil, formatGigDate } from '#lib/utils/gigDate.js';

	let { data } = $props();

	function countdown(date: string): string {
		const days = daysUntil(date);
		if (days <= 0) return 'Today';
		return days === 1 ? 'Tomorrow' : `In ${days} days`;
	}
</script>

<svelte:head>
	<title>Practice — Setlist</title>
</svelte:head>

<div class="grid gap-8 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
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

			{#if data.songs.length > 0}
				<h3 class="mt-6 text-sm font-medium text-surface-700 dark:text-surface-300">
					Songs to shed
				</h3>
				<div class="mt-2"><SongRows songs={data.songs} from="/practice" /></div>
			{:else}
				<p class="mt-6 text-sm text-surface-500 dark:text-surface-300">
					This set has no songs yet. <a
						href="/practice/shed"
						class="focus-live font-medium text-accent-600 underline dark:text-accent-400"
						>Pick any song to shed</a
					>.
				</p>
			{/if}
		{:else}
			<p class="font-display text-xl text-surface-900 dark:text-surface-100">No gig coming up</p>
			<p class="mt-1 max-w-prose text-sm text-surface-500 dark:text-surface-300">
				Good time to learn something new. Pick a song and shed it, with its chart on screen and a
				loop on the hard part.
			</p>
			<a
				href="/practice/shed"
				class="focus-live mt-5 inline-block rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
			>
				Pick a song
			</a>
		{/if}
	</div>

	<Metronome />
</div>
