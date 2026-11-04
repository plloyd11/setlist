<script lang="ts">
	import Digits from '#lib/components/ui/Digits.svelte';
	import SongRows from '#lib/components/practice/SongRows.svelte';
	import {
		field,
		panel,
		panelRows,
		primaryButton,
		rowLink,
		secondaryButton,
		sectionHeading
	} from '#lib/components/practice/practiceStyles.js';
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

	// What you've flagged and still have to do. Solid songs are done, so they stay below.
	let workingOn = $derived(
		songs.filter((song) => song.status === 'needs_work' || song.status === 'learning')
	);
	let otherSongs = $derived(songs.filter((song) => !workingOn.includes(song)));

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
	<title>Shed · Setlist</title>
</svelte:head>

{#if data.songs.length === 0 && data.demos.length === 0}
	<div class="{panel} p-4 md:p-5">
		<p class="font-display text-xl text-surface-900 dark:text-surface-100">Nothing to shed yet</p>
		<p class="mt-1 max-w-prose text-sm text-surface-500 dark:text-surface-300">
			Add the song you're learning, with a mix and a chart if you have them.
		</p>
		<a href="/songs/new" class="{primaryButton} mt-4 inline-flex items-center">Add a song</a>
	</div>
{:else}
	<div class="flex flex-wrap items-center gap-2">
		<div class="relative min-w-48 flex-1">
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
				class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-surface-500 dark:text-surface-300"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="8" />
				<path d="m21 21-4.3-4.3" />
			</svg>
			<input
				type="search"
				bind:value={query}
				placeholder="{searchLabel}..."
				aria-label={searchLabel}
				class="{field} pl-9"
			/>
		</div>
		{#if data.setlists.length > 0}
			<label class="sr-only" for="shed-setlist">Filter by setlist</label>
			<select
				id="shed-setlist"
				bind:value={setlistId}
				class="focus-live min-h-11 max-w-48 rounded-lg border border-surface-300 bg-surface-50 px-3 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100"
			>
				<option value="">All songs</option>
				{#each data.setlists as setlist (setlist.id)}
					<option value={setlist.id}>{setlist.name}</option>
				{/each}
			</select>
		{/if}
		<a href="/songs/new" class="{secondaryButton} inline-flex items-center">New song</a>
	</div>

	<div
		class="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 md:items-start {demos.length > 0
			? 'md:grid-cols-[minmax(0,1fr)_20rem]'
			: ''}"
	>
		{#if demos.length > 0}
			<!-- First on a phone, where the newest upload is what you came to check. Beside the
			     songs anywhere wider, so it never pushes them down. -->
			<section class="min-w-0 md:col-start-2 md:row-start-1" aria-labelledby="shed-demos">
				<h2 id="shed-demos" class={sectionHeading}>Demos</h2>
				<ul class="{panel} {panelRows} mt-2 overflow-hidden">
					{#each visibleDemos as demo (demo.id)}
						<li>
							<a href="/demos/{demo.id}/practice?from=/practice/shed" class={rowLink}>
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
								<span class="shrink-0 text-xs text-surface-500 dark:text-surface-300">
									<span class="sr-only">Version </span><span aria-hidden="true">v</span
									>{demo.latestVersion}
								</span>
								{#if demo.durationSeconds}
									<span class="shrink-0 text-sm text-surface-500 dark:text-surface-300">
										<Digits value={formatDuration(demo.durationSeconds)} />
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
						class="focus-live mt-1 min-h-11 rounded-lg px-2 text-sm font-medium text-accent-700 hover:underline dark:text-accent-300"
					>
						Show all {demos.length} demos
					</button>
				{/if}
			</section>
		{/if}

		{#if songs.length > 0}
			<div class="flex min-w-0 flex-col gap-6 md:col-start-1 md:row-start-1">
				{#if workingOn.length > 0}
					<section aria-labelledby="shed-working-on">
						<h2 id="shed-working-on" class={sectionHeading}>Working on</h2>
						<div class="mt-2"><SongRows songs={workingOn} from="/practice/shed" /></div>
					</section>
				{/if}
				{#if otherSongs.length > 0}
					{@const heading = workingOn.length > 0 ? 'Everything else' : 'Songs'}
					<section
						aria-labelledby={demos.length > 0 || workingOn.length > 0 ? 'shed-songs' : undefined}
					>
						{#if demos.length > 0 || workingOn.length > 0}
							<h2 id="shed-songs" class="mb-2 {sectionHeading}">{heading}</h2>
						{/if}
						<SongRows songs={otherSongs} from="/practice/shed" />
					</section>
				{/if}
			</div>
		{:else if demos.length === 0}
			<p class="py-8 text-center text-sm text-surface-500 dark:text-surface-300">
				Nothing matches.
			</p>
		{/if}
	</div>
{/if}
