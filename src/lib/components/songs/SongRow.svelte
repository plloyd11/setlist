<script lang="ts">
	import type { Song } from '$lib/types/database';
	import { formatDuration } from '$lib/utils/duration';
	import { longpress } from '$lib/actions/longpress';
	import AudioCountChip from './AudioCountChip.svelte';

	let {
		song,
		audioCount = 0,
		onclick,
		oncontextmenu
	}: {
		song: Song;
		audioCount?: number;
		onclick: () => void;
		oncontextmenu: (e: { x: number; y: number }) => void;
	} = $props();

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		oncontextmenu({ x: e.clientX, y: e.clientY });
	}

	function handleLongpress(e: CustomEvent<{ x: number; y: number }>) {
		oncontextmenu(e.detail);
	}
</script>

<button
	class="w-full border-b border-surface-200 px-4 py-3 text-left transition-colors hover:bg-surface-100 dark:border-surface-700 dark:hover:bg-surface-800/50"
	{onclick}
	oncontextmenu={handleContextMenu}
	use:longpress
	onlongpress={handleLongpress}
>
	<div class="flex items-center justify-between">
		<span class="flex min-w-0 items-center gap-2">
			<span class="truncate text-base font-medium text-surface-900 dark:text-surface-100"
				>{song.title}</span
			>
			<AudioCountChip count={audioCount} />
		</span>
		<span class="ml-4 shrink-0 text-sm text-surface-500 dark:text-surface-300"
			>{formatDuration(song.duration_seconds)}</span
		>
	</div>
</button>
