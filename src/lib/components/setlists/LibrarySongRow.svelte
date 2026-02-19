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

<div class="flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 dark:border-stone-700 dark:bg-stone-800">
	<!-- Song title -->
	<span class="min-w-0 flex-1 truncate text-sm font-medium text-stone-900 dark:text-stone-100">
		{song.title}
	</span>

	<!-- Duration -->
	<span class="shrink-0 text-xs text-stone-500 dark:text-stone-400">
		{formatDuration(song.duration_seconds)}
	</span>

	<!-- Add button (mobile) -->
	<button
		onclick={() => onTap(song)}
		class="shrink-0 rounded p-0.5 text-stone-400 hover:bg-amber-50 hover:text-amber-500 md:hidden dark:text-stone-500 dark:hover:bg-amber-900/20 dark:hover:text-amber-400"
		aria-label="Add {song.title} to setlist"
	>
		<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M12 5v14M5 12h14" />
		</svg>
	</button>
</div>
