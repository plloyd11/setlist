<script lang="ts">
	import type { Song } from '$lib/types/database';
	import { formatDuration, parseDuration } from '$lib/utils/duration';
	import { longpress } from '$lib/actions/longpress';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { invalidateAll } from '$app/navigation';

	let {
		song,
		supabase,
		oncontextmenu,
		editing = $bindable(false)
	}: {
		song: Song;
		supabase: SupabaseClient;
		oncontextmenu: (e: { x: number; y: number }) => void;
		editing: boolean;
	} = $props();

	let editTitle = $state(song.title);
	let editDuration = $state(formatDuration(song.duration_seconds));
	let editNotes = $state(song.notes ?? '');
	let editError = $state('');
	let saving = $state(false);

	function enterEdit() {
		editTitle = song.title;
		editDuration = formatDuration(song.duration_seconds);
		editNotes = song.notes ?? '';
		editError = '';
		editing = true;
	}

	function cancelEdit() {
		editing = false;
		editError = '';
	}

	async function saveEdit() {
		if (!editTitle.trim()) {
			editError = 'Title is required';
			return;
		}

		const durationSeconds = parseDuration(editDuration);
		if (durationSeconds === null) {
			editError = 'Duration must be mm:ss (e.g., 3:45)';
			return;
		}

		saving = true;
		editError = '';

		const { error } = await supabase
			.from('songs')
			.update({
				title: editTitle.trim(),
				duration_seconds: durationSeconds,
				notes: editNotes.trim() || null
			})
			.eq('id', song.id);

		saving = false;

		if (error) {
			editError = 'Failed to save changes';
			return;
		}

		editing = false;
		await invalidateAll();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEdit();
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		oncontextmenu({ x: e.clientX, y: e.clientY });
	}

	function handleLongpress(e: CustomEvent<{ x: number; y: number }>) {
		oncontextmenu(e.detail);
	}
</script>

{#if editing}
	<!-- Edit mode -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="border-b border-surface-200 px-4 py-3 dark:border-surface-700" onkeydown={handleKeydown}>
		<div class="flex items-center gap-2">
			<input
				type="text"
				bind:value={editTitle}
				placeholder="Song title"
				class="flex-1 rounded border border-surface-300 bg-surface-50 px-2 py-1 text-base font-medium text-surface-900 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
			/>
			<input
				type="text"
				bind:value={editDuration}
				placeholder="3:45"
				inputmode="numeric"
				class="w-16 rounded border border-surface-300 bg-surface-50 px-2 py-1 text-center text-sm text-surface-900 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
			/>
		</div>
		<div class="mt-2 flex items-center gap-2">
			<input
				type="text"
				bind:value={editNotes}
				placeholder="Notes (optional)"
				class="flex-1 rounded border border-surface-300 bg-surface-50 px-2 py-1 text-sm text-surface-500 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-400"
			/>
			<button
				onclick={saveEdit}
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
	</div>
{:else}
	<!-- Display mode -->
	<button
		class="w-full border-b border-surface-200 px-4 py-3 text-left transition-colors hover:bg-surface-50 dark:border-surface-700 dark:hover:bg-surface-800/50"
		onclick={enterEdit}
		oncontextmenu={handleContextMenu}
		use:longpress
		onlongpress={handleLongpress}
	>
		<div class="flex items-center justify-between">
			<span class="text-base font-medium text-surface-900 dark:text-surface-100">{song.title}</span>
			<span class="ml-4 shrink-0 text-sm text-surface-500 dark:text-surface-400"
				>{formatDuration(song.duration_seconds)}</span
			>
		</div>
		{#if song.notes}
			<p class="mt-0.5 text-sm text-surface-400 dark:text-surface-500">{song.notes}</p>
		{/if}
	</button>
{/if}
