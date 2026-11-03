<script lang="ts">
	import { formatDuration } from '#lib/utils/duration.js';

	let {
		songs,
		from
	}: {
		songs: {
			id: string;
			title: string;
			durationSeconds: number;
			hasAudio: boolean;
			hasChart: boolean;
		}[];
		/** Where the shed screen's Back link returns to */
		from: string;
	} = $props();
</script>

<ul
	class="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-surface-50 dark:divide-surface-700 dark:border-surface-700 dark:bg-surface-800/50"
>
	{#each songs as song (song.id)}
		<li>
			<a
				href="/songs/{song.id}/practice?from={from}"
				class="focus-live flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-800"
			>
				<span
					class="min-w-0 flex-1 truncate text-sm font-medium text-surface-900 dark:text-surface-100"
				>
					{song.title}
				</span>
				{#if song.hasChart}
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
						class="shrink-0 text-accent-500 dark:text-accent-400"
						role="img"
						aria-label="Has a chart"
					>
						<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
						<path d="M14 2v6h6M8 13h8M8 17h8" />
					</svg>
				{/if}
				{#if song.hasAudio}
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
						class="shrink-0 text-accent-500 dark:text-accent-400"
						role="img"
						aria-label="Has audio"
					>
						<path d="M9 18V5l12-2v13" />
						<circle cx="6" cy="18" r="3" />
						<circle cx="18" cy="16" r="3" />
					</svg>
				{/if}
				<span class="shrink-0 text-sm text-surface-500 tabular-nums dark:text-surface-300">
					{formatDuration(song.durationSeconds)}
				</span>
			</a>
		</li>
	{/each}
</ul>
