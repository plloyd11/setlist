<script lang="ts">
	import { formatDuration } from '$lib/utils/duration';

	let {
		song,
		onRemove
	}: {
		song: { id: string; song_id: string; title: string; duration_seconds: number };
		onRemove: (id: string) => void;
	} = $props();
</script>

<div class="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 dark:border-surface-700 dark:bg-surface-800">
	<!-- Drag handle -->
	<span class="cursor-grab text-surface-400 dark:text-surface-500" aria-hidden="true">
		<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
			<circle cx="9" cy="5" r="1.5" />
			<circle cx="15" cy="5" r="1.5" />
			<circle cx="9" cy="12" r="1.5" />
			<circle cx="15" cy="12" r="1.5" />
			<circle cx="9" cy="19" r="1.5" />
			<circle cx="15" cy="19" r="1.5" />
		</svg>
	</span>

	<!-- Song title -->
	<span class="min-w-0 flex-1 truncate text-sm font-medium text-surface-900 dark:text-surface-100">
		{song.title}
	</span>

	<!-- Duration -->
	<span class="shrink-0 text-xs text-surface-500 dark:text-surface-400">
		{formatDuration(song.duration_seconds)}
	</span>

	<!-- Remove button -->
	<button
		onclick={() => onRemove(song.id)}
		class="shrink-0 rounded p-0.5 text-surface-400 hover:bg-surface-100 hover:text-danger-500 dark:text-surface-500 dark:hover:bg-surface-700 dark:hover:text-danger-400"
		aria-label="Remove {song.title} from setlist"
	>
		<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M18 6 6 18M6 6l12 12" />
		</svg>
	</button>
</div>
