<script lang="ts">
	import { untrack } from 'svelte';
	import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';
	import { invalidateAll } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import SetlistSongRow from '$lib/components/setlists/SetlistSongRow.svelte';
	import SetlistGapRow from '$lib/components/setlists/SetlistGapRow.svelte';
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

	// Drag-in-flight: lights the setlist drop zone (Limelight = live)
	let dragActive = $state(false);

	// Toast
	let toast: Toast;

	// DnD item types
	type LibraryItem = Song & { id: string };
	type SetlistItem = {
		id: string;
		song_id: string | null; // null = gap row
		title: string;
		duration_seconds: number; // for gaps this mirrors gap_seconds so totals just work
		gap_seconds: number | null;
		gap_label: string | null;
		notes: string | null;
		position: number;
		isNew?: boolean;
		[SHADOW_ITEM_MARKER_PROPERTY_NAME]?: boolean;
	};

	// Map a server setlist_songs row (song or gap) to a SetlistItem
	function toSetlistItem(ss: any): SetlistItem {
		return {
			id: ss.id,
			song_id: ss.song_id,
			title: ss.songs?.title ?? '',
			duration_seconds: ss.song_id ? (ss.songs?.duration_seconds ?? 0) : (ss.gap_seconds ?? 0),
			gap_seconds: ss.gap_seconds ?? null,
			gap_label: ss.gap_label ?? null,
			notes: ss.songs?.notes ?? null,
			position: ss.position
		};
	}

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
		data.setlistSongs.map(toSetlistItem)
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
		// Track only data.setlistSongs -- NOT the mutation guard (untracked read-time guard)
		const serverItems = data.setlistSongs;
		// Don't overwrite during optimistic mutations (untracked so guard changes won't re-trigger)
		if (untrack(() => inFlightEpoch !== 0)) return;
		setlistItems = serverItems.map(toSetlistItem);
	});

	// Library zone handlers (copy-on-drag: songs stay in library)
	function handleLibraryConsider(e: CustomEvent<{ items: LibraryItem[] }>) {
		dragActive = true;
		libraryItems = e.detail.items;
	}

	function handleLibraryFinalize(e: CustomEvent<{ items: LibraryItem[] }>) {
		// Reset library to original (copy-on-drag pattern)
		libraryItems = data.songs.map((s: Song) => ({ ...s, id: s.id }));
		dragActive = false;
	}

	// Setlist zone handlers
	function handleSetlistConsider(e: CustomEvent<{ items: SetlistItem[] }>) {
		dragActive = true;
		setlistItems = e.detail.items;
	}

	function handleSetlistFinalize(e: CustomEvent<{ items: SetlistItem[] }>) {
		dragActive = false;
		const items = e.detail.items;

		// Detect new items from library: library items have no song_id field (they ARE
		// the song). Setlist items always have song_id set — except gaps, which carry
		// gap_seconds instead.
		const processed = items.map((item, index) => {
			const isNewFromLibrary =
				!item.song_id && item.gap_seconds == null && !item[SHADOW_ITEM_MARKER_PROPERTY_NAME];
			if (isNewFromLibrary) {
				// This is a new song from the library - assign new setlist_songs id
				const songData = data.songs.find((s: Song) => s.id === item.id);
				return {
					id: crypto.randomUUID(),
					song_id: item.id,
					title: songData?.title ?? item.title ?? 'Unknown',
					duration_seconds: songData?.duration_seconds ?? item.duration_seconds ?? 0,
					gap_seconds: null,
					gap_label: null,
					notes: songData?.notes ?? null,
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
					gap_seconds: item.gap_seconds,
					gap_label: item.gap_label,
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
				toast?.show('Failed to save order', { variant: 'error' });
			} else {
				// Parse the response to get server-generated IDs
				const text = await response.text();
				try {
					const result = deserialize(text);
					if (result.type === 'success' && result.data) {
						const savedItems = (result.data as any).items;
						// Only apply if no newer mutation started while we awaited
						if (Array.isArray(savedItems) && savedItems.length > 0 && epoch === mutationEpoch) {
							// Saved rows are raw setlist_songs rows (no joined songs) --
							// merge title/duration from the current optimistic items
							// (existing row IDs are stable) and the library (new rows).
							const byRowId = new Map(setlistItems.map((item) => [item.id, item]));
							const bySongId = new Map(data.songs.map((s: Song) => [s.id, s]));
							setlistItems = savedItems.map((ss: any) => {
								const existing = byRowId.get(ss.id);
								const song = ss.song_id ? bySongId.get(ss.song_id) : undefined;
								return {
									id: ss.id,
									song_id: ss.song_id,
									title: ss.song_id ? (existing?.title ?? song?.title ?? 'Unknown') : '',
									duration_seconds: ss.song_id
										? (existing?.duration_seconds ?? song?.duration_seconds ?? 0)
										: (ss.gap_seconds ?? 0),
									gap_seconds: ss.gap_seconds ?? null,
									gap_label: ss.gap_label ?? null,
									notes: ss.song_id ? (existing?.notes ?? song?.notes ?? null) : null,
									position: ss.position
								};
							});
						}
					}
				} catch {
					// Response parsing failed -- not critical, optimistic state remains
				}
			}
		} catch {
			toast?.show('Failed to save order', { variant: 'error' });
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
				toast?.show('Failed to add song', { variant: 'error' });
				return;
			}
			// Append the returned row directly -- no invalidateAll needed
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
								gap_seconds: null,
								gap_label: null,
								notes: ss.songs?.notes ?? song.notes ?? null,
								position: ss.position ?? setlistItems.length
							}
						];
						appended = true;
					}
				}
			} catch {
				// Response parsing failed -- fall back to a server resync below
			}
			toast?.show(`Added "${song.title}"`, { variant: 'success' });
			if (!appended && epoch === mutationEpoch) {
				endMutation(epoch);
				await invalidateAll();
			}
		} catch {
			toast?.show('Failed to add song', { variant: 'error' });
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
			// Server confirmed the removal -- optimistic state is already correct
		} catch {
			toast?.show('Failed to remove song', { variant: 'error' });
			endMutation(epoch);
			await invalidateAll();
			return;
		}
		endMutation(epoch);
	}

	// Add a 30s gap block at the end of the setlist
	async function handleAddGap() {
		const epoch = beginMutation();
		const formData = new FormData();
		formData.set('gap_seconds', '30');

		try {
			const response = await fetch('?/addGap', {
				method: 'POST',
				body: formData
			});
			if (!response.ok) {
				toast?.show('Failed to add gap', { variant: 'error' });
				return;
			}
			const text = await response.text();
			let appended = false;
			try {
				const result = deserialize(text);
				if (result.type === 'success' && result.data) {
					const ss = (result.data as any).setlistSong;
					if (ss && epoch === mutationEpoch) {
						setlistItems = [
							...setlistItems,
							{
								id: ss.id,
								song_id: null,
								title: '',
								duration_seconds: ss.gap_seconds ?? 30,
								gap_seconds: ss.gap_seconds ?? 30,
								gap_label: ss.gap_label ?? null,
								notes: null,
								position: ss.position ?? setlistItems.length
							}
						];
						appended = true;
					}
				}
			} catch {
				// Response parsing failed -- fall back to a server resync below
			}
			if (!appended && epoch === mutationEpoch) {
				endMutation(epoch);
				await invalidateAll();
			}
		} catch {
			toast?.show('Failed to add gap', { variant: 'error' });
		} finally {
			endMutation(epoch);
		}
	}

	// Change a gap's duration (optimistic, synced via updateGap action)
	async function handleGapDurationChange(id: string, seconds: number) {
		const epoch = beginMutation();
		setlistItems = setlistItems.map((item) =>
			item.id === id ? { ...item, gap_seconds: seconds, duration_seconds: seconds } : item
		);

		const formData = new FormData();
		formData.set('setlist_song_id', id);
		formData.set('gap_seconds', String(seconds));
		await syncGapUpdate(formData, epoch);
	}

	// Rename a gap (optimistic; empty label clears the name)
	async function handleGapLabelChange(id: string, label: string) {
		const epoch = beginMutation();
		setlistItems = setlistItems.map((item) =>
			item.id === id ? { ...item, gap_label: label || null } : item
		);

		const formData = new FormData();
		formData.set('setlist_song_id', id);
		formData.set('gap_label', label);
		await syncGapUpdate(formData, epoch);
	}

	async function syncGapUpdate(formData: FormData, epoch: number) {
		try {
			const response = await fetch('?/updateGap', {
				method: 'POST',
				body: formData
			});
			if (!response.ok) {
				endMutation(epoch);
				await invalidateAll();
				return;
			}
		} catch {
			toast?.show('Failed to update gap', { variant: 'error' });
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
			toast?.show('Failed to update setlist', { variant: 'error' });
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
				formData.set('share_token', '');
			} else {
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
			toast?.show('Failed to update sharing', { variant: 'error' });
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
			toast?.show('Failed to copy link', { variant: 'error' });
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
				? 'border-b-2 border-accent-500 text-accent-700 dark:border-accent-400 dark:text-accent-300'
				: 'text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100'}"
		>
			Band Library
		</button>
		<button
			onclick={() => (activeTab = 'setlist')}
			class="flex-1 px-4 py-3 text-center text-sm font-medium transition-colors {activeTab ===
			'setlist'
				? 'border-b-2 border-accent-500 text-accent-700 dark:border-accent-400 dark:text-accent-300'
				: 'text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100'}"
		>
			Setlist
			{#if setlistItems.length > 0}
				<span
					class="ml-1 rounded-full bg-accent-100 px-1.5 text-xs text-accent-700 dark:bg-accent-900/40 dark:text-accent-300"
				>
					{setlistItems.length}
				</span>
			{/if}
		</button>
	</div>

	<!-- Two-panel layout. grid-rows-[minmax(0,1fr)] caps the row at the container
	     height so each panel scrolls internally — without it the row auto-sizes to
	     the song list and pushes the timing bar off-screen. -->
	<div class="flex min-h-0 flex-1 md:grid md:grid-cols-[320px_1fr] md:grid-rows-[minmax(0,1fr)]">
		<!-- Library panel -->
		<div
			class="flex flex-col border-r border-surface-200 bg-surface-50 md:flex dark:border-surface-700 dark:bg-surface-900/50 {activeTab ===
			'library'
				? 'flex'
				: 'hidden'}"
		>
			<div class="p-3">
				<h2 class="font-display text-lg text-surface-900 dark:text-surface-100">Band Library</h2>
				<!-- Search -->
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search band songs..."
					aria-label="Search band songs"
					class="focus-live mt-2 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
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
						class="pointer-events-none absolute inset-x-0 top-0 py-8 text-center text-sm text-surface-500 dark:text-surface-300"
					>
						{searchQuery ? 'No songs match your search' : 'No songs in band library'}
					</p>
				{/if}
			</div>
		</div>

		<!-- Setlist panel -->
		<div class="flex flex-col md:flex {activeTab === 'setlist' ? 'flex' : 'hidden'}">
			<div class="flex-1 overflow-y-auto p-4 md:p-6">
				<!-- Setlist header -->
				<SetlistHeader setlist={data.setlist} profile={null} onUpdate={handleUpdateSetlist} />

				<!-- Share toggle -->
				<div class="mb-4 flex flex-col items-center gap-2">
					<div class="flex items-center gap-2">
						<button
							onclick={toggleShare}
							disabled={shareLoading}
							class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {isShared
								? 'bg-accent-100 text-accent-800 shadow-glow-accent hover:bg-accent-200 dark:bg-accent-900/40 dark:text-accent-300 dark:hover:bg-accent-900/60'
								: 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700'}"
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

						<a
							href="/setlists/{data.setlist.id}/print"
							class="flex items-center gap-2 rounded-lg bg-surface-100 px-3 py-1.5 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
						>
							<svg
								class="h-4 w-4"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								stroke-width="1.5"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Z"
								/>
							</svg>
							Print
						</a>
					</div>

					{#if isShared && shareUrl}
						<div
							class="flex items-center gap-2 rounded-lg bg-surface-100 px-3 py-1.5 dark:bg-surface-800"
						>
							<span
								class="max-w-[200px] truncate text-xs text-surface-500 md:max-w-sm dark:text-surface-300"
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
						class="min-h-[120px] rounded-lg transition-shadow duration-150 motion-reduce:transition-none {dragActive
							? 'shadow-glow-neon ring-2 ring-neon-600 dark:ring-neon-400'
							: ''} {setlistItems.length === 0
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
								{#if song.song_id === null && song.gap_seconds != null}
									<SetlistGapRow
										gap={song}
										onDurationChange={handleGapDurationChange}
										onLabelChange={handleGapLabelChange}
										onRemove={handleRemoveSong}
									/>
								{:else}
									<SetlistSongRow {song} onRemove={handleRemoveSong} />
								{/if}
							</div>
						{/each}
					</div>
					{#if setlistItems.length === 0}
						<div
							class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
						>
							<p class="text-sm text-surface-500 dark:text-surface-300">
								Drag songs here to build your setlist
							</p>
							<p class="mt-1 text-xs text-surface-500 dark:text-surface-300">
								or tap + on mobile to add songs
							</p>
						</div>
					{/if}
				</div>

				<!-- Add gap: timed break block (e.g. 30s breather between tunes) -->
				<div class="mt-3 flex justify-center">
					<button
						onclick={handleAddGap}
						class="focus-live flex items-center gap-1.5 rounded-lg border border-dashed border-surface-300 px-3 py-1.5 text-sm font-medium text-surface-500 transition-colors hover:border-surface-400 hover:text-surface-700 dark:border-surface-600 dark:text-surface-300 dark:hover:border-surface-500 dark:hover:text-surface-100"
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
						>
							<path d="M12 5v14M5 12h14" />
						</svg>
						Add gap
					</button>
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
