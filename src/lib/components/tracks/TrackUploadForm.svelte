<script lang="ts">
	import type { SupabaseClient } from '@supabase/supabase-js';
	import AudioUploadZone from '$lib/components/ui/AudioUploadZone.svelte';

	let {
		bandId,
		trackId = null,
		folderId = null,
		supabase,
		action = '?/upload',
		onsuccess,
		oncancel
	}: {
		bandId: string;
		trackId?: string | null;
		folderId?: string | null;
		supabase: SupabaseClient;
		action?: string;
		onsuccess?: (result: { trackId: string; versionNumber: number }) => void;
		oncancel?: () => void;
	} = $props();

	let title = $state('');
	let busy = $state(false);
</script>

<div
	class="rounded-xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-900"
>
	{#if !trackId}
		<input
			type="text"
			bind:value={title}
			placeholder="Demo title..."
			disabled={busy}
			class="focus-live mb-3 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
		/>
	{/if}

	<AudioUploadZone
		{supabase}
		bucket="tracks"
		makePath={(ext) => `bands/${bandId}/tracks/${crypto.randomUUID()}.${ext}`}
		{action}
		uploadLabel={trackId ? 'Upload new version' : 'Upload demo'}
		saveErrorLabel="Failed to save demo"
		submitDisabled={!trackId && !title.trim()}
		bind:busy
		{oncancel}
		onsuccess={async (data, update) => {
			title = '';
			if (onsuccess) {
				// Parent navigates (goto) — calling update() here would re-run
				// the current page's load and cancel that navigation
				onsuccess(data as { trackId: string; versionNumber: number });
			} else {
				await update({ reset: true });
			}
		}}
	>
		{#snippet fields()}
			{#if trackId}
				<input type="hidden" name="track_id" value={trackId} />
			{:else if folderId}
				<input type="hidden" name="folder_id" value={folderId} />
			{/if}
			<input type="hidden" name="title" value={title} />
		{/snippet}
	</AudioUploadZone>
</div>
