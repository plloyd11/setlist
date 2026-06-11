<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
	import { extractAudioMetadata } from '$lib/utils/audio';
	import { formatDuration } from '$lib/utils/duration';

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

	const MAX_FILE_SIZE = 50 * 1024 * 1024; // matches the bucket file_size_limit
	const ACCEPTED_TYPES = [
		'audio/mpeg',
		'audio/mp4',
		'audio/x-m4a',
		'audio/m4a',
		'audio/aac',
		'audio/wav',
		'audio/x-wav',
		'audio/wave',
		'audio/ogg'
	];
	// Browsers sometimes report no/odd MIME types for m4a — fall back to extension
	const EXT_MIME: Record<string, string> = {
		mp3: 'audio/mpeg',
		m4a: 'audio/mp4',
		aac: 'audio/aac',
		wav: 'audio/wav',
		ogg: 'audio/ogg'
	};

	let title = $state('');
	let file = $state<File | null>(null);
	let phase = $state<'idle' | 'analyzing' | 'uploading' | 'saving'>('idle');
	let uploadPercent = $state(0);
	let error = $state('');
	let notice = $state('');
	let dragging = $state(false);
	let fileInput: HTMLInputElement;
	let metaForm: HTMLFormElement;
	let activeXhr: XMLHttpRequest | null = null;
	let cancelRequested = false;

	// Filled in by startUpload() before the hidden form is submitted
	let storagePath = $state('');
	let mimeType = $state('');
	let durationSeconds = $state<number | null>(null);
	let peaksJson = $state('');

	let busy = $derived(phase !== 'idle');
	let canSubmit = $derived(!!file && !busy && (!!trackId || !!title.trim()));

	function fileExt(f: File): string {
		return f.name.split('.').pop()?.toLowerCase() ?? '';
	}

	function resolveMimeType(f: File): string | null {
		if (ACCEPTED_TYPES.includes(f.type)) return f.type;
		return EXT_MIME[fileExt(f)] ?? null;
	}

	function selectFile(f: File) {
		error = '';
		notice = '';
		if (!resolveMimeType(f)) {
			error = 'Please upload an MP3, M4A, WAV, OGG, or AAC audio file.';
			return;
		}
		if (f.size > MAX_FILE_SIZE) {
			error = 'Audio file must be under 50MB.';
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
			notice = `One track at a time — using "${f.name}".`;
		}
	}

	function putWithProgress(url: string, f: File, contentType: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			activeXhr = xhr;
			xhr.open('PUT', url);
			xhr.setRequestHeader('content-type', contentType);
			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable) uploadPercent = (e.loaded / e.total) * 100;
			};
			xhr.onload = () =>
				xhr.status >= 200 && xhr.status < 300
					? resolve()
					: reject(new Error(`Upload failed (${xhr.status})`));
			xhr.onerror = () => reject(new Error('Upload failed'));
			xhr.onabort = () => reject(new Error('Upload cancelled'));
			xhr.onloadend = () => {
				if (activeXhr === xhr) activeXhr = null;
			};
			xhr.send(f);
		});
	}

	async function startUpload() {
		if (!file || busy) return;
		error = '';
		notice = '';
		const resolved = resolveMimeType(file);
		if (!resolved) return;

		phase = 'analyzing';
		const meta = await extractAudioMetadata(file);
		durationSeconds = meta.durationSeconds;
		peaksJson = meta.peaks ? JSON.stringify(meta.peaks) : '';

		phase = 'uploading';
		uploadPercent = 0;
		mimeType = resolved;
		storagePath = `bands/${bandId}/tracks/${crypto.randomUUID()}.${fileExt(file) || 'mp3'}`;

		try {
			// Direct-to-storage upload: audio files exceed the serverless function
			// body limit, so only the metadata below goes through the form action.
			const { data, error: signError } = await supabase.storage
				.from('tracks')
				.createSignedUploadUrl(storagePath);
			if (signError || !data) throw new Error(signError?.message ?? 'Could not start upload');

			await putWithProgress(data.signedUrl, file, mimeType);
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
		}

		phase = 'saving';
		metaForm.requestSubmit();
	}

	async function removeUploadedObject() {
		try {
			await supabase.storage.from('tracks').remove([storagePath]);
		} catch {
			// Best-effort cleanup — orphaned objects are an accepted tradeoff
		}
	}

	function handleCancel() {
		if (phase === 'uploading') {
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

<div
	class="rounded-xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-900"
>
	<input
		bind:this={fileInput}
		type="file"
		accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac"
		onchange={handleFileSelect}
		class="hidden"
		disabled={busy}
	/>

	{#if !trackId}
		<input
			type="text"
			bind:value={title}
			placeholder="Track title..."
			disabled={busy}
			class="focus-live mb-3 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
		/>
	{/if}

	<div
		role="button"
		tabindex="0"
		aria-label="Choose an audio file"
		class="focus-live relative flex min-h-[100px] cursor-pointer items-center justify-center rounded-xl border-2 border-dashed transition-colors
			{dragging
			? 'border-accent-500 bg-accent-50 dark:border-accent-400 dark:bg-accent-900/20'
			: 'border-surface-300 bg-surface-50 hover:border-accent-400 dark:border-surface-600 dark:bg-surface-800/50 dark:hover:border-accent-600'}"
		onclick={() => !busy && fileInput.click()}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				if (!busy) fileInput.click();
			}
		}}
		ondrop={handleDrop}
		ondragover={(e) => {
			// Only claim OS file drags — track/folder card drags (see FolderRow)
			// must not light up or get swallowed by the upload dropzone
			if (!e.dataTransfer?.types.includes('Files')) return;
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
	>
		<div class="flex flex-col items-center gap-2 p-4 text-center">
			{#if file}
				<span class="text-sm font-medium text-surface-700 dark:text-surface-300">{file.name}</span>
				<span class="text-xs text-surface-500 dark:text-surface-300">
					{(file.size / (1024 * 1024)).toFixed(1)}MB
					{#if durationSeconds}&middot; {formatDuration(Math.round(durationSeconds))}{/if}
				</span>
			{:else}
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
				<span class="text-sm text-surface-500 dark:text-surface-300">
					Click or drag to choose an audio file
				</span>
				<span class="text-xs text-surface-500 dark:text-surface-300">
					MP3, M4A, WAV, OGG, or AAC (max 50MB)
				</span>
			{/if}
		</div>
	</div>

	<!-- Phase changes are announced; the percent stays visual-only (the progressbar
	     role carries it) so screen readers aren't spammed 4×/second -->
	<p class="sr-only" role="status">
		{phase === 'analyzing'
			? 'Analyzing audio'
			: phase === 'uploading'
				? 'Uploading'
				: phase === 'saving'
					? 'Saving'
					: ''}
	</p>

	{#if phase === 'analyzing'}
		<p class="mt-3 text-sm text-surface-500 dark:text-surface-300">Analyzing audio...</p>
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
			disabled={!canSubmit}
			class="focus-live rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600 disabled:opacity-50 disabled:hover:bg-accent-500"
		>
			{trackId ? 'Upload new version' : 'Upload track'}
		</button>
		{#if oncancel}
			<!-- Mid-upload, Cancel aborts the transfer; analyzing/saving are the only
			     unabortable moments (decode is synchronous, the metadata save is atomic) -->
			<button
				type="button"
				onclick={handleCancel}
				disabled={phase === 'analyzing' || phase === 'saving'}
				class="focus-live rounded-lg px-3 py-2 text-sm text-surface-500 hover:text-surface-700 disabled:opacity-50 dark:text-surface-300 dark:hover:text-surface-100"
			>
				{phase === 'uploading' ? 'Cancel upload' : 'Cancel'}
			</button>
		{/if}
	</div>
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
				const data = result.data as { trackId: string; versionNumber: number };
				phase = 'idle';
				file = null;
				title = '';
				if (onsuccess) {
					// Parent navigates (goto) — calling update() here would re-run
					// the current page's load and cancel that navigation
					onsuccess(data);
				} else {
					await update({ reset: true });
				}
			} else {
				// Metadata insert failed — clean up the already-uploaded audio
				await removeUploadedObject();
				phase = 'idle';
				error =
					result.type === 'failure'
						? String((result.data as { error?: string })?.error ?? 'Failed to save track')
						: 'Failed to save track';
			}
		};
	}}
>
	{#if trackId}
		<input type="hidden" name="track_id" value={trackId} />
	{:else if folderId}
		<input type="hidden" name="folder_id" value={folderId} />
	{/if}
	<input type="hidden" name="title" value={title} />
	<input type="hidden" name="storage_path" value={storagePath} />
	<input type="hidden" name="file_name" value={file?.name ?? ''} />
	<input type="hidden" name="mime_type" value={mimeType} />
	<input type="hidden" name="file_size_bytes" value={file?.size ?? ''} />
	<input type="hidden" name="duration_seconds" value={durationSeconds ?? ''} />
	<input type="hidden" name="waveform_peaks" value={peaksJson} />
</form>
