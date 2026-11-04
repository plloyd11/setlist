<script lang="ts">
	import Digits from '#lib/components/ui/Digits.svelte';
	import { formatDuration } from '#lib/utils/duration.js';
	import MediaIcons from './MediaIcons.svelte';
	import StatusChip from './StatusChip.svelte';
	import { panel, panelRows, rowLink } from './practiceStyles.js';

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
			status?: string | null;
			note?: string | null;
		}[];
		/** Where the shed screen's Back link returns to */
		from: string;
	} = $props();
</script>

<ul class="{panel} {panelRows} overflow-hidden">
	{#each songs as song (song.id)}
		<li>
			<a href="/songs/{song.id}/practice?from={from}" class={rowLink}>
				<span class="min-w-0 flex-1">
					<span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
						<span
							class="max-w-full truncate text-sm font-medium text-surface-900 dark:text-surface-100"
						>
							{song.title}
						</span>
						{#if song.status}
							<StatusChip status={song.status} />
						{/if}
					</span>
					{#if song.note}
						<span class="mt-0.5 block truncate text-xs text-surface-500 dark:text-surface-300">
							{song.note}
						</span>
					{/if}
				</span>
				<MediaIcons hasChart={song.hasChart} hasAudio={song.hasAudio} />
				<span class="min-w-10 shrink-0 text-right text-sm text-surface-500 dark:text-surface-300">
					<Digits value={formatDuration(song.durationSeconds)} />
				</span>
			</a>
		</li>
	{/each}
</ul>
