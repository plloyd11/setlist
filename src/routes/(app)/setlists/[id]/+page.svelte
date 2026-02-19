<script lang="ts">
	import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
	import { invalidateAll } from '$app/navigation';
	import SetlistSongRow from '$lib/components/setlists/SetlistSongRow.svelte';
	import LibrarySongRow from '$lib/components/setlists/LibrarySongRow.svelte';
	import SetlistHeader from '$lib/components/setlists/SetlistHeader.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import type { Song } from '$lib/types/database';

	let { data } = $props();

	const flipDurationMs = 200;

	// Mobile tab state
	let activeTab = $state<'library' | 'setlist'>('setlist');

	// Search state
	let searchQuery = $state('');

	// Toast
	let toast: Toast;

	// DnD item types
	type LibraryItem = Song & { id: string };
	type SetlistItem = {
		id: string;
		song_id: string;
		title: string;
		duration_seconds: number;
		position: number;
		[SHADOW_ITEM_MARKER_PROPERTY_NAME]?: boolean;
	};

	// State for DnD zones
	let libraryItems = $state<LibraryItem[]>(
		data.songs.map((s: Song) => ({ ...s, id: s.id }))
	);
	let setlistItems = $state<SetlistItem[]>(
		data.setlistSongs.map((ss: any) => ({
			id: ss.id,
			song_id: ss.song_id,
			title: (ss.songs as any).title,
			duration_seconds: (ss.songs as any).duration_seconds,
			position: ss.position
		}))
	);

	// Filtered library items (search)
	let filteredLibraryItems = $derived.by(() => {
		if (!searchQuery) return libraryItems;
		const q = searchQuery.toLowerCase();
		return libraryItems.filter((s) => s.title.toLowerCase().includes(q));
	});

	// Keep a set of song IDs already in the setlist (for visual indicator)
	let songsInSetlist = $derived(new Set(setlistItems.map((s) => s.song_id)));

	// Sync library items when data changes (e.g. after invalidateAll)
	$effect(() => {
		libraryItems = data.songs.map((s: Song) => ({ ...s, id: s.id }));
	});

	$effect(() => {
		setlistItems = data.setlistSongs.map((ss: any) => ({
			id: ss.id,
			song_id: ss.song_id,
			title: (ss.songs as any).title,
			duration_seconds: (ss.songs as any).duration_seconds,
			position: ss.position
		}));
	});

	// Library zone handlers (copy-on-drag: songs stay in library)
	function handleLibraryConsider(e: CustomEvent<{ items: LibraryItem[] }>) {
		libraryItems = e.detail.items;
	}

	function handleLibraryFinalize(e: CustomEvent<{ items: LibraryItem[] }>) {
		// Reset library to original (copy-on-drag pattern)
		libraryItems = data.songs.map((s: Song) => ({ ...s, id: s.id }));
	}

	// Setlist zone handlers
	function handleSetlistConsider(e: CustomEvent<{ items: SetlistItem[] }>) {
		setlistItems = e.detail.items;
	}

	function handleSetlistFinalize(e: CustomEvent<{ items: SetlistItem[] }>) {
		const items = e.detail.items;

		// Check for new items from library (their id will be a song.id, not a setlist_songs.id)
		const existingSetlistSongIds = new Set(
			data.setlistSongs.map((ss: any) => ss.id)
		);

		const processed = items.map((item, index) => {
			if (!existingSetlistSongIds.has(item.id) && !item[SHADOW_ITEM_MARKER_PROPERTY_NAME]) {
				// This is a new song from the library - assign new setlist_songs id
				const songData = data.songs.find((s: Song) => s.id === item.id);
				return {
					id: crypto.randomUUID(),
					song_id: item.id,
					title: songData?.title ?? item.title ?? 'Unknown',
					duration_seconds: songData?.duration_seconds ?? item.duration_seconds ?? 0,
					position: index
				};
			}
			return { ...item, position: index };
		});

		setlistItems = processed;
		persistOrder(processed);
	}

	// Persist order to DB
	async function persistOrder(items: SetlistItem[]) {
		const formData = new FormData();
		formData.set(
			'items',
			JSON.stringify(items.map((item, index) => ({ song_id: item.song_id, position: index })))
		);

		try {
			const response = await fetch('?/saveOrder', {
				method: 'POST',
				body: formData
			});
			if (response.ok) {
				await invalidateAll();
			}
		} catch {
			toast?.show('Failed to save order');
		}
	}

	// Add song via tap (mobile)
	async function handleAddSong(song: Song) {
		const formData = new FormData();
		formData.set('song_id', song.id);

		try {
			const response = await fetch('?/addSong', {
				method: 'POST',
				body: formData
			});
			if (response.ok) {
				await invalidateAll();
				toast?.show(`Added "${song.title}"`);
			}
		} catch {
			toast?.show('Failed to add song');
		}
	}

	// Remove song from setlist
	async function handleRemoveSong(setlistSongId: string) {
		// Optimistic removal
		setlistItems = setlistItems.filter((s) => s.id !== setlistSongId);

		const formData = new FormData();
		formData.set('setlist_song_id', setlistSongId);

		try {
			const response = await fetch('?/removeSong', {
				method: 'POST',
				body: formData
			});
			if (response.ok) {
				await invalidateAll();
			}
		} catch {
			toast?.show('Failed to remove song');
			await invalidateAll();
		}
	}

	// Update setlist metadata
	async function handleUpdateSetlist(updates: Record<string, unknown>) {
		const formData = new FormData();
		for (const [key, value] of Object.entries(updates)) {
			formData.set(key, value != null ? String(value) : '');
		}

		try {
			const response = await fetch('?/updateSetlist', {
				method: 'POST',
				body: formData
			});
			if (response.ok) {
				await invalidateAll();
			}
		} catch {
			toast?.show('Failed to update setlist');
		}
	}
</script>

<div class="flex h-full flex-col">
	<!-- Mobile tab toggle (below md) -->
	<div class="flex border-b border-stone-200 md:hidden dark:border-stone-700">
		<button
			onclick={() => (activeTab = 'library')}
			class="flex-1 px-4 py-3 text-center text-sm font-medium transition-colors {activeTab === 'library'
				? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-400'
				: 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'}"
		>
			Library
		</button>
		<button
			onclick={() => (activeTab = 'setlist')}
			class="flex-1 px-4 py-3 text-center text-sm font-medium transition-colors {activeTab === 'setlist'
				? 'border-b-2 border-amber-500 text-amber-600 dark:text-amber-400'
				: 'text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300'}"
		>
			Setlist
			{#if setlistItems.length > 0}
				<span class="ml-1 rounded-full bg-amber-100 px-1.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
					{setlistItems.length}
				</span>
			{/if}
		</button>
	</div>

	<!-- Two-panel layout -->
	<div class="flex min-h-0 flex-1 md:grid md:grid-cols-[320px_1fr]">
		<!-- Library panel -->
		<div
			class="flex flex-col border-r border-stone-200 bg-stone-50 md:flex dark:border-stone-700 dark:bg-stone-900/50 {activeTab === 'library' ? 'flex' : 'hidden'}"
		>
			<div class="p-3">
				<h2 class="font-display text-lg text-stone-900 dark:text-stone-100">Song Library</h2>
				<!-- Search -->
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search songs..."
					class="mt-2 w-full rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
				/>
			</div>

			<!-- Library DnD zone -->
			<div
				class="flex-1 overflow-y-auto p-3 pt-0"
				use:dndzone={{
					items: filteredLibraryItems,
					flipDurationMs,
					type: 'setlist-songs',
					dropFromOthersDisabled: true
				}}
				onconsider={handleLibraryConsider}
				onfinalize={handleLibraryFinalize}
			>
				{#each filteredLibraryItems as song (song.id)}
					<div class="mb-1.5 {songsInSetlist.has(song.id) ? 'opacity-50' : ''}">
						<LibrarySongRow {song} onTap={handleAddSong} />
					</div>
				{/each}
				{#if filteredLibraryItems.length === 0}
					<p class="py-8 text-center text-sm text-stone-400 dark:text-stone-500">
						{searchQuery ? 'No songs match your search' : 'No songs in your library'}
					</p>
				{/if}
			</div>
		</div>

		<!-- Setlist panel -->
		<div
			class="flex flex-col md:flex {activeTab === 'setlist' ? 'flex' : 'hidden'}"
		>
			<div class="flex-1 overflow-y-auto p-4 md:p-6">
				<!-- Setlist header -->
				<SetlistHeader
					setlist={data.setlist}
					profile={data.profile}
					onUpdate={handleUpdateSetlist}
				/>

				<!-- Setlist DnD zone -->
				<div
					class="min-h-[120px] rounded-lg"
					use:dndzone={{
						items: setlistItems,
						flipDurationMs,
						type: 'setlist-songs'
					}}
					onconsider={handleSetlistConsider}
					onfinalize={handleSetlistFinalize}
				>
					{#each setlistItems as song (song.id)}
						<div class="mb-1.5">
							<SetlistSongRow {song} onRemove={handleRemoveSong} />
						</div>
					{/each}
				</div>

				{#if setlistItems.length === 0}
					<div class="rounded-lg border-2 border-dashed border-stone-300 p-8 text-center dark:border-stone-700">
						<p class="text-sm text-stone-500 dark:text-stone-400">
							Drag songs here to build your setlist
						</p>
						<p class="mt-1 text-xs text-stone-400 dark:text-stone-500">
							or tap + on mobile to add songs
						</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<Toast bind:this={toast} />
