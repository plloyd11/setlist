<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
	import { extractAudioMetadata } from '$lib/utils/audio';
	import {
		MAX_AUDIO_FILE_SIZE,
		fileExt,
		putWithProgress,
		resolveAudioMimeType
	} from '$lib/utils/audioUpload';
	import {
		MAX_SOURCE_FILE_SIZE,
		compressToMp3,
		mp3FileName,
		needsCompression
	} from '$lib/utils/audioCompress';
	import { formatDuration } from '$lib/utils/duration';

	let {
		supabase,
		bucket,
		makePath,
		action,
		uploadLabel,
		saveErrorLabel = 'Failed to save audio',
		submitDisabled = false,
		dense = false,
		busy = $bindable(false),
		fields,
		onsuccess,
		oncancel
	}: {
		supabase: SupabaseClient;
		bucket: string;
		/** Builds the storage object path for the chosen file's extension */
		makePath: (ext: string) => string;
		/** Form action that records the metadata row after the storage PUT */
		action: string;
		uploadLabel: string;
		saveErrorLabel?: string;
		/** Parent gate for the upload button (e.g. a required title field) */
		submitDisabled?: boolean;
		/** Tighter spacing for panel contexts */
		dense?: boolean;
		/** Bindable: true while analyzing/uploading/saving — parents use it to
		 * guard closes and disable their own inputs */
		busy?: boolean;
		/** Extra hidden inputs rendered inside the metadata form (track_id,
		 * song_id, title, label, ...) */
		fields?: Snippet;
		/** Full control over the post-save step; default is update({reset:true}).
		 * Parents that navigate or reset their own fields use this. */
		onsuccess?: (
			data: Record<string, unknown>,
			update: (opts?: { reset?: boolean }) => Promise<void>
		) => Promise<void> | void;
		/** Idle-state cancel — renders a Cancel button beside Upload when provided */
		oncancel?: () => void;
	} = $props();

	let file = $state<File | null>(null);
	let phase = $state<'idle' | 'analyzing' | 'compressing' | 'uploading' | 'saving'>('idle');
	let uploadPercent = $state(0);
	let compressPercent = $state(0);
	let error = $state('');
	let notice = $state('');
	let dragging = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();
	let metaForm: HTMLFormElement;
	let activeXhr: XMLHttpRequest | null = null;
	let compressAbort: AbortController | null = null;
	let cancelRequested = false;

	// Filled in by startUpload() before the hidden form is submitted
	let storagePath = $state('');
	let mimeType = $state('');
	let durationSeconds = $state<number | null>(null);
	let peaksJson = $state('');
	// What actually gets PUT — the selected file, or its MP3 after compression
	let uploadFile = $state<File | null>(null);

	$effect(() => {
		busy = phase !== 'idle';
	});

	function selectFile(f: File) {
		error = '';
		notice = '';
		if (!resolveAudioMimeType(f)) {
			error = 'Please upload an MP3, M4A, WAV, FLAC, OGG, AAC, or AIFF audio file.';
			return;
		}
		// The bucket's 50MB limit applies *after* client-side MP3 compression,
		// so the pick cap only guards memory during decode/encode
		if (f.size > MAX_SOURCE_FILE_SIZE) {
			error = 'Audio file must be under 250MB.';
			return;
		}
		file = f;
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const f = input.files?.[0];
		if (f) selectFile(f);
		input.value = '';
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		if (busy) return;
		const files = e.dataTransfer?.files;
		const f = files?.[0];
		if (!f) return;
		selectFile(f);
		// Never silently discard the rest of a multi-file drop
		if (!error && files.length > 1) {
			notice = `One file at a time — using "${f.name}".`;
		}
	}

	async function startUpload() {
		if (!file || busy || submitDisabled) return;
		error = '';
		notice = '';
		const resolved = resolveAudioMimeType(file);
		if (!resolved) return;

		phase = 'analyzing';
		const meta = await extractAudioMetadata(file);
		durationSeconds = meta.durationSeconds;
		peaksJson = meta.peaks ? JSON.stringify(meta.peaks) : '';

		uploadFile = file;
		mimeType = resolved;

		// Lossless files (and lossy ones over the bucket limit) are re-encoded
		// to 192kbps MP3 in a worker so they fit the bucket's 50MB cap
		if (needsCompression(file)) {
			if (!meta.buffer) {
				error = "Couldn't decode this file to compress it — try an MP3 or M4A instead.";
				phase = 'idle';
				return;
			}
			phase = 'compressing';
			compressPercent = 0;
			compressAbort = new AbortController();
			try {
				const blob = await compressToMp3(meta.buffer, {
					onprogress: (p) => (compressPercent = p),
					signal: compressAbort.signal
				});
				uploadFile = new File([blob], mp3FileName(file.name), { type: 'audio/mpeg' });
				mimeType = 'audio/mpeg';
			} catch (e) {
				if (e instanceof DOMException && e.name === 'AbortError') {
					notice = 'Upload cancelled.';
				} else {
					error = e instanceof Error ? e.message : 'Audio compression failed.';
				}
				phase = 'idle';
				return;
			} finally {
				compressAbort = null;
			}
			if (uploadFile.size > MAX_AUDIO_FILE_SIZE) {
				// ~36 min at 192kbps — only very long recordings land here
				error = 'Still over 50MB after compressing — trim the recording and try again.';
				phase = 'idle';
				return;
			}
		}

		phase = 'uploading';
		uploadPercent = 0;
		storagePath = makePath(fileExt(uploadFile) || 'mp3');

		try {
			// Direct-to-storage upload: audio files exceed the serverless function
			// body limit, so only the metadata below goes through the form action.
			const { data, error: signError } = await supabase.storage
				.from(bucket)
				.createSignedUploadUrl(storagePath);
			if (signError || !data) throw new Error(signError?.message ?? 'Could not start upload');

			await putWithProgress(data.signedUrl, uploadFile, mimeType, {
				onprogress: (p) => (uploadPercent = p),
				onxhr: (xhr) => (activeXhr = xhr)
			});
		} catch (e) {
			if (cancelRequested) {
				// User-initiated — clean up the partial object and reset quietly
				cancelRequested = false;
				await removeUploadedObject();
				notice = 'Upload cancelled.';
			} else {
				error = e instanceof Error ? e.message : 'Upload failed. Please try again.';
			}
			phase = 'idle';
			return;
		} finally {
			activeXhr = null;
		}

		phase = 'saving';
		metaForm.requestSubmit();
	}

	async function removeUploadedObject() {
		try {
			await supabase.storage.from(bucket).remove([storagePath]);
		} catch {
			// Best-effort cleanup — orphaned objects are an accepted tradeoff
		}
	}

	function handleCancel() {
		if (phase === 'compressing') {
			compressAbort?.abort();
		} else if (phase === 'uploading') {
			cancelRequested = true;
			activeXhr?.abort();
		} else if (!busy) {
			oncancel?.();
		}
	}
</script>

<!-- A closed tab kills the upload with no way back — warn while anything is in flight -->
<svelte:window
	onbeforeunload={(e) => {
		if (busy) e.preventDefault();
	}}
/>

<input
	bind:this={fileInput}
	type="file"
	accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac,.aiff,.aif"
	onchange={handleFileSelect}
	class="hidden"
	disabled={busy}
/>

<div
	role="button"
	tabindex="0"
	aria-label="Choose an audio file"
	class="focus-live relative flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed transition-colors {dense
		? 'min-h-[80px]'
		: 'min-h-[100px]'}
		{dragging
		? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-900/20'
		: 'border-surface-300 bg-surface-50 hover:border-accent-400 dark:border-surface-600 dark:bg-surface-800/50 dark:hover:border-accent-600'}"
	onclick={() => !busy && fileInput?.click()}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			if (!busy) fileInput?.click();
		}
	}}
	ondrop={handleDrop}
	ondragover={(e) => {
		// Only claim OS file drags — in-app card drags (tracks/folders) must
		// not light up or get swallowed by the upload dropzone
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		dragging = true;
	}}
	ondragleave={() => (dragging = false)}
>
	<div class="flex flex-col items-center text-center {dense ? 'gap-1 p-3' : 'gap-2 p-4'}">
		{#if file}
			<span class="text-sm font-medium text-surface-700 dark:text-surface-300">{file.name}</span>
			<span class="text-xs text-surface-500 dark:text-surface-300">
				{(file.size / (1024 * 1024)).toFixed(1)}MB
				{#if durationSeconds}&middot; {formatDuration(Math.round(durationSeconds))}{/if}
				{#if needsCompression(file)}&middot; compresses to MP3 on upload{/if}
			</span>
		{:else}
			{#if !dense}
				<svg
					class="h-8 w-8 text-surface-400 dark:text-surface-300"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
					/>
				</svg>
			{/if}
			<span class="text-sm text-surface-500 dark:text-surface-300">
				Click or drag to choose an audio file
			</span>
			<span class="text-xs text-surface-500 dark:text-surface-300">
				MP3, M4A, WAV, FLAC, OGG, AAC, or AIFF (up to 250MB — big files compress to MP3)
			</span>
		{/if}
	</div>
</div>

<!-- Phase changes are announced; the percent stays visual-only (the progressbar
     role carries it) so screen readers aren't spammed 4×/second -->
<p class="sr-only" role="status">
	{phase === 'analyzing'
		? 'Analyzing audio'
		: phase === 'compressing'
			? 'Compressing audio'
			: phase === 'uploading'
				? 'Uploading'
				: phase === 'saving'
					? 'Saving'
					: ''}
</p>

{#if phase === 'analyzing'}
	<p class="mt-3 text-sm text-surface-500 dark:text-surface-300">Analyzing audio...</p>
{:else if phase === 'compressing'}
	<div class="mt-3 space-y-1">
		<ProgressBar percent={compressPercent} isOver={false} ariaLabel="Compression progress" />
		<p class="text-xs text-surface-500 dark:text-surface-300">
			Compressing to MP3... {Math.round(compressPercent)}%
		</p>
	</div>
{:else if phase === 'uploading'}
	<div class="mt-3 space-y-1">
		<ProgressBar percent={uploadPercent} isOver={false} ariaLabel="Upload progress" />
		<p class="text-xs text-surface-500 dark:text-surface-300">
			Uploading... {Math.round(uploadPercent)}%
		</p>
	</div>
{:else if phase === 'saving'}
	<p class="mt-3 text-sm text-surface-500 dark:text-surface-300">Saving...</p>
{/if}

{#if error}
	<p role="alert" class="mt-3 text-sm text-danger-600 dark:text-danger-400">{error}</p>
{:else if notice}
	<p role="status" class="mt-3 text-sm text-surface-600 dark:text-surface-300">{notice}</p>
{/if}

<div class="mt-3 flex items-center gap-2">
	<button
		type="button"
		onclick={startUpload}
		disabled={!file || busy || submitDisabled}
		class="focus-live rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600 disabled:opacity-50 disabled:hover:bg-accent-500 {dense
			? 'text-sm'
			: ''}"
	>
		{uploadLabel}
	</button>
	{#if phase === 'compressing' || phase === 'uploading'}
		<button
			type="button"
			onclick={handleCancel}
			class="focus-live rounded-lg px-3 py-2 text-sm text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100"
		>
			Cancel upload
		</button>
	{:else if oncancel}
		<!-- Analyzing/saving are the only unabortable moments (decode is
		     synchronous, the metadata save is atomic) -->
		<button
			type="button"
			onclick={handleCancel}
			disabled={busy}
			class="focus-live rounded-lg px-3 py-2 text-sm text-surface-500 hover:text-surface-700 disabled:opacity-50 dark:text-surface-300 dark:hover:text-surface-100"
		>
			Cancel
		</button>
	{/if}
</div>

<!-- Hidden metadata form — submitted after the storage upload succeeds -->
<form
	bind:this={metaForm}
	method="POST"
	{action}
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success' && result.data) {
				phase = 'idle';
				file = null;
				uploadFile = null;
				durationSeconds = null;
				if (onsuccess) {
					await onsuccess(result.data as Record<string, unknown>, update);
				} else {
					await update({ reset: true });
				}
			} else {
				// Metadata insert failed — clean up the already-uploaded audio
				await removeUploadedObject();
				phase = 'idle';
				error =
					result.type === 'failure'
						? String((result.data as { error?: string })?.error ?? saveErrorLabel)
						: saveErrorLabel;
			}
		};
	}}
>
	{@render fields?.()}
	<input type="hidden" name="storage_path" value={storagePath} />
	<input type="hidden" name="file_name" value={uploadFile?.name ?? ''} />
	<input type="hidden" name="mime_type" value={mimeType} />
	<input type="hidden" name="file_size_bytes" value={uploadFile?.size ?? ''} />
	<input type="hidden" name="duration_seconds" value={durationSeconds ?? ''} />
	<input type="hidden" name="waveform_peaks" value={peaksJson} />
</form>
