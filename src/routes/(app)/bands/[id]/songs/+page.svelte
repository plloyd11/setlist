<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDuration, parseDuration } from '$lib/utils/duration';
	import { invalidateAll } from '$app/navigation';
	import Toast from '$lib/components/ui/Toast.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';

	let { data } = $props();

	// UI state
	let searchQuery = $state('');
	let showSharePicker = $state(false);
	let showAddForm = $state(false);
	let shareSearchQuery = $state('');

	// Add form state
	let newTitle = $state('');
	let newDuration = $state('');
	let newNotes = $state('');

	// Editing state
	let editingSongId = $state<string | null>(null);
	let editTitle = $state('');
	let editDuration = $state('');
	let editNotes = $state('');
	let editError = $state('');
	let saving = $state(false);

	// Component refs
	let toast: Toast;
	let confirmDialog: ConfirmDialog;

	// Get band songs with flattened song data
	let bandSongs = $derived(
		(data.bandSongs ?? []).map((bs: any) => ({
			bandSongId: bs.id,
			songId: bs.songs?.id ?? bs.song_id,
			title: bs.songs?.title ?? '',
			durationSeconds: bs.songs?.duration_seconds ?? 0,
			notes: bs.songs?.notes ?? null,
			addedBy: bs.added_by
		}))
	);

	// Filter band songs by search
	let filteredSongs = $derived.by(() => {
		if (!searchQuery) return bandSongs;
		const q = searchQuery.toLowerCase();
		return bandSongs.filter((s: any) => s.title.toLowerCase().includes(q));
	});

	// Personal songs not already in band
	let bandSongIds = $derived(new Set(bandSongs.map((bs: any) => bs.songId)));
	let availablePersonalSongs = $derived.by(() => {
		let songs = (data.personalSongs ?? []).filter((s: any) => !bandSongIds.has(s.id));
		if (shareSearchQuery) {
			const q = shareSearchQuery.toLowerCase();
			songs = songs.filter((s: any) => s.title.toLowerCase().includes(q));
		}
		return songs;
	});

	let hasSongs = $derived(bandSongs.length > 0);
	let hasResults = $derived(filteredSongs.length > 0);

	function enterEdit(song: any) {
		editingSongId = song.songId;
		editTitle = song.title;
		editDuration = formatDuration(song.durationSeconds);
		editNotes = song.notes ?? '';
		editError = '';
	}

	function cancelEdit() {
		editingSongId = null;
		editError = '';
	}

	function handleEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			cancelEdit();
		}
	}

	function resetAddForm() {
		newTitle = '';
		newDuration = '';
		newNotes = '';
	}
</script>

<div class="p-6 md:p-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<h2 class="font-display text-2xl text-surface-900 dark:text-surface-100">Songs</h2>
		<div class="flex items-center gap-2">
			<button
				onclick={() => {
					showSharePicker = !showSharePicker;
					showAddForm = false;
				}}
				class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
					{showSharePicker
					? 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400'
					: 'text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-700'}"
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
					<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
					<polyline points="16 6 12 2 8 6" />
					<line x1="12" y1="2" x2="12" y2="15" />
				</svg>
				Share from Library
			</button>
			<button
				onclick={() => {
					showAddForm = !showAddForm;
					showSharePicker = false;
				}}
				class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
					{showAddForm
					? 'bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400'
					: 'bg-accent-500 text-white hover:bg-accent-600'}"
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
					<path d="M12 5v14M5 12h14" />
				</svg>
				Add New
			</button>
		</div>
	</div>

	<!-- Share from Library panel -->
	{#if showSharePicker}
		<div
			class="mt-4 rounded-xl border border-accent-200 bg-accent-50/50 p-4 dark:border-accent-800/50 dark:bg-accent-900/10"
		>
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-sm font-semibold text-surface-700 dark:text-surface-300">
					Share from Your Library
				</h3>
				<button
					onclick={() => (showSharePicker = false)}
					class="rounded p-1 text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
					aria-label="Close"
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
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			{#if data.personalSongs && data.personalSongs.length > 0}
				<input
					type="text"
					bind:value={shareSearchQuery}
					placeholder="Filter your songs..."
					class="mb-3 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-surface-900 placeholder-surface-400 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-500"
				/>

				{#if availablePersonalSongs.length > 0}
					<div class="max-h-60 space-y-1 overflow-y-auto">
						{#each availablePersonalSongs as song (song.id)}
							<form
								method="POST"
								action="?/shareSong"
								use:enhance={() => {
									return async ({ result, update }) => {
										if (result.type === 'success') {
											toast.show('Song shared to band');
											await update();
										} else if (result.type === 'failure') {
											toast.show(String((result as any).data?.error ?? 'Failed to share'));
										}
									};
								}}
							>
								<input type="hidden" name="song_id" value={song.id} />
								<div
									class="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-accent-100/50 dark:hover:bg-accent-900/20"
								>
									<div class="flex items-center gap-3">
										<span class="text-sm font-medium text-surface-900 dark:text-surface-100"
											>{song.title}</span
										>
										<span class="text-xs text-surface-500 dark:text-surface-400"
											>{formatDuration(song.duration_seconds)}</span
										>
									</div>
									<button
										type="submit"
										class="rounded-lg px-3 py-1 text-xs font-medium text-accent-600 hover:bg-accent-200/50 dark:text-accent-400 dark:hover:bg-accent-800/30"
									>
										Share
									</button>
								</div>
							</form>
						{/each}
					</div>
				{:else}
					<p class="py-4 text-center text-sm text-surface-500 dark:text-surface-400">
						{shareSearchQuery
							? 'No matching songs found.'
							: 'All your songs are already shared to this band.'}
					</p>
				{/if}
			{:else}
				<p class="py-4 text-center text-sm text-surface-500 dark:text-surface-400">
					Your personal library is empty. Add songs first in your <a
						href="/songs"
						class="text-accent-600 underline hover:text-accent-700 dark:text-accent-400"
						>song library</a
					>.
				</p>
			{/if}
		</div>
	{/if}

	<!-- Add New Song form -->
	{#if showAddForm}
		<div
			class="mt-4 rounded-xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-700 dark:bg-surface-800/50"
		>
			<div class="mb-3 flex items-center justify-between">
				<h3 class="text-sm font-semibold text-surface-700 dark:text-surface-300">Add New Song</h3>
				<button
					onclick={() => (showAddForm = false)}
					class="rounded p-1 text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
					aria-label="Close"
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
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<form
				method="POST"
				action="?/addNew"
				class="space-y-3"
				use:enhance={() => {
					return async ({ result, update }) => {
						if (result.type === 'success') {
							toast.show('Song added to band');
							resetAddForm();
							showAddForm = false;
							await update();
						} else {
							await update();
						}
					};
				}}
			>
				<div class="flex gap-3">
					<input
						type="text"
						name="title"
						bind:value={newTitle}
						placeholder="Song title"
						required
						class="flex-1 rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-surface-900 placeholder-surface-400 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-500"
					/>
					<input
						type="text"
						name="duration"
						bind:value={newDuration}
						placeholder="3:45"
						required
						inputmode="numeric"
						pattern={String.raw`\d{1,3}:[0-5]\d`}
						class="w-20 rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-center text-sm text-surface-900 placeholder-surface-400 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-500"
					/>
				</div>
				<input
					type="text"
					name="notes"
					bind:value={newNotes}
					placeholder="Notes (optional)"
					class="w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-surface-900 placeholder-surface-400 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-500"
				/>
				<button
					type="submit"
					class="w-full rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-600"
				>
					Add Song
				</button>
			</form>
		</div>
	{/if}

	<!-- Search (only when songs exist) -->
	{#if hasSongs}
		<div class="mt-4">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="Search band songs..."
				class="w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-500"
			/>
		</div>
	{/if}

	{#if hasSongs}
		{#if hasResults}
			<!-- Song list -->
			<div
				class="mt-4 overflow-hidden rounded-xl border border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-800/50"
			>
				{#each filteredSongs as song (song.bandSongId)}
					{#if editingSongId === song.songId}
						<!-- Edit mode -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="border-b border-surface-200 px-4 py-3 dark:border-surface-700"
							onkeydown={handleEditKeydown}
						>
							<form
								method="POST"
								action="?/updateSong"
								use:enhance={() => {
									saving = true;
									return async ({ result, update }) => {
										saving = false;
										if (result.type === 'success') {
											editingSongId = null;
											toast.show('Song updated');
											await update();
										} else {
											editError = 'Failed to save changes';
										}
									};
								}}
							>
								<input type="hidden" name="song_id" value={song.songId} />
								<div class="flex items-center gap-2">
									<input
										type="text"
										name="title"
										bind:value={editTitle}
										placeholder="Song title"
										class="flex-1 rounded border border-surface-300 bg-surface-50 px-2 py-1 text-base font-medium text-surface-900 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
									/>
									<input
										type="text"
										name="duration"
										bind:value={editDuration}
										placeholder="3:45"
										inputmode="numeric"
										class="w-16 rounded border border-surface-300 bg-surface-50 px-2 py-1 text-center text-sm text-surface-900 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
									/>
								</div>
								<div class="mt-2 flex items-center gap-2">
									<input
										type="text"
										name="notes"
										bind:value={editNotes}
										placeholder="Notes (optional)"
										class="flex-1 rounded border border-surface-300 bg-surface-50 px-2 py-1 text-sm text-surface-500 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-400"
									/>
									<button
										type="submit"
										disabled={saving}
										class="rounded p-1 text-success-600 hover:bg-success-50 disabled:opacity-50 dark:text-success-400 dark:hover:bg-success-900/20"
										aria-label="Save"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="20"
											height="20"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<polyline points="20 6 9 17 4 12" />
										</svg>
									</button>
									<button
										type="button"
										onclick={cancelEdit}
										class="rounded p-1 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700"
										aria-label="Cancel"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="20"
											height="20"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path d="M18 6 6 18M6 6l12 12" />
										</svg>
									</button>
								</div>
								{#if editError}
									<p class="mt-1 text-xs text-danger-500">{editError}</p>
								{/if}
							</form>
						</div>
					{:else}
						<!-- Display mode -->
						<div class="flex items-center border-b border-surface-200 dark:border-surface-700">
							<button
								class="flex-1 px-4 py-3 text-left transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50"
								onclick={() => enterEdit(song)}
							>
								<div class="flex items-center justify-between">
									<span class="text-base font-medium text-surface-900 dark:text-surface-100"
										>{song.title}</span
									>
									<span class="ml-4 shrink-0 text-sm text-surface-500 dark:text-surface-400"
										>{formatDuration(song.durationSeconds)}</span
									>
								</div>
								{#if song.notes}
									<p class="mt-0.5 text-sm text-surface-400 dark:text-surface-500">{song.notes}</p>
								{/if}
							</button>
							<form
								method="POST"
								action="?/removeSong"
								use:enhance={() => {
									return async ({ result, update }) => {
										if (result.type === 'success') {
											toast.show('Song removed from band');
											await update();
										}
									};
								}}
							>
								<input type="hidden" name="band_song_id" value={song.bandSongId} />
								<button
									type="submit"
									class="mr-2 rounded p-1.5 text-surface-400 hover:bg-danger-50 hover:text-danger-500 dark:hover:bg-danger-900/20 dark:hover:text-danger-400"
									aria-label="Remove {song.title} from band"
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
										<path d="M18 6 6 18M6 6l12 12" />
									</svg>
								</button>
							</form>
						</div>
					{/if}
				{/each}
			</div>
		{:else}
			<!-- No search results -->
			<div
				class="mt-8 rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-8 text-center dark:border-surface-700 dark:bg-surface-900/50"
			>
				<p class="font-display text-lg text-surface-700 dark:text-surface-300">No songs match</p>
				<p class="mt-2 text-sm text-surface-500 dark:text-surface-400">
					Try a different search term.
				</p>
				<button
					onclick={() => (searchQuery = '')}
					class="mt-4 rounded-lg bg-surface-200 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-300 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600"
				>
					Clear search
				</button>
			</div>
		{/if}
	{:else}
		<!-- Empty state -->
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
			>
				<path
					d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
				/>
			</svg>
			<p class="mt-4 font-display text-lg text-surface-700 dark:text-surface-300">
				No songs in this band's library yet
			</p>
			<p class="mt-2 text-sm text-surface-500 dark:text-surface-400">
				Share songs from your personal library or add new ones.
			</p>
			<div class="mt-6 flex justify-center gap-3">
				<button
					onclick={() => {
						showSharePicker = true;
						showAddForm = false;
					}}
					class="rounded-lg bg-surface-200 px-4 py-2 text-sm font-medium text-surface-700 hover:bg-surface-300 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600"
				>
					Share from Library
				</button>
				<button
					onclick={() => {
						showAddForm = true;
						showSharePicker = false;
					}}
					class="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-600"
				>
					Add New Song
				</button>
			</div>
		</div>
	{/if}
</div>

<!-- Confirm dialog -->
<ConfirmDialog bind:this={confirmDialog} />

<!-- Toast -->
<Toast bind:this={toast} />
