<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto, invalidateAll } from '$app/navigation';
	import WaveformPlayer from '$lib/components/tracks/WaveformPlayer.svelte';
	import VersionSwitcher from '$lib/components/tracks/VersionSwitcher.svelte';
	import TrackUploadForm from '$lib/components/tracks/TrackUploadForm.svelte';
	import CommentForm from '$lib/components/tracks/CommentForm.svelte';
	import CommentList, { type EnrichedComment } from '$lib/components/tracks/CommentList.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';

	let { data } = $props();

	let bandId = $derived(data.band.id);
	let showVersionForm = $state(false);
	let currentTime = $state(0);
	let replyTo = $state<EnrichedComment | null>(null);

	let player: WaveformPlayer | undefined = $state();
	let commentList: CommentList | undefined = $state();
	let confirmDialog: ConfirmDialog;
	let toast: Toast;
	let resolveForm: HTMLFormElement;
	let resolveInput: HTMLInputElement;
	let unresolveForm: HTMLFormElement;
	let unresolveInput: HTMLInputElement;
	let deleteCommentForm: HTMLFormElement;
	let deleteCommentInput: HTMLInputElement;
	let deleteTrackForm: HTMLFormElement;

	let uploaderProfile = $derived(
		data.selectedVersion.uploaded_by
			? (data.profiles[data.selectedVersion.uploaded_by] ?? null)
			: null
	);
	let uploadedLabel = $derived(
		new Date(data.selectedVersion.created_at).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	);
	let canDeleteTrack = $derived(data.currentUserId === data.track.created_by || data.isOwner);
	let isLatestVersion = $derived(
		data.selectedVersion.version_number === Math.max(...data.versions.map((v) => v.version_number))
	);

	// Waveform markers: top-level timestamped comments on the selected version.
	// The marker most recently passed by the playhead is the live one — it lights
	// up in step with the highlighted comment in the list below.
	let markers = $derived.by(() => {
		const base = data.comments
			.filter((c) => c.parent_id === null && c.timestamp_seconds !== null)
			.map((c) => ({
				id: c.id,
				time: c.timestamp_seconds ?? 0,
				label: c.body.length > 60 ? `${c.body.slice(0, 60)}...` : c.body,
				resolved: c.resolved_at !== null
			}));
		let activeId: string | null = null;
		let activeTime = -1;
		for (const m of base) {
			if (m.time <= currentTime && m.time >= activeTime) {
				activeId = m.id;
				activeTime = m.time;
			}
		}
		return base.map((m) => ({ ...m, active: m.id === activeId }));
	});

	function seekTo(time: number) {
		player?.seekTo(time);
	}

	// Space toggles playback from anywhere on the page except form fields and
	// other controls (where Space already means something)
	function handlePageKeydown(e: KeyboardEvent) {
		if (e.key !== ' ' || e.defaultPrevented) return;
		const target = e.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, button, a, [role="slider"], dialog')) return;
		e.preventDefault();
		player?.playPause();
	}

	function handleVersionUploaded(result: { versionNumber: number }) {
		showVersionForm = false;
		toast.show(`Version ${result.versionNumber} uploaded`, { variant: 'success' });
		goto(`?version=${result.versionNumber}`, { noScroll: true, invalidateAll: true });
	}

	function handleToggleResolve(comment: EnrichedComment) {
		if (comment.resolved_at) {
			unresolveInput.value = comment.id;
			unresolveForm.requestSubmit();
		} else {
			resolveInput.value = comment.id;
			resolveForm.requestSubmit();
		}
	}

	async function handleDeleteComment(comment: EnrichedComment) {
		const confirmed = await confirmDialog.confirm(
			'Delete Comment',
			'Are you sure you want to delete this comment? Replies will be deleted too.'
		);
		if (confirmed) {
			deleteCommentInput.value = comment.id;
			deleteCommentForm.requestSubmit();
		}
	}

	async function handleDeleteTrack() {
		const confirmed = await confirmDialog.confirm(
			'Delete Demo',
			`Are you sure you want to delete "${data.track.title}"? All versions and comments will be deleted. This cannot be undone.`
		);
		if (confirmed) {
			deleteTrackForm.requestSubmit();
		}
	}

	// Refresh the signed URL once (the common case: it expired mid-session).
	// If the same version errors again the audio itself is the problem —
	// fall back to the static error panel instead of looping reload → error.
	let retriedVersionId = $state<string | null>(null);
	let failedVersionId = $state<string | null>(null);

	function handlePlayerError() {
		if (retriedVersionId !== data.selectedVersion.id) {
			retriedVersionId = data.selectedVersion.id;
			toast.show('Playback session expired — reloading', { variant: 'error' });
			invalidateAll();
		} else {
			failedVersionId = data.selectedVersion.id;
		}
	}

	let audioFailed = $derived(failedVersionId === data.selectedVersion.id);
</script>

<svelte:window onkeydown={handlePageKeydown} />

<div class="p-6 md:p-8">
	<!-- Header -->
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0">
			<a
				href="/bands/{bandId}/demos"
				class="text-sm text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-200"
			>
				&larr; Demos
			</a>
			<h1 class="mt-1 font-display text-3xl text-surface-900 dark:text-surface-100">
				{data.track.title}
			</h1>
			{#if data.track.description}
				<p class="mt-1 text-sm text-surface-500 dark:text-surface-300">{data.track.description}</p>
			{/if}
			<p class="mt-1 text-xs text-surface-500 dark:text-surface-300">
				v{data.selectedVersion.version_number}
				&middot; {data.selectedVersion.file_name}
				&middot; uploaded by {uploaderProfile?.display_name ?? 'Former member'}
				&middot; {uploadedLabel}
			</p>
		</div>

		<div class="flex items-center gap-2">
			{#if data.versions.length > 1}
				<VersionSwitcher versions={data.versions} selected={data.selectedVersion.version_number} />
			{/if}
			<button
				onclick={() => (showVersionForm = !showVersionForm)}
				class="rounded-lg bg-accent-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-600"
			>
				+ Version
			</button>
			{#if canDeleteTrack}
				<button
					onclick={handleDeleteTrack}
					aria-label="Delete demo"
					class="rounded-lg border border-surface-300 px-3 py-1.5 text-sm font-medium text-danger-600 hover:bg-danger-50 dark:border-surface-600 dark:text-danger-400 dark:hover:bg-danger-900/20"
				>
					Delete
				</button>
			{/if}
		</div>
	</div>

	{#if showVersionForm}
		<div class="mt-4">
			<TrackUploadForm
				{bandId}
				trackId={data.track.id}
				supabase={data.supabase}
				action="?/uploadVersion"
				onsuccess={handleVersionUploaded}
				oncancel={() => (showVersionForm = false)}
			/>
		</div>
	{/if}

	{#if !isLatestVersion}
		<p
			class="mt-4 rounded-lg bg-surface-100 px-3 py-2 text-sm text-surface-600 dark:bg-surface-800 dark:text-surface-300"
		>
			You're listening to an older version. Comments below belong to v{data.selectedVersion
				.version_number}.
		</p>
	{/if}

	<!-- Player -->
	<div class="mt-4">
		{#if data.signedUrl && !audioFailed}
			{#key data.selectedVersion.id}
				<WaveformPlayer
					bind:this={player}
					url={data.signedUrl}
					peaks={data.selectedVersion.waveform_peaks}
					duration={data.selectedVersion.duration_seconds}
					{markers}
					ontimeupdate={(t) => (currentTime = t)}
					onmarkerclick={(id) => commentList?.scrollToComment(id)}
					onloaderror={handlePlayerError}
				/>
			{/key}
		{:else}
			<div
				class="rounded-xl border border-surface-200 bg-surface-50 p-6 text-center text-sm text-surface-500 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
			>
				Could not load audio for this version. Try refreshing the page.
			</div>
		{/if}
	</div>

	<!-- Comments -->
	<div class="mt-6">
		<h2 class="font-display text-xl text-surface-900 dark:text-surface-100">Feedback</h2>
		<div class="mt-3">
			<CommentForm
				versionId={data.selectedVersion.id}
				{currentTime}
				{replyTo}
				oncancelreply={() => (replyTo = null)}
				onposted={() => {
					replyTo = null;
					toast.show('Comment posted', { variant: 'success' });
				}}
			/>
		</div>
		<div class="mt-4">
			<CommentList
				bind:this={commentList}
				comments={data.comments}
				profiles={data.profiles}
				currentUserId={data.currentUserId}
				isOwner={data.isOwner}
				{currentTime}
				onseek={seekTo}
				onreply={(c) => (replyTo = c)}
				ontoggleresolve={handleToggleResolve}
				ondelete={handleDeleteComment}
			/>
		</div>
	</div>
</div>

<ConfirmDialog bind:this={confirmDialog} />
<Toast bind:this={toast} />

<!-- Hidden resolve form -->
<form
	bind:this={resolveForm}
	method="POST"
	action="?/resolveComment"
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				await update();
			} else if (result.type === 'failure') {
				toast.show('Failed to resolve comment', { variant: 'error' });
			}
		};
	}}
>
	<input bind:this={resolveInput} type="hidden" name="comment_id" value="" />
</form>

<!-- Hidden unresolve form -->
<form
	bind:this={unresolveForm}
	method="POST"
	action="?/unresolveComment"
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				await update();
			} else if (result.type === 'failure') {
				toast.show('Failed to reopen comment', { variant: 'error' });
			}
		};
	}}
>
	<input bind:this={unresolveInput} type="hidden" name="comment_id" value="" />
</form>

<!-- Hidden delete comment form -->
<form
	bind:this={deleteCommentForm}
	method="POST"
	action="?/deleteComment"
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.show('Comment deleted', { variant: 'success' });
				await update();
			} else if (result.type === 'failure') {
				toast.show('Failed to delete comment', { variant: 'error' });
			}
		};
	}}
>
	<input bind:this={deleteCommentInput} type="hidden" name="comment_id" value="" />
</form>

<!-- Hidden delete track form -->
<form
	bind:this={deleteTrackForm}
	method="POST"
	action="?/deleteTrack"
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'redirect') {
				await update();
			} else if (result.type === 'failure') {
				toast.show('Failed to delete demo', { variant: 'error' });
			}
		};
	}}
></form>
