<script lang="ts">
	import { formatDuration } from '$lib/utils/duration';
	import type { EnrichedComment } from './CommentList.svelte';

	let {
		comment,
		isReply = false,
		canDelete,
		highlighted = false,
		flashed = false,
		onseek,
		onreply,
		ontoggleresolve,
		ondelete
	}: {
		comment: EnrichedComment;
		isReply?: boolean;
		canDelete: boolean;
		highlighted?: boolean;
		flashed?: boolean;
		onseek: (time: number) => void;
		onreply?: (comment: EnrichedComment) => void;
		ontoggleresolve: (comment: EnrichedComment) => void;
		ondelete: (comment: EnrichedComment) => void;
	} = $props();

	let resolved = $derived(comment.resolved_at !== null);
	let initial = $derived(comment.author_name.charAt(0).toUpperCase());
	let timeLabel = $derived(
		new Date(comment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
	);
</script>

<div
	id="track-comment-{comment.id}"
	class="rounded-lg border p-3 transition-colors
		{flashed
		? 'border-neon-600 bg-neon-500/10 dark:border-neon-400 dark:bg-neon-400/10'
		: highlighted
			? 'border-neon-600/60 bg-neon-500/5 dark:border-neon-400/60 dark:bg-neon-400/5'
			: 'border-surface-200 bg-surface-50 dark:border-surface-800 dark:bg-surface-900'}
		{resolved ? 'opacity-60' : ''}"
>
	<div class="flex items-start gap-2.5">
		{#if comment.author_logo_url}
			<img
				src={comment.author_logo_url}
				alt={comment.author_name}
				class="h-7 w-7 shrink-0 rounded-full object-cover"
			/>
		{:else}
			<div
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-100 text-xs font-semibold text-accent-700 dark:bg-surface-700 dark:text-surface-300"
			>
				{initial}
			</div>
		{/if}

		<div class="min-w-0 flex-1">
			<div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
				<span class="text-sm font-medium text-surface-900 dark:text-surface-100">
					{comment.author_name}
				</span>
				{#if comment.timestamp_seconds !== null}
					<button
						type="button"
						onclick={() => onseek(comment.timestamp_seconds ?? 0)}
						class="focus-live rounded bg-accent-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-accent-800 hover:bg-accent-200 dark:bg-accent-900/40 dark:text-accent-300 dark:hover:bg-accent-900/60"
					>
						{formatDuration(Math.round(comment.timestamp_seconds))}
					</button>
				{/if}
				<span class="text-xs text-surface-500 dark:text-surface-300">{timeLabel}</span>
				{#if resolved}
					<span
						class="rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-700 dark:bg-success-900/30 dark:text-success-400"
					>
						Resolved{comment.resolver_name ? ` by ${comment.resolver_name}` : ''}
					</span>
				{/if}
			</div>

			<p class="mt-1 text-sm whitespace-pre-wrap text-surface-700 dark:text-surface-300">
				{comment.body}
			</p>

			<!-- Negative margins keep the visual rhythm while widening the touch targets -->
			<div class="mt-0.5 -mb-1 flex items-center gap-1">
				{#if !isReply && onreply}
					<button
						type="button"
						onclick={() => onreply(comment)}
						class="focus-live -ml-1.5 rounded px-1.5 py-1.5 text-xs font-medium text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-200"
					>
						Reply
					</button>
				{/if}
				{#if !isReply}
					<button
						type="button"
						onclick={() => ontoggleresolve(comment)}
						class="focus-live rounded px-1.5 py-1.5 text-xs font-medium text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-200
							{isReply || !onreply ? '-ml-1.5' : ''}"
					>
						{resolved ? 'Reopen' : 'Resolve'}
					</button>
				{/if}
				{#if canDelete}
					<button
						type="button"
						onclick={() => ondelete(comment)}
						class="focus-live rounded px-1.5 py-1.5 text-xs font-medium text-danger-600 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300
							{isReply && !canDelete ? '-ml-1.5' : ''}"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
