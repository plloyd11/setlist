<script lang="ts">
	import SongRows from '#lib/components/practice/SongRows.svelte';
	import { formatDuration } from '#lib/utils/duration.js';

	/** Enough to see what the band just uploaded without pushing the songs off the screen */
	const DEMOS_SHOWN = 3;

	let { data } = $props();

	let query = $state('');
	let setlistId = $state('');
	let showAllDemos = $state(false);

	let songs = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.songs.filter(
			(song) =>
				(!q || song.title.toLowerCase().includes(q)) &&
				(!setlistId || song.setlistIds.includes(setlistId))
		);
	});

	// Demos aren't on setlists, so filtering by one leaves only songs
	let demos = $derived.by(() => {
		if (setlistId) return [];
		const q = query.trim().toLowerCase();
		return data.demos.filter((demo) => !q || demo.title.toLowerCase().includes(q));
	});
	let visibleDemos = $derived(showAllDemos || query.trim() ? demos : demos.slice(0, DEMOS_SHOWN));
	let manyBands = $derived(new Set(data.demos.map((demo) => demo.bandId)).size > 1);
	let searchLabel = $derived(data.demos.length > 0 ? 'Search songs and demos' : 'Search songs');
</script>

<svelte:head>
	<title>Shed — Setlist</title>
</svelte:head>

{#if data.songs.length === 0 && data.demos.length === 0}
	<p class="font-display text-xl text-surface-900 dark:text-surface-100">Nothing to shed yet</p>
	<p class="mt-1 max-w-prose text-sm text-surface-500 dark:text-surface-300">
		Add the song you're learning, with a mix and a chart if you have them.
	</p>
	<a
		href="/songs/new"
		class="focus-live mt-5 inline-block rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
	>
		Add a song
	</a>
{:else}
	<div class="flex flex-wrap items-center gap-2">
		<input
			type="search"
			bind:value={query}
			placeholder="{searchLabel}..."
			aria-label={searchLabel}
			class="focus-live min-h-11 min-w-0 flex-1 rounded-lg border border-surface-300 bg-surface-50 px-3 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
		/>
		{#if data.setlists.length > 0}
			<label class="sr-only" for="shed-setlist">Filter by setlist</label>
			<select
				id="shed-setlist"
				bind:value={setlistId}
				class="focus-live min-h-11 max-w-48 rounded-lg border border-surface-300 bg-surface-50 px-3 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
			>
				<option value="">All songs</option>
				{#each data.setlists as setlist (setlist.id)}
					<option value={setlist.id}>{setlist.name}</option>
				{/each}
			</select>
		{/if}
		<a
			href="/songs/new"
			class="focus-live flex min-h-11 items-center rounded-lg border border-surface-300 px-4 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800"
		>
			New song
		</a>
	</div>

	{#if demos.length > 0}
		<section class="mt-5" aria-labelledby="shed-demos">
			<h2
				id="shed-demos"
				class="font-display text-lg font-semibold text-surface-900 dark:text-surface-100"
			>
				Demos
			</h2>
			<ul
				class="mt-2 divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-surface-50 dark:divide-surface-700 dark:border-surface-700 dark:bg-surface-800/50"
			>
				{#each visibleDemos as demo (demo.id)}
					<li>
						<a
							href="/demos/{demo.id}/practice?from=/practice/shed"
							class="focus-live flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-800"
						>
							<span class="min-w-0 flex-1">
								<span
									class="block truncate text-sm font-medium text-surface-900 dark:text-surface-100"
								>
									{demo.title}
								</span>
								{#if manyBands}
									<span class="block truncate text-xs text-surface-500 dark:text-surface-300">
										{demo.bandName}
									</span>
								{/if}
							</span>
							<span class="shrink-0 text-xs text-surface-500 tabular-nums dark:text-surface-300">
								<span class="sr-only">Version </span><span aria-hidden="true">v</span
								>{demo.latestVersion}
							</span>
							{#if demo.durationSeconds}
								<span class="shrink-0 text-sm text-surface-500 tabular-nums dark:text-surface-300">
									{formatDuration(demo.durationSeconds)}
								</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
			{#if visibleDemos.length < demos.length}
				<button
					type="button"
					onclick={() => (showAllDemos = true)}
					class="focus-live mt-1 min-h-11 rounded-lg px-2 text-sm font-medium text-accent-700 hover:underline dark:text-accent-400"
				>
					Show all {demos.length} demos
				</button>
			{/if}
		</section>
	{/if}

	{#if songs.length > 0}
		<section class="mt-5" aria-labelledby={demos.length > 0 ? 'shed-songs' : undefined}>
			{#if demos.length > 0}
				<h2
					id="shed-songs"
					class="mb-2 font-display text-lg font-semibold text-surface-900 dark:text-surface-100"
				>
					Songs
				</h2>
			{/if}
			<SongRows {songs} from="/practice/shed" />
		</section>
	{:else if demos.length === 0}
		<p class="py-8 text-center text-sm text-surface-500 dark:text-surface-300">Nothing matches.</p>
	{/if}
{/if}
