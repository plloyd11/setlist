<script lang="ts">
	import SongRows from '#lib/components/practice/SongRows.svelte';

	let { data } = $props();

	let query = $state('');
	let setlistId = $state('');

	let songs = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.songs.filter(
			(song) =>
				(!q || song.title.toLowerCase().includes(q)) &&
				(!setlistId || song.setlistIds.includes(setlistId))
		);
	});
</script>

<svelte:head>
	<title>Shed — Setlist</title>
</svelte:head>

{#if data.songs.length === 0}
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
			placeholder="Search songs..."
			aria-label="Search songs"
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

	<div class="mt-4">
		{#if songs.length > 0}
			<SongRows {songs} from="/practice/shed" />
		{:else}
			<p class="py-8 text-center text-sm text-surface-500 dark:text-surface-300">No songs match.</p>
		{/if}
	</div>
{/if}
