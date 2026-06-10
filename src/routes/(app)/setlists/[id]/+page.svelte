<script lang="ts">
	import { untrack } from 'svelte';
	import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
	import { invalidateAll } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import SetlistSongRow from '$lib/components/setlists/SetlistSongRow.svelte';
	import LibrarySongRow from '$lib/components/setlists/LibrarySongRow.svelte';
	import SetlistHeader from '$lib/components/setlists/SetlistHeader.svelte';
	import TimingBar from '$lib/components/setlists/TimingBar.svelte';
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
		isNew?: boolean;
		[SHADOW_ITEM_MARKER_PROPERTY_NAME]?: boolean;
	};

	// Mutation epoch guard: prevents the $effect sync (and stale async responses)
	// from overwriting newer optimistic state. Each mutation start bumps the epoch;
	// a response is only applied if its captured epoch is still current.
	let mutationEpoch = $state(0);
	let inFlightEpoch = $state(0); // 0 = no mutation in flight

	function beginMutation(): number {
		mutationEpoch += 1;
		inFlightEpoch = mutationEpoch;
		return mutationEpoch;
	}

	function endMutation(epoch: number) {
		// Only release the guard if no newer mutation started since
		if (epoch === mutationEpoch) inFlightEpoch = 0;
	}

	// State for DnD zones — initialized inline so SSR renders the setlist
	// immediately; the $effect blocks below resync after invalidateAll.
	// svelte-ignore state_referenced_locally
	let libraryItems = $state<LibraryItem[]>(data.songs.map((s: Song) => ({ ...s, id: s.id })));
	let setlistItems = $state<SetlistItem[]>(
		// svelte-ignore state_referenced_locally
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
		// Track only data.setlistSongs — NOT the mutation guard (untracked read-time guard)
		const serverItems = data.setlistSongs;
		// Don't overwrite during optimistic mutations (untracked so guard changes won't re-trigger)
		if (untrack(() => inFlightEpoch !== 0)) return;
		setlistItems = serverItems.map((ss: any) => ({
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

		// Detect new items from library: library items have no song_id field (they ARE the song)
		// Setlist items always have song_id set
		const processed = items.map((item, index) => {
			const isNewFromLibrary = !item.song_id && !item[SHADOW_ITEM_MARKER_PROPERTY_NAME];
			if (isNewFromLibrary) {
				// This is a new song from the library - assign new setlist_songs id
				const songData = data.songs.find((s: Song) => s.id === item.id);
				return {
					id: crypto.randomUUID(),
					song_id: item.id,
					title: songData?.title ?? item.title ?? 'Unknown',
					duration_seconds: songData?.duration_seconds ?? item.duration_seconds ?? 0,
					position: index,
					isNew: true
				};
			}
			return { ...item, position: index };
		});

		setlistItems = processed;
		persistOrder(processed);
	}

	// Persist order to DB
	async function persistOrder(items: SetlistItem[]) {
		const epoch = beginMutation();
		const formData = new FormData();
		formData.set(
			'items',
			JSON.stringify(
				items.map((item, index) => ({
					id: item.isNew ? undefined : item.id,
					song_id: item.song_id,
					position: index
				}))
			)
		);

		try {
			const response = await fetch('?/saveOrder', {
				method: 'POST',
				body: formData
			});
			if (!response.ok) {
				toast?.show('Failed to save order');
			} else {
				// Parse the response to get server-generated IDs
				// SvelteKit form actions use devalue serialization, not plain JSON
				const text = await response.text();
				try {
					const result = deserialize(text);
					if (result.type === 'success' && result.data) {
						const savedItems = (result.data as any).items;
						// Only apply if no newer mutation started while we awaited
						if (Array.isArray(savedItems) && savedItems.length > 0 && epoch === mutationEpoch) {
							// Saved rows are raw setlist_songs rows (no joined songs) —
							// merge title/duration from the current optimistic items
							// (existing row IDs are stable) and the library (new rows).
							const byRowId = new Map(setlistItems.map((item) => [item.id, item]));
							const bySongId = new Map(data.songs.map((s: Song) => [s.id, s]));
							setlistItems = savedItems.map((ss: any) => {
								const existing = byRowId.get(ss.id);
								const song = bySongId.get(ss.song_id);
								return {
									id: ss.id,
									song_id: ss.song_id,
									title: existing?.title ?? song?.title ?? 'Unknown',
									duration_seconds: existing?.duration_seconds ?? song?.duration_seconds ?? 0,
									position: ss.position
								};
							});
						}
					}
				} catch {
					// Response parsing failed — not critical, optimistic state remains
				}
			}
		} catch {
			toast?.show('Failed to save order');
		} finally {
			endMutation(epoch);
		}
	}

	// Add song via tap (mobile)
	async function handleAddSong(song: Song) {
		const epoch = beginMutation();
		const formData = new FormData();
		formData.set('song_id', song.id);

		try {
			const response = await fetch('?/addSong', {
				method: 'POST',
				body: formData
			});
			if (!response.ok) {
				toast?.show('Failed to add song');
				return;
			}
			// Append the returned row directly — no invalidateAll needed
			const text = await response.text();
			let appended = false;
			try {
				const result = deserialize(text);
				if (result.type === 'success' && result.data) {
					const ss = (result.data as any).setlistSong;
					// Only apply if no newer mutation started while we awaited
					if (ss && epoch === mutationEpoch) {
						setlistItems = [
							...setlistItems,
							{
								id: ss.id,
								song_id: ss.song_id ?? song.id,
								title: ss.songs?.title ?? song.title,
								duration_seconds: ss.songs?.duration_seconds ?? song.duration_seconds,
								position: ss.position ?? setlistItems.length
							}
						];
						appended = true;
					}
				}
			} catch {
				// Response parsing failed — fall back to a server resync below
			}
			toast?.show(`Added "${song.title}"`);
			if (!appended && epoch === mutationEpoch) {
				endMutation(epoch);
				await invalidateAll();
			}
		} catch {
			toast?.show('Failed to add song');
		} finally {
			endMutation(epoch);
		}
	}

	// Remove song from setlist
	async function handleRemoveSong(setlistSongId: string) {
		const epoch = beginMutation();
		// Optimistic removal
		setlistItems = setlistItems.filter((s) => s.id !== setlistSongId);

		const formData = new FormData();
		formData.set('setlist_song_id', setlistSongId);

		try {
			const response = await fetch('?/removeSong', {
				method: 'POST',
				body: formData
			});
			if (!response.ok) {
				// Revert (e.g. 404 row didn't exist): release guard then
				// invalidate so $effect resyncs from the server
				endMutation(epoch);
				await invalidateAll();
				return;
			}
			// Server confirmed the removal — optimistic state is already correct
		} catch {
			toast?.show('Failed to remove song');
			endMutation(epoch);
			await invalidateAll();
			return;
		}
		endMutation(epoch);
	}

	// Update target time
	async function handleTargetChange(seconds: number | null) {
		await handleUpdateSetlist({ target_seconds: seconds });
	}

	// Update transition time
	async function handleTransitionChange(seconds: number) {
		await handleUpdateSetlist({ transition_seconds: seconds });
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

	// Share toggle state
	let shareLoading = $state(false);
	let copiedShareLink = $state(false);
	let isShared = $derived(!!data.setlist.share_token);
	let shareUrl = $derived.by(() => {
		if (!data.setlist.share_token) return '';
		const origin = typeof window !== 'undefined' ? window.location.origin : '';
		return `${origin}/share/${data.setlist.share_token}`;
	});

	async function toggleShare() {
		shareLoading = true;
		try {
			const formData = new FormData();
			if (isShared) {
				// Turn off sharing
				formData.set('share_token', '');
			} else {
				// Turn on sharing - generate UUID
				formData.set('share_token', crypto.randomUUID());
			}
			const response = await fetch('?/toggleShare', {
				method: 'POST',
				body: formData
			});
			if (response.ok) {
				await invalidateAll();
			}
		} catch {
			toast?.show('Failed to update sharing');
		} finally {
			shareLoading = false;
		}
	}

	async function copyShareLink() {
		if (!shareUrl) return;
		try {
			await navigator.clipboard.writeText(shareUrl);
			copiedShareLink = true;
			setTimeout(() => (copiedShareLink = false), 2000);
		} catch {
			toast?.show('Failed to copy link');
		}
	}
</script>

<div class="flex h-full flex-col">
	<!-- Mobile tab toggle (below md) -->
	<div class="flex border-b border-surface-200 md:hidden dark:border-surface-700">
		<button
			onclick={() => (activeTab = 'library')}
			class="flex-1 px-4 py-3 text-center text-sm font-medium transition-colors {activeTab ===
			'library'
				? 'border-b-2 border-neon-400 text-neon-600 dark:text-neon-400'
				: 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-300'}"
		>
			Library
		</button>
		<button
			onclick={() => (activeTab = 'setlist')}
			class="flex-1 px-4 py-3 text-center text-sm font-medium transition-colors {activeTab ===
			'setlist'
				? 'border-b-2 border-neon-400 text-neon-600 dark:text-neon-400'
				: 'text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-300'}"
		>
			Setlist
			{#if setlistItems.length > 0}
				<span
					class="ml-1 rounded-full bg-neon-100 px-1.5 text-xs text-neon-700 dark:bg-neon-900/30 dark:text-neon-400"
				>
					{setlistItems.length}
				</span>
			{/if}
		</button>
	</div>

	<!-- Two-panel layout -->
	<div class="flex min-h-0 flex-1 md:grid md:grid-cols-[320px_1fr]">
		<!-- Library panel -->
		<div
			class="flex flex-col border-r border-surface-200 bg-surface-50 md:flex dark:border-surface-700 dark:bg-surface-900/50 {activeTab ===
			'library'
				? 'flex'
				: 'hidden'}"
		>
			<div class="p-3">
				<h2 class="font-display text-lg text-surface-900 dark:text-surface-100">Song Library</h2>
				<!-- Search -->
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search songs..."
					aria-label="Search songs"
					class="mt-2 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-surface-900 placeholder-surface-400 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-500"
				/>
			</div>

			<!-- Library DnD zone (empty-state overlay lives outside the zone:
			     all direct children of a dndzone must correspond to items) -->
			<div class="relative flex min-h-0 flex-1 flex-col">
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
				</div>
				{#if filteredLibraryItems.length === 0}
					<p
						class="pointer-events-none absolute inset-x-0 top-0 py-8 text-center text-sm text-surface-400 dark:text-surface-500"
					>
						{searchQuery ? 'No songs match your search' : 'No songs in your library'}
					</p>
				{/if}
			</div>
		</div>

		<!-- Setlist panel -->
		<div class="flex flex-col md:flex {activeTab === 'setlist' ? 'flex' : 'hidden'}">
			<div class="flex-1 overflow-y-auto p-4 md:p-6">
				<!-- Setlist header -->
				<SetlistHeader
					setlist={data.setlist}
					profile={data.profile}
					onUpdate={handleUpdateSetlist}
				/>

				<!-- Share toggle -->
				<div class="mb-4 flex flex-col items-center gap-2">
					<button
						onclick={toggleShare}
						disabled={shareLoading}
						class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {isShared
							? 'bg-accent-100 text-accent-700 hover:bg-accent-200 dark:bg-accent-900/30 dark:text-accent-400 dark:hover:bg-accent-900/50'
							: 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-400 dark:hover:bg-surface-700'}"
					>
						{#if shareLoading}
							<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
									class="opacity-25"
								/>
								<path
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
									class="opacity-75"
								/>
							</svg>
						{:else}
							<svg
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="2"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
								/>
							</svg>
						{/if}
						{isShared ? 'Sharing On' : 'Share'}
					</button>

					{#if isShared && shareUrl}
						<div
							class="flex items-center gap-2 rounded-lg bg-surface-100 px-3 py-1.5 dark:bg-surface-800"
						>
							<span
								class="max-w-[200px] truncate text-xs text-surface-500 md:max-w-sm dark:text-surface-400"
							>
								{shareUrl}
							</span>
							<button
								onclick={copyShareLink}
								class="shrink-0 rounded px-2 py-0.5 text-xs font-medium text-accent-600 hover:bg-accent-100 dark:text-accent-400 dark:hover:bg-accent-900/30"
							>
								{copiedShareLink ? 'Copied!' : 'Copy'}
							</button>
						</div>
					{/if}
				</div>

				<!-- Setlist DnD zone (empty-state overlay lives outside the zone:
				     all direct children of a dndzone must correspond to items) -->
				<div class="relative">
					<div
						class="min-h-[120px] rounded-lg {setlistItems.length === 0
							? 'border-2 border-dashed border-surface-300 p-8 dark:border-surface-700'
							: ''}"
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
						<div
							class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
						>
							<p class="text-sm text-surface-500 dark:text-surface-400">
								Drag songs here to build your setlist
							</p>
							<p class="mt-1 text-xs text-surface-400 dark:text-surface-500">
								or tap + on mobile to add songs
							</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	<!-- Timing bar (sticky bottom, always visible) -->
	<TimingBar
		{setlistItems}
		targetSeconds={data.setlist.target_seconds}
		transitionSeconds={data.setlist.transition_seconds}
		onTargetChange={handleTargetChange}
		onTransitionChange={handleTransitionChange}
	/>
</div>

<Toast bind:this={toast} />
