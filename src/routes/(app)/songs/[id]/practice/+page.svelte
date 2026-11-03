<script lang="ts">
	import SongPracticePanel from '#lib/components/songs/SongPracticePanel.svelte';
	import ChartList from '#lib/components/songs/ChartList.svelte';
	import { practiceShortcut } from '#lib/utils/practiceKeys.js';

	let { data } = $props();

	let panel: SongPracticePanel | undefined = $state();

	function handlePageKeydown(e: KeyboardEvent) {
		const action = practiceShortcut(e);
		if (!action) return;
		panel?.perform(action);
		e.preventDefault();
	}
</script>

<svelte:window onkeydown={handlePageKeydown} />

<svelte:head>
	<title>Practice — {data.song.title}</title>
</svelte:head>

<div class="mx-auto w-full max-w-3xl p-4 md:p-8">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<a
			href={data.backHref}
			class="focus-live flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-surface-100"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="m15 18-6-6 6-6" />
			</svg>
			Back
		</a>
	</div>

	<!-- The marquee: the song name is the headline of this screen -->
	<h1
		class="mt-6 font-display text-4xl leading-[1.1] text-balance break-words text-surface-900 md:text-5xl dark:text-surface-100"
	>
		{data.song.title}
	</h1>

	<SongPracticePanel
		bind:this={panel}
		songId={data.song.id}
		lengthSeconds={data.song.duration_seconds}
		variants={data.variants}
	>
		{#snippet empty()}
			<div
				class="rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-10 text-center dark:border-surface-700 dark:bg-surface-900/50"
			>
				<p class="font-display text-lg text-surface-700 dark:text-surface-300">
					No rehearsal audio yet
				</p>
				<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
					Upload a mix from the song panel to practice along to it.
				</p>
				<a
					href={data.backHref}
					class="focus-live mt-6 inline-block rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
				>
					Back to songs
				</a>
			</div>
		{/snippet}
	</SongPracticePanel>

	<!-- Notes -->
	{#if data.song.notes}
		<div
			class="mt-6 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-800"
		>
			<p
				class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
			>
				Notes
			</p>
			<p
				class="mt-1 text-sm break-words whitespace-pre-wrap text-surface-700 dark:text-surface-300"
			>
				{data.song.notes}
			</p>
		</div>
	{/if}

	<ChartList charts={data.charts} />
</div>
