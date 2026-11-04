<script lang="ts">
	import type { Song } from '#lib/types/database.js';
	import Digits from '#lib/components/ui/Digits.svelte';
	import { formatDuration } from '#lib/utils/duration.js';
	import { longpress } from '#lib/actions/longpress.js';
	import { SONG_GRID } from './songGrid.js';

	let {
		song,
		audioCount = 0,
		fileCount = 0,
		onclick,
		onmenu
	}: {
		song: Song;
		audioCount?: number;
		fileCount?: number;
		onclick: () => void;
		onmenu: (pos: { x: number; y: number }) => void;
	} = $props();

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		onmenu({ x: e.clientX, y: e.clientY });
	}

	function handleLongpress(e: CustomEvent<{ x: number; y: number }>) {
		onmenu(e.detail);
	}

	function handleMenuButton(e: MouseEvent) {
		// Past the window listener that closes the menu on any other click
		e.stopPropagation();
		const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
		onmenu({ x: box.right - 160, y: box.bottom + 4 });
	}

	// In UTC, so the server and the browser render the same text
	function formatAdded(iso: string): string {
		const date = new Date(iso);
		const sameYear = date.getUTCFullYear() === new Date().getUTCFullYear();
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: sameYear ? 'numeric' : undefined,
			year: sameYear ? undefined : 'numeric',
			timeZone: 'UTC'
		});
	}

	let audioLabel = $derived(`${audioCount} rehearsal ${audioCount === 1 ? 'mix' : 'mixes'}`);
	let fileLabel = $derived(`${fileCount} ${fileCount === 1 ? 'chart' : 'charts'}`);
</script>

<div
	class="group -mx-3 flex items-center rounded-lg transition-colors hover:bg-surface-100 dark:hover:bg-surface-800/50"
>
	<button
		data-song-row={song.id}
		class="{SONG_GRID} min-w-0 flex-1 rounded-lg px-3 py-3 text-left"
		{onclick}
		oncontextmenu={handleContextMenu}
		use:longpress
		onlongpress={handleLongpress}
	>
		<span class="line-clamp-2 min-w-0 sm:line-clamp-none sm:truncate">
			<span class="font-medium text-surface-900 dark:text-surface-100">{song.title}</span>
			{#if song.notes}
				<span class="ml-2 hidden text-sm text-surface-500 sm:inline dark:text-surface-300"
					>{song.notes}</span
				>
			{/if}
		</span>

		<!-- Fixed slots, so mixes and charts each read straight down the column -->
		<span class="grid grid-cols-2 text-xs font-medium text-surface-500 dark:text-surface-300">
			<span class="inline-flex items-center gap-1" title={audioCount > 0 ? audioLabel : undefined}>
				{#if audioCount > 0}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="13"
						height="13"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M9 18V5l12-2v13" />
						<circle cx="6" cy="18" r="3" />
						<circle cx="18" cy="16" r="3" />
					</svg>
					<span aria-hidden="true">{audioCount}</span>
					<span class="sr-only">, {audioLabel},</span>
				{/if}
			</span>
			<span class="inline-flex items-center gap-1" title={fileCount > 0 ? fileLabel : undefined}>
				{#if fileCount > 0}
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="13"
						height="13"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
						<path d="M14 2v6h6" />
					</svg>
					<span aria-hidden="true">{fileCount}</span>
					<span class="sr-only">, {fileLabel},</span>
				{/if}
			</span>
		</span>

		<span class="hidden text-right text-sm text-surface-500 sm:block dark:text-surface-300"
			>{formatAdded(song.created_at)}</span
		>

		<!-- The reason this app exists: the brightest thing in the row -->
		<span class="text-right text-sm font-semibold text-surface-900 dark:text-surface-100"
			><Digits value={formatDuration(song.duration_seconds)} /></span
		>
	</button>

	<button
		type="button"
		onclick={handleMenuButton}
		aria-label="Song options"
		aria-haspopup="menu"
		class="mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-surface-500 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface-200 hover:text-surface-800 focus-visible:opacity-100 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100 pointer-coarse:opacity-100"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
		>
			<circle cx="12" cy="5" r="2" />
			<circle cx="12" cy="12" r="2" />
			<circle cx="12" cy="19" r="2" />
		</svg>
	</button>
</div>
