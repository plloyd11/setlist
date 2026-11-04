<script lang="ts">
	import SessionStrip from '#lib/components/practice/SessionStrip.svelte';
	import StatusChip from '#lib/components/practice/StatusChip.svelte';
	import {
		STATUS_TONES,
		microLabel,
		panel,
		panelFooter,
		panelRows,
		rowLink,
		secondaryButton
	} from '#lib/components/practice/practiceStyles.js';
	import type { GigPrep } from './shared.js';

	let { prep }: { prep: GigPrep } = $props();

	const songs = (count: number) => (count === 1 ? '1 song' : `${count} songs`);

	let total = $derived(
		prep.counts
			? prep.counts.solid + prep.counts.learning + prep.counts.needs_work + prep.counts.unmarked
			: 0
	);

	/** Solid fills from the left, so the strip reads as how far along you are */
	let segments = $derived(
		prep.counts
			? [
					{ key: 'solid', label: 'Solid', amount: prep.counts.solid },
					{ key: 'learning', label: 'Learning', amount: prep.counts.learning },
					{ key: 'needs_work', label: 'Needs work', amount: prep.counts.needs_work },
					{ key: 'unmarked', label: 'Not marked', amount: prep.counts.unmarked }
				]
					.filter((part) => part.amount > 0)
					.map((part) => ({
						key: part.key,
						label: part.label,
						seconds: part.amount,
						tone: STATUS_TONES[part.key as keyof typeof STATUS_TONES]
					}))
			: []
	);

	let emptyMessage = $derived.by(() => {
		if (prep.counts && total === 0) return "Add songs to the set and they'll line up here.";
		if (prep.counts) return 'Everything in this set is solid. Go run it.';
		return "Nothing flagged. Mark songs in Shed and they'll line up here.";
	});
</script>

<section aria-labelledby="gig-prep" class="{panel} overflow-hidden">
	<div class="px-4 py-3.5">
		<div class="flex items-baseline justify-between gap-3">
			<h2 id="gig-prep" class={microLabel}>{prep.counts ? 'Getting ready' : 'Shed next'}</h2>
			{#if prep.counts && total > 0}
				<p class="text-sm font-semibold text-surface-900 dark:text-surface-100">
					{prep.counts.solid} of {total} solid
				</p>
			{/if}
		</div>
		{#if segments.length > 0}
			<div class="mt-2.5">
				<SessionStrip {segments} label="This set's songs" format={songs} />
			</div>
		{/if}
		{#if prep.songs.length === 0}
			<p class="mt-2.5 text-sm text-surface-500 dark:text-surface-300">{emptyMessage}</p>
		{/if}
	</div>

	{#if prep.songs.length > 0}
		<ul class="{panelRows} border-t border-surface-200 dark:border-surface-700">
			{#each prep.songs as song (song.id)}
				<li>
					<a href="/songs/{song.id}/practice?from=/dashboard" class={rowLink}>
						<span
							class="min-w-0 flex-1 truncate text-sm font-medium text-surface-900 dark:text-surface-100"
						>
							{song.title}
						</span>
						{#if song.status}
							<StatusChip status={song.status} />
						{:else}
							<span class="shrink-0 text-xs text-surface-500 dark:text-surface-300">
								Not marked
							</span>
						{/if}
					</a>
				</li>
			{/each}
			{#if prep.moreSongs > 0}
				<li>
					<a
						href="/practice/shed"
						class="{rowLink} text-sm font-medium text-accent-600 dark:text-accent-300"
					>
						{prep.moreSongs} more in Shed
					</a>
				</li>
			{/if}
		</ul>
	{/if}

	<div class="{panelFooter} p-3">
		<a href="/practice" class="{secondaryButton} flex w-full items-center justify-center">
			Today's session
		</a>
	</div>
</section>
