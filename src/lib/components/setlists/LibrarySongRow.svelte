<script lang="ts">
	import Digits from '#lib/components/ui/Digits.svelte';
	import { formatDuration } from '#lib/utils/duration.js';
	import type { Song } from '#lib/types/database.js';

	let {
		song,
		inSet = false,
		onTap
	}: {
		song: Song;
		inSet?: boolean;
		onTap: (song: Song) => void;
	} = $props();
</script>

<div
	class="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 dark:border-surface-700 dark:bg-surface-800"
>
	<!-- Song title: quieter once it's in the set, but still legible -->
	<span
		class="min-w-0 flex-1 truncate text-sm {inSet
			? 'text-surface-500 dark:text-surface-300'
			: 'font-medium text-surface-900 dark:text-surface-100'}"
	>
		{song.title}
	</span>

	{#if inSet}
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="shrink-0 text-surface-500 dark:text-surface-300"
			role="img"
			aria-label="In this set"
		>
			<path d="M20 6 9 17l-5-5" />
		</svg>
	{/if}

	<!-- Duration -->
	<span class="shrink-0 text-xs text-surface-500 dark:text-surface-300">
		<Digits value={formatDuration(song.duration_seconds)} />
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
