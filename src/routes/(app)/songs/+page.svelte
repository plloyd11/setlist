<script lang="ts">
	import { tick } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import SongRow from '#lib/components/songs/SongRow.svelte';
	import SongDetailPanel from '#lib/components/songs/SongDetailPanel.svelte';
	import { SONG_GRID } from '#lib/components/songs/songGrid.js';
	import ContextMenu from '#lib/components/ui/ContextMenu.svelte';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import Toast from '#lib/components/ui/Toast.svelte';
	import { formatRunTime } from '#lib/utils/duration.js';

	type SortField = 'title' | 'duration' | 'date';

	let { data } = $props();

	// Search and filter state
	let searchQuery = $state('');
	let durationFilter = $state<'all' | 'under3' | '3to5' | 'over5'>('all');

	// Sort state
	let sortBy = $state<SortField>('title');
	let sortDir = $state<'asc' | 'desc'>('asc');

	// Context menu state
	let contextVisible = $state(false);
	let contextX = $state(0);
	let contextY = $state(0);
	let contextSongId = $state<string | null>(null);
	let contextSongTitle = $state('');

	// Detail panel state — derived from data so the panel stays live across
	// refreshAll() after saves/uploads/renames/deletes
	let selectedSongId = $state<string | null>(null);
	let selectedSong = $derived(data.songs.find((s) => s.id === selectedSongId) ?? null);

	// Component refs
	let confirmDialog: ConfirmDialog;
	let toast: Toast;
	let deleteForm: HTMLFormElement;
	let deleteInput: HTMLInputElement;
	let searchInput: HTMLInputElement | undefined = $state();
	let addLink: HTMLAnchorElement | undefined = $state();
	let rowAfterDelete: string | null = null;

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
					case 'under3':
						return s.duration_seconds < 180;
					case '3to5':
						return s.duration_seconds >= 180 && s.duration_seconds <= 300;
					case 'over5':
						return s.duration_seconds > 300;
					default:
						return true;
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
	let isFiltered = $derived(searchQuery !== '' || durationFilter !== 'all');
	let totalSeconds = $derived(data.songs.reduce((sum, s) => sum + s.duration_seconds, 0));
	let songCountLabel = $derived.by(() => {
		const total = data.songs.length;
		const noun = total === 1 ? 'song' : 'songs';
		return isFiltered
			? `${filteredSongs.length} of ${total} ${noun}`
			: `${total} ${noun} · ${formatRunTime(totalSeconds)} of music`;
	});

	function chooseSort(field: SortField) {
		if (sortBy === field) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = field;
			// Recently added is the useful end of a date sort
			sortDir = field === 'date' ? 'desc' : 'asc';
		}
	}

	function showContextMenu(songId: string, songTitle: string, pos: { x: number; y: number }) {
		contextSongId = songId;
		contextSongTitle = songTitle;
		contextX = pos.x;
		contextY = pos.y;
		contextVisible = true;
	}

	async function requestDelete(id: string, title: string) {
		const confirmed = await confirmDialog.confirm(
			'Delete song',
			`Delete "${title}"? It also comes off every setlist that uses it, including band setlists. This can't be undone.`
		);
		if (!confirmed) return;
		const i = filteredSongs.findIndex((s) => s.id === id);
		rowAfterDelete = filteredSongs[i + 1]?.id ?? filteredSongs[i - 1]?.id ?? null;
		deleteInput.value = id;
		deleteForm.requestSubmit();
	}

	let contextMenuItems = $derived([
		{
			label: 'Edit details',
			action: () => {
				if (contextSongId) selectedSongId = contextSongId;
			}
		},
		{
			label: 'Practice',
			action: () => {
				if (contextSongId) goto(`/songs/${contextSongId}/practice?from=/songs`);
			}
		},
		{
			label: 'Delete',
			danger: true,
			action: () => contextSongId && requestDelete(contextSongId, contextSongTitle)
		}
	]);

	function clearSearch() {
		searchQuery = '';
		durationFilter = 'all';
		// The button that called this is about to disappear
		searchInput?.focus();
	}

	function handleSearchKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && searchQuery) {
			e.preventDefault();
			searchQuery = '';
		}
	}
</script>

<svelte:head>
	<title>Songs · Setlist</title>
</svelte:head>

{#snippet sortHead(label: string, field: SortField, extra = '')}
	{@const selected = sortBy === field}
	<button
		type="button"
		aria-pressed={selected}
		class="text-label whitespace-nowrap uppercase transition-colors {extra} {selected
			? 'text-surface-900 dark:text-surface-100'
			: 'text-surface-500 hover:text-surface-800 dark:text-surface-300 dark:hover:text-surface-100'}"
		onclick={() => chooseSort(field)}
	>
		{label}{#if selected}<span class="ml-1" aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span
			><span class="sr-only">, {sortDir === 'asc' ? 'ascending' : 'descending'}</span>{/if}
	</button>
{/snippet}

<div class="page-frame">
	<!-- Header: title and count, tools, the one primary action -->
	<div class="flex flex-wrap items-center gap-x-4 gap-y-3">
		<div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
			<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100">Songs</h1>
			{#if hasSongs}
				<!-- Live: this is how a filtered result count reaches a screen reader -->
				<span role="status" class="text-sm text-surface-500 dark:text-surface-300"
					>{songCountLabel}</span
				>
			{/if}
		</div>

		{#if hasSongs}
			<div
				class="order-3 flex w-full flex-wrap items-center gap-2 sm:order-2 sm:w-auto"
				role="search"
			>
				<div class="relative min-w-44 flex-1 sm:w-64 sm:flex-none">
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
						bind:this={searchInput}
						bind:value={searchQuery}
						type="text"
						placeholder="Search songs..."
						aria-label="Search songs"
						enterkeyhint="search"
						autocapitalize="off"
						autocorrect="off"
						spellcheck="false"
						onkeydown={handleSearchKeydown}
						class="focus-live h-9 w-full rounded-lg border border-surface-300 bg-surface-50 pr-8 pl-9 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
					/>
					{#if searchQuery}
						<button
							type="button"
							onclick={() => {
								searchQuery = '';
								searchInput?.focus();
							}}
							aria-label="Clear search"
							class="absolute top-1/2 right-1.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-surface-500 hover:text-surface-800 dark:text-surface-300 dark:hover:text-surface-100"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								aria-hidden="true"
							>
								<path d="M18 6 6 18M6 6l12 12" />
							</svg>
						</button>
					{/if}
				</div>
				<select
					bind:value={durationFilter}
					aria-label="Filter by length"
					class="focus-live h-9 shrink-0 rounded-lg border border-surface-300 bg-surface-50 pl-3 text-sm text-surface-700 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-200"
				>
					<option value="all">Any length</option>
					<option value="under3">Under 3 min</option>
					<option value="3to5">3 to 5 min</option>
					<option value="over5">Over 5 min</option>
				</select>
			</div>
		{/if}

		<a
			bind:this={addLink}
			href="/songs/new"
			data-tour="add-song"
			class="focus-live order-2 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-600 sm:order-3 pointer-coarse:h-11"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<path d="M12 5v14M5 12h14" />
			</svg>
			Add song
		</a>
	</div>

	{#if hasSongs}
		{#if hasResults}
			<!-- Column heads: instrument-panel labels that double as the sort controls -->
			<div class="sticky top-0 z-10 -mx-3 mt-5 bg-surface-50 px-3 dark:bg-surface-950">
				<div
					class="{SONG_GRID} border-b border-surface-200 py-2 pr-10 dark:border-surface-800 pointer-coarse:py-4"
					role="group"
					aria-label="Sort songs"
				>
					<div class="flex items-center gap-5">
						{@render sortHead('Title', 'title')}
						{@render sortHead('Added', 'date', 'sm:hidden')}
					</div>
					<span
						class="text-label text-surface-500 uppercase max-[359px]:invisible dark:text-surface-300"
						>Files</span
					>
					{@render sortHead('Added', 'date', 'hidden justify-self-end sm:block')}
					{@render sortHead('Length', 'duration', 'justify-self-end')}
				</div>
			</div>

			<ul class="divide-y divide-surface-200 dark:divide-surface-800">
				{#each filteredSongs as song (song.id)}
					<li>
						<SongRow
							{song}
							audioCount={song.song_audio.length}
							fileCount={song.song_files.length}
							onclick={() => (selectedSongId = song.id)}
							onmenu={(pos) => showContextMenu(song.id, song.title, pos)}
						/>
					</li>
				{/each}
			</ul>
		{:else}
			<!-- No results state -->
			<div
				class="mt-8 rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-8 text-center dark:border-surface-700 dark:bg-surface-900/50"
			>
				<p class="font-display text-lg text-surface-700 dark:text-surface-300">No songs match</p>
				<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
					Try a different search or clear your filters.
				</p>
				<button
					onclick={clearSearch}
					class="mt-4 rounded-lg bg-surface-200 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-300 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600"
				>
					Clear search
				</button>
			</div>
		{/if}
	{:else}
		<!-- Empty state (no songs at all) -->
		<div
			class="mt-8 rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-12 text-center dark:border-surface-700 dark:bg-surface-900/50"
		>
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
				class="mx-auto text-surface-300 dark:text-surface-600"
				aria-hidden="true"
			>
				<path
					d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
				/>
			</svg>
			<p class="mt-4 font-display text-lg text-surface-700 dark:text-surface-300">No songs yet</p>
			<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
				A name and a length is all each one needs.
			</p>
			<a
				href="/songs/new"
				class="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
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
	label="Options for {contextSongTitle}"
	bind:visible={contextVisible}
/>

<!-- Song detail flyout -->
{#if selectedSong}
	<SongDetailPanel
		song={selectedSong}
		variants={selectedSong.song_audio}
		files={selectedSong.song_files}
		supabase={data.supabase}
		practiceHref="/songs/{selectedSong.id}/practice?from=/songs"
		ondelete={() => selectedSong && requestDelete(selectedSong.id, selectedSong.title)}
		onclose={() => (selectedSongId = null)}
	/>
{/if}

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
			if (result.type === 'failure' || result.type === 'error') {
				toast.show("Couldn't delete that song. Check your connection and try again.", {
					variant: 'error',
					duration: 6000
				});
				return;
			}
			if (result.type === 'success') {
				selectedSongId = null;
				toast.show('Song deleted', { variant: 'success' });
			}
			await update();
			if (result.type === 'success') {
				// The row that had focus is gone: land on its neighbour, or on Add song
				await tick();
				const next = rowAfterDelete
					? document.querySelector<HTMLElement>(`[data-song-row="${rowAfterDelete}"]`)
					: addLink;
				next?.focus();
			}
		};
	}}
>
	<input bind:this={deleteInput} type="hidden" name="id" value="" />
</form>

<!-- Toast -->
<Toast bind:this={toast} />
