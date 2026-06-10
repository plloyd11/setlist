<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDuration } from '$lib/utils/duration';
	import type { TrackComment } from '$lib/types/database';

	let {
		versionId,
		currentTime,
		replyTo = null,
		oncancelreply,
		onposted
	}: {
		versionId: string;
		currentTime: number;
		replyTo?: (TrackComment & { author_name: string }) | null;
		oncancelreply?: () => void;
		onposted?: () => void;
	} = $props();

	let body = $state('');
	// Frozen at capture time — never derived from the live playhead, so the pin
	// can't drift to wherever the song happens to be when the user hits submit
	let pinnedAt = $state<number | null>(null);
	let userUnpinned = $state(false);
	let submitting = $state(false);
	let error = $state('');

	// Capture the moment that prompted the note: when the user starts writing
	// mid-playback. Before any playback there's nothing to pin yet, and a
	// deliberately removed pin stays removed.
	function captureOnFocus() {
		if (replyTo === null && pinnedAt === null && !userUnpinned && currentTime > 0) {
			pinnedAt = currentTime;
		}
	}

	function pinNow() {
		pinnedAt = currentTime;
		userUnpinned = false;
	}

	function removePin() {
		pinnedAt = null;
		userUnpinned = true;
	}

	// Replies thread under their parent; only top-level comments carry a timestamp
	let effectiveTimestamp = $derived(replyTo === null ? pinnedAt : null);
</script>

<form
	method="POST"
	action="?/addComment"
	use:enhance={() => {
		submitting = true;
		return async ({ result, update }) => {
			submitting = false;
			if (result.type === 'success') {
				body = '';
				error = '';
				pinnedAt = null;
				userUnpinned = false;
				onposted?.();
				await update({ reset: true });
			} else if (result.type === 'failure') {
				error = String((result.data as { error?: string })?.error ?? 'Failed to post comment');
			}
		};
	}}
	class="space-y-2"
>
	<input type="hidden" name="version_id" value={versionId} />
	{#if replyTo}
		<input type="hidden" name="parent_id" value={replyTo.id} />
		<div
			class="flex items-center justify-between rounded-lg bg-surface-100 px-3 py-1.5 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300"
		>
			<span>Replying to {replyTo.author_name}</span>
			<button
				type="button"
				onclick={oncancelreply}
				class="font-medium text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
			>
				Cancel
			</button>
		</div>
	{/if}
	<input type="hidden" name="timestamp_seconds" value={effectiveTimestamp ?? ''} />

	<textarea
		name="body"
		bind:value={body}
		rows="2"
		required
		onfocus={captureOnFocus}
		placeholder={replyTo ? 'Write a reply...' : 'Leave feedback...'}
		class="focus-live w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
	></textarea>

	<div class="flex items-center justify-between">
		{#if replyTo === null}
			{#if pinnedAt !== null}
				<span
					class="inline-flex items-center gap-1.5 rounded-full bg-accent-100 py-0.5 pr-1 pl-2.5 text-xs font-medium text-accent-700 dark:bg-accent-900/40 dark:text-accent-300"
				>
					Pinned at <span class="font-mono font-semibold">{formatDuration(Math.round(pinnedAt))}</span>
					<button
						type="button"
						onclick={removePin}
						aria-label="Remove pin"
						class="focus-live flex h-5 w-5 items-center justify-center rounded-full hover:bg-accent-200 dark:hover:bg-accent-900/60"
					>
						<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
							<path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
						</svg>
					</button>
				</span>
			{:else}
				<button
					type="button"
					onclick={pinNow}
					class="focus-live text-sm font-medium text-surface-600 hover:text-surface-900 dark:text-surface-300 dark:hover:text-surface-100"
				>
					Pin at <span class="font-mono">{formatDuration(Math.round(currentTime))}</span>
				</button>
			{/if}
		{:else}
			<span></span>
		{/if}
		<button
			type="submit"
			disabled={!body.trim() || submitting}
			class="rounded-lg bg-accent-500 px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-600 disabled:opacity-50 disabled:hover:bg-accent-500"
		>
			{replyTo ? 'Reply' : 'Comment'}
		</button>
	</div>

	{#if error}
		<p role="alert" class="text-sm text-danger-600 dark:text-danger-400">{error}</p>
	{/if}
</form>
