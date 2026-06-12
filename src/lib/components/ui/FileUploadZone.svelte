<script lang="ts">
	import { enhance } from '$app/forms';
	import type { Snippet } from 'svelte';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
	import { fileExt, putWithProgress } from '$lib/utils/audioUpload';
	import { MAX_CHART_FILE_SIZE, CHART_ACCEPT, resolveChartMimeType } from '$lib/utils/chartUpload';

	let {
		supabase,
		bucket,
		makePath,
		action,
		uploadLabel,
		saveErrorLabel = 'Failed to save file',
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
		/** Parent gate for the upload button */
		submitDisabled?: boolean;
		/** Tighter spacing for panel contexts */
		dense?: boolean;
		/** Bindable: true while uploading/saving — parents use it to guard
		 * closes and disable their own inputs */
		busy?: boolean;
		/** Extra hidden inputs rendered inside the metadata form (song_id,
		 * label, ...) */
		fields?: Snippet;
		/** Full control over the post-save step; default is update({reset:true}). */
		onsuccess?: (
			data: Record<string, unknown>,
			update: (opts?: { reset?: boolean }) => Promise<void>
		) => Promise<void> | void;
		/** Idle-state cancel — renders a Cancel button beside Upload when provided */
		oncancel?: () => void;
	} = $props();

	let file = $state<File | null>(null);
	let phase = $state<'idle' | 'uploading' | 'saving'>('idle');
	let uploadPercent = $state(0);
	let error = $state('');
	let notice = $state('');
	let dragging = $state(false);
	let fileInput: HTMLInputElement | undefined = $state();
	let metaForm: HTMLFormElement;
	let activeXhr: XMLHttpRequest | null = null;
	let cancelRequested = false;

	// Filled in by startUpload() before the hidden form is submitted
	let storagePath = $state('');
	let mimeType = $state('');

	$effect(() => {
		busy = phase !== 'idle';
	});

	function selectFile(f: File) {
		error = '';
		notice = '';
		if (!resolveChartMimeType(f)) {
			error = 'Please upload a PDF, Word doc, or Guitar Pro file.';
			return;
		}
		if (f.size > MAX_CHART_FILE_SIZE) {
			error = 'File must be under 25MB.';
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
		const resolved = resolveChartMimeType(file);
		if (!resolved) return;

		phase = 'uploading';
		uploadPercent = 0;
		mimeType = resolved;
		storagePath = makePath(fileExt(file) || 'pdf');

		try {
			// Direct-to-storage upload — only the metadata below goes through the
			// form action (same flow as audio uploads).
			const { data, error: signError } = await supabase.storage
				.from(bucket)
				.createSignedUploadUrl(storagePath);
			if (signError || !data) throw new Error(signError?.message ?? 'Could not start upload');

			await putWithProgress(data.signedUrl, file, mimeType, {
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

<input
	bind:this={fileInput}
	type="file"
	accept={CHART_ACCEPT}
	onchange={handleFileSelect}
	class="hidden"
	disabled={busy}
/>

<div
	role="button"
	tabindex="0"
	aria-label="Choose a chart or tab file"
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
						d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
					/>
				</svg>
			{/if}
			<span class="text-sm text-surface-500 dark:text-surface-300">
				Click or drag to choose a chart or tab
			</span>
			<span class="text-xs text-surface-500 dark:text-surface-300">
				PDF, Word, or Guitar Pro (max 25MB)
			</span>
		{/if}
	</div>
</div>

<!-- Phase changes are announced; the percent stays visual-only (the progressbar
     role carries it) so screen readers aren't spammed 4×/second -->
<p class="sr-only" role="status">
	{phase === 'uploading' ? 'Uploading' : phase === 'saving' ? 'Saving' : ''}
</p>

{#if phase === 'uploading'}
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
	{#if phase === 'uploading'}
		<button
			type="button"
			onclick={handleCancel}
			class="focus-live rounded-lg px-3 py-2 text-sm text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100"
		>
			Cancel upload
		</button>
	{:else if oncancel}
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
				if (onsuccess) {
					await onsuccess(result.data as Record<string, unknown>, update);
				} else {
					await update({ reset: true });
				}
			} else {
				// Metadata insert failed — clean up the already-uploaded file
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
	<input type="hidden" name="file_name" value={file?.name ?? ''} />
	<input type="hidden" name="mime_type" value={mimeType} />
	<input type="hidden" name="file_size_bytes" value={file?.size ?? ''} />
</form>
