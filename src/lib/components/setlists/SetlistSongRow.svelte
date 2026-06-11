<script lang="ts">
	import { formatDuration } from '$lib/utils/duration';

	let {
		song,
		position = null,
		onRemove
	}: {
		song: {
			id: string;
			song_id: string | null;
			title: string;
			duration_seconds: number;
			notes?: string | null;
		};
		position?: number | null;
		onRemove: (id: string) => void;
	} = $props();
</script>

<div
	class="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 dark:border-surface-700 dark:bg-surface-800"
>
	<!-- Drag handle -->
	<span class="cursor-grab text-surface-400 dark:text-surface-300" aria-hidden="true">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="currentColor"
		>
			<circle cx="9" cy="5" r="1.5" />
			<circle cx="15" cy="5" r="1.5" />
			<circle cx="9" cy="12" r="1.5" />
			<circle cx="15" cy="12" r="1.5" />
			<circle cx="9" cy="19" r="1.5" />
			<circle cx="15" cy="19" r="1.5" />
		</svg>
	</span>

	<!-- Set position: renumbers live while a drag is in flight -->
	{#if position != null}
		<span
			class="w-5 shrink-0 text-right text-xs font-medium text-surface-400 tabular-nums dark:text-surface-400"
			aria-hidden="true"
		>
			{position}
		</span>
	{/if}

	<!-- Song title (+ inline notes, e.g. count-ins) -->
	<span class="min-w-0 flex-1 truncate font-medium text-surface-900 dark:text-surface-100">
		{song.title}{#if song.notes}<span
				class="ml-2 text-sm font-normal text-surface-500 dark:text-surface-400">{song.notes}</span
			>{/if}
	</span>

	<!-- Duration: fixed slot so times stack into a scannable column -->
	<span
		class="w-12 shrink-0 text-right text-sm text-surface-500 tabular-nums dark:text-surface-300"
	>
		{formatDuration(song.duration_seconds)}
	</span>

	<!-- Remove button -->
	<button
		onclick={() => onRemove(song.id)}
		class="shrink-0 rounded p-0.5 text-surface-400 hover:bg-surface-100 hover:text-danger-500 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-danger-400"
		aria-label="Remove {song.title} from setlist"
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
			<path d="M18 6 6 18M6 6l12 12" />
		</svg>
	</button>
</div>
