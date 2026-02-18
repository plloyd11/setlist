<script lang="ts">
	import SongRow from '$lib/components/songs/SongRow.svelte';
	import SongSearch from '$lib/components/songs/SongSearch.svelte';
	import ContextMenu from '$lib/components/ui/ContextMenu.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { enhance } from '$app/forms';

	let { data } = $props();

	// Search and filter state
	let searchQuery = $state('');
	let durationFilter = $state<'all' | 'under3' | '3to5' | 'over5'>('all');
	let searchExpanded = $state(false);

	// Sort state
	let sortBy = $state<'title' | 'duration' | 'date'>('title');
	let sortDir = $state<'asc' | 'desc'>('asc');

	// Context menu state
	let contextVisible = $state(false);
	let contextX = $state(0);
	let contextY = $state(0);
	let contextSongId = $state<string | null>(null);
	let contextSongTitle = $state('');

	// Editing state
	let editingSongId = $state<string | null>(null);

	// Component refs
	let confirmDialog: ConfirmDialog;
	let toast: Toast;
	let deleteForm: HTMLFormElement;
	let deleteInput: HTMLInputElement;

	// Filter and sort songs
	let filteredSongs = $derived.by(() => {
		let result = data.songs;

		// Search filter (title only)
		if (searchQuery) {
			const q = searchQuery.toLowerCase();
			result = result.filter((s) => s.title.toLowerCase().includes(q));
		}

		// Duration filter
		if (durationFilter !== 'all') {
			result = result.filter((s) => {
				switch (durationFilter) {
					case 'under3': return s.duration_seconds < 180;
					case '3to5': return s.duration_seconds >= 180 && s.duration_seconds <= 300;
					case 'over5': return s.duration_seconds > 300;
					default: return true;
				}
			});
		}

		// Sort
		result = [...result].sort((a, b) => {
			let cmp = 0;
			switch (sortBy) {
				case 'title':
					cmp = a.title.localeCompare(b.title);
					break;
				case 'duration':
					cmp = a.duration_seconds - b.duration_seconds;
					break;
				case 'date':
					cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
					break;
			}
			return sortDir === 'asc' ? cmp : -cmp;
		});

		return result;
	});

	let hasSongs = $derived(data.songs.length > 0);
	let hasResults = $derived(filteredSongs.length > 0);
	let songCountLabel = $derived(
		data.songs.length === 1 ? '1 song' : `${data.songs.length} songs`
	);

	function toggleSort(field: typeof sortBy) {
		if (sortBy === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = field;
			sortDir = 'asc';
		}
	}

	function showContextMenu(songId: string, songTitle: string, pos: { x: number; y: number }) {
		contextSongId = songId;
		contextSongTitle = songTitle;
		contextX = pos.x;
		contextY = pos.y;
		contextVisible = true;
	}

	function handleEdit() {
		if (contextSongId) {
			editingSongId = contextSongId;
		}
	}

	async function handleDelete() {
		if (!contextSongId) return;
		const confirmed = await confirmDialog.confirm(
			'Delete Song',
			`Are you sure you want to delete "${contextSongTitle}"?`
		);
		if (confirmed) {
			deleteInput.value = contextSongId;
			deleteForm.requestSubmit();
			// Phase 3: check setlist usage and show warning
		}
	}

	let contextMenuItems = $derived([
		{ label: 'Edit', action: handleEdit },
		{ label: 'Delete', action: handleDelete }
	]);

	function clearSearch() {
		searchQuery = '';
		durationFilter = 'all';
	}

	const sortOptions: { label: string; value: typeof sortBy }[] = [
		{ label: 'Title', value: 'title' },
		{ label: 'Duration', value: 'duration' },
		{ label: 'Date', value: 'date' }
	];
</script>

<div class="p-6 md:p-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-baseline gap-3">
			<h1 class="font-display text-3xl text-stone-900 dark:text-stone-100">Songs</h1>
			{#if hasSongs}
				<span class="text-sm text-stone-500 dark:text-stone-400">{songCountLabel}</span>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if hasSongs}
				<button
					onclick={() => (searchExpanded = !searchExpanded)}
					class="rounded-lg p-2 text-stone-500 hover:bg-stone-200 dark:text-stone-400 dark:hover:bg-stone-700"
					aria-label="Toggle search"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8" />
						<path d="m21 21-4.3-4.3" />
					</svg>
				</button>
			{/if}
			<a
				href="/songs/new"
				class="flex items-center justify-center rounded-lg bg-amber-500 p-2 text-white shadow-sm hover:bg-amber-600"
				aria-label="Add song"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 5v14M5 12h14" />
				</svg>
			</a>
		</div>
	</div>

	<!-- Search (collapsible) -->
	{#if hasSongs}
		<SongSearch bind:searchQuery bind:durationFilter bind:expanded={searchExpanded} />
	{/if}

	{#if hasSongs}
		<!-- Sort controls -->
		<div class="mt-4 flex items-center gap-1">
			<span class="mr-1 text-xs text-stone-400 dark:text-stone-500">Sort:</span>
			{#each sortOptions as opt}
				<button
					class="rounded px-2 py-0.5 text-xs font-medium transition-colors {sortBy === opt.value
						? 'bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-800'
						: 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'}"
					onclick={() => toggleSort(opt.value)}
				>
					{opt.label}
					{#if sortBy === opt.value}
						<span class="ml-0.5">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if hasResults}
			<!-- Song list -->
			<div class="mt-4 overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800/50">
				{#each filteredSongs as song (song.id)}
					<SongRow
						{song}
						supabase={data.supabase}
						editing={editingSongId === song.id}
						oncontextmenu={(pos) => showContextMenu(song.id, song.title, pos)}
					/>
				{/each}
			</div>
		{:else}
			<!-- No results state -->
			<div class="mt-8 rounded-xl border border-dashed border-stone-300 bg-white/50 p-8 text-center dark:border-stone-700 dark:bg-stone-900/50">
				<p class="font-display text-lg text-stone-700 dark:text-stone-300">
					No songs match
				</p>
				<p class="mt-2 text-sm text-stone-500 dark:text-stone-400">
					Try a different search or clear your filters.
				</p>
				<button
					onclick={clearSearch}
					class="mt-4 rounded-lg bg-stone-200 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-300 dark:bg-stone-700 dark:text-stone-300 dark:hover:bg-stone-600"
				>
					Clear search
				</button>
			</div>
		{/if}
	{:else}
		<!-- Empty state (no songs at all) -->
		<div class="mt-8 rounded-xl border border-dashed border-stone-300 bg-white/50 p-12 text-center dark:border-stone-700 dark:bg-stone-900/50">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="mx-auto text-stone-300 dark:text-stone-600"
			>
				<path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
			</svg>
			<p class="mt-4 font-display text-lg text-stone-700 dark:text-stone-300">
				Your song library is empty
			</p>
			<p class="mt-2 text-sm text-stone-500 dark:text-stone-400">
				Add your first song to get started.
			</p>
			<a
				href="/songs/new"
				class="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-amber-600"
			>
				Add your first song
			</a>
		</div>
	{/if}
</div>

<!-- Context menu (page-level singleton) -->
<ContextMenu
	items={contextMenuItems}
	x={contextX}
	y={contextY}
	bind:visible={contextVisible}
/>

<!-- Confirm dialog (page-level singleton) -->
<ConfirmDialog bind:this={confirmDialog} />

<!-- Hidden delete form -->
<form
	bind:this={deleteForm}
	method="POST"
	action="?/delete"
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.show('Song deleted');
				await update();
			}
		};
	}}
>
	<input bind:this={deleteInput} type="hidden" name="id" value="" />
</form>

<!-- Toast -->
<Toast bind:this={toast} />
