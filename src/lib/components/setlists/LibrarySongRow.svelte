<script lang="ts">
	import { formatDuration } from '$lib/utils/duration';
	import type { Song } from '$lib/types/database';

	let {
		song,
		onTap
	}: {
		song: Song;
		onTap: (song: Song) => void;
	} = $props();
</script>

<div
	class="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 dark:border-surface-700 dark:bg-surface-800"
>
	<!-- Song title -->
	<span class="min-w-0 flex-1 truncate text-sm font-medium text-surface-900 dark:text-surface-100">
		{song.title}
	</span>

	<!-- Duration -->
	<span class="shrink-0 text-xs text-surface-500 tabular-nums dark:text-surface-300">
		{formatDuration(song.duration_seconds)}
	</span>

	<!-- Add button (mobile) -->
	<button
		onclick={() => onTap(song)}
		class="shrink-0 rounded p-0.5 text-surface-400 hover:bg-accent-50 hover:text-accent-500 md:hidden dark:text-surface-300 dark:hover:bg-accent-900/20 dark:hover:text-accent-400"
		aria-label="Add {song.title} to setlist"
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
	</button>
</div>
