<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { fade, fly } from 'svelte/transition';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import type { SongAudio, SongFile } from '$lib/types/database';
	import AudioUploadZone from '$lib/components/ui/AudioUploadZone.svelte';
	import FileUploadZone from '$lib/components/ui/FileUploadZone.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import { formatDuration } from '$lib/utils/duration';

	type Variant = Omit<SongAudio, 'waveform_peaks'>;

	let {
		song,
		variants,
		files = [],
		supabase,
		canManage = true,
		updateAction = '?/updateSong',
		uploadAction = '?/uploadAudio',
		deleteAudioAction = '?/deleteAudio',
		uploadFileAction = '?/uploadFile',
		deleteFileAction = '?/deleteFile',
		practiceHref,
		onclose
	}: {
		song: { id: string; title: string; duration_seconds: number; notes: string | null };
		variants: Variant[];
		files?: SongFile[];
		supabase: SupabaseClient;
		canManage?: boolean;
		updateAction?: string;
		uploadAction?: string;
		deleteAudioAction?: string;
		uploadFileAction?: string;
		deleteFileAction?: string;
		/** When set, renders a Practice link in the header */
		practiceHref?: string;
		onclose: () => void;
	} = $props();

	const MAX_LABEL_LENGTH = 60;
	const reduceMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let panelEl: HTMLElement | undefined = $state();
	let confirmDialog: ConfirmDialog;
	let deleteForm: HTMLFormElement;
	let deleteInput: HTMLInputElement;
	let deleteFileForm: HTMLFormElement;
	let deleteFileInput: HTMLInputElement;

	// Details form state — re-seeded when the panel switches songs
	let editTitle = $state('');
	let editDuration = $state('');
	let editNotes = $state('');
	let detailsError = $state('');
	let detailsSaving = $state(false);
	let detailsSaved = $state(false);
	let savedTimer: ReturnType<typeof setTimeout> | undefined;

	// Track song.id ONLY: re-seeding must not also fire when an unrelated
	// invalidation (variant upload/rename/delete) refreshes the song prop —
	// that would wipe the user's unsaved edits mid-typing.
	$effect(() => {
		void song.id;
		untrack(() => {
			editTitle = song.title;
			editDuration = formatDuration(song.duration_seconds);
			editNotes = song.notes ?? '';
			detailsError = '';
		});
	});

	// Upload state owned by the upload zones; the panel only needs the label
	// fields and the busy flags (to guard closes)
	let label = $state('');
	let uploadBusy = $state(false);
	let audioError = $state('');
	let fileLabel = $state('');
	let fileUploadBusy = $state(false);
	let fileError = $state('');

	// Inline label rename (the column grants only permit updating label).
	// One rename at a time across both lists; the table tells saveRename
	// which one the id belongs to.
	let renamingId = $state<string | null>(null);
	let renamingTable = $state<'song_audio' | 'song_files'>('song_audio');
	let renameValue = $state('');
	let renameSaving = $state(false);

	$effect(() => {
		panelEl?.focus();
	});

	function requestClose() {
		// Closing mid-upload would silently kill the transfer
		if (uploadBusy || fileUploadBusy) return;
		onclose();
	}

	function handleWindowKeydown(e: KeyboardEvent) {
		// A nested <dialog> (delete confirm) owns Esc while it's open
		if ((e.target as HTMLElement | null)?.closest?.('dialog')) return;
		if (e.key === 'Escape' && renamingId === null) {
			requestClose();
		}
	}

	// Minimal focus trap: aria-modal promises focus stays inside the panel.
	// The nested ConfirmDialog is a native modal <dialog>, which traps on its
	// own while open.
	function handlePanelKeydown(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !panelEl) return;
		const focusables = panelEl.querySelectorAll<HTMLElement>(
			'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
		);
		if (focusables.length === 0) return;
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		const active = document.activeElement;
		if (e.shiftKey && (active === first || active === panelEl)) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}

	function startRename(v: { id: string; label: string | null }, table: typeof renamingTable) {
		renamingId = v.id;
		renamingTable = table;
		renameValue = v.label ?? '';
		audioError = '';
		fileError = '';
	}

	async function saveRename() {
		if (!renamingId || renameSaving) return;
		const trimmed = renameValue.trim();
		renameSaving = true;
		// .select() so an RLS-filtered no-op fails loudly instead of faking success
		const { data, error: renameError } = await supabase
			.from(renamingTable)
			.update({ label: trimmed || null })
			.eq('id', renamingId)
			.select('id')
			.single();
		renameSaving = false;
		if (renameError || !data) {
			if (renamingTable === 'song_audio') audioError = 'Failed to rename';
			else fileError = 'Failed to rename';
			return;
		}
		renamingId = null;
		await invalidateAll();
	}

	function handleRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveRename();
		} else if (e.key === 'Escape') {
			// Stop Esc from also closing the panel
			e.stopPropagation();
			e.preventDefault();
			renamingId = null;
		}
	}

	async function handleDeleteVariant(v: Variant) {
		const confirmed = await confirmDialog.confirm(
			'Delete Audio',
			`Delete "${v.label ?? v.file_name}" from "${song.title}"? This can't be undone.`
		);
		if (confirmed) {
			deleteInput.value = v.id;
			deleteForm.requestSubmit();
		}
	}

	async function handleDeleteFile(f: SongFile) {
		const confirmed = await confirmDialog.confirm(
			'Delete File',
			`Delete "${f.label ?? f.file_name}" from "${song.title}"? This can't be undone.`
		);
		if (confirmed) {
			deleteFileInput.value = f.id;
			deleteFileForm.requestSubmit();
		}
	}

	// Signed URLs are minted client-side through the user-scoped client — the
	// storage SELECT policy gates access, so band members can open/download
	// charts on songs shared with them.
	async function openFile(f: SongFile) {
		fileError = '';
		// Open the window synchronously so popup blockers attribute it to the click
		const win = window.open('', '_blank');
		const { data } = await supabase.storage.from('song-files').createSignedUrl(f.storage_path, 60);
		if (data?.signedUrl && win) {
			win.location = data.signedUrl;
		} else {
			win?.close();
			fileError = 'Could not open file';
		}
	}

	async function downloadFile(f: SongFile) {
		fileError = '';
		const { data } = await supabase.storage
			.from('song-files')
			.createSignedUrl(f.storage_path, 60, { download: f.file_name });
		if (data?.signedUrl) {
			window.location.assign(data.signedUrl);
		} else {
			fileError = 'Could not download file';
		}
	}

	function formatSize(bytes: number): string {
		return bytes >= 1024 * 1024
			? `${(bytes / (1024 * 1024)).toFixed(1)}MB`
			: `${Math.max(1, Math.round(bytes / 1024))}KB`;
	}
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<!-- Backdrop -->
<button
	type="button"
	class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
	aria-label="Close panel"
	onclick={requestClose}
	transition:fade={{ duration: reduceMotion ? 0 : 150 }}
></button>

<!-- Flyout panel -->
<div
	bind:this={panelEl}
	role="dialog"
	aria-modal="true"
	aria-label="Song details: {song.title}"
	tabindex="-1"
	class="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto border-l border-surface-200 bg-surface-50 shadow-xl focus:outline-none dark:border-surface-700 dark:bg-surface-800"
	transition:fly={{ x: 512, duration: reduceMotion ? 0 : 200, opacity: 1 }}
	onkeydown={handlePanelKeydown}
>
	<!-- Header -->
	<div
		class="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-surface-200 bg-surface-50 px-6 py-4 dark:border-surface-700 dark:bg-surface-800"
	>
		<div class="min-w-0">
			<h3
				class="truncate font-display text-lg font-semibold text-surface-900 dark:text-surface-100"
			>
				{song.title}
			</h3>
			<p class="text-xs text-surface-500 dark:text-surface-300">
				{formatDuration(song.duration_seconds)}
				{#if variants.length > 0}
					&middot; {variants.length} audio {variants.length === 1 ? 'file' : 'files'}
				{/if}
				{#if files.length > 0}
					&middot; {files.length} {files.length === 1 ? 'chart' : 'charts'}
				{/if}
			</p>
		</div>
		{#if practiceHref}
			<!-- The panel's primary verb — copper, same vocabulary as primary buttons -->
			<a
				href={practiceHref}
				class="focus-live inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-600"
			>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z" />
				</svg>
				Practice
			</a>
		{/if}
		<button
			type="button"
			onclick={requestClose}
			disabled={uploadBusy || fileUploadBusy}
			class="focus-live rounded p-1 text-surface-400 hover:bg-surface-100 disabled:opacity-50 dark:hover:bg-surface-700"
			aria-label="Close"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="flex-1 px-6 py-5">
		<!-- Details -->
		<form
			method="POST"
			action={updateAction}
			use:enhance={() => {
				detailsSaving = true;
				detailsError = '';
				return async ({ result, update }) => {
					detailsSaving = false;
					if (result.type === 'success') {
						detailsSaved = true;
						clearTimeout(savedTimer);
						savedTimer = setTimeout(() => (detailsSaved = false), 2000);
						await update({ reset: false });
					} else {
						detailsError =
							result.type === 'failure'
								? String((result.data as { error?: string })?.error ?? 'Failed to save changes')
								: 'Failed to save changes';
					}
				};
			}}
		>
			<input type="hidden" name="song_id" value={song.id} />
			<div class="flex gap-3">
				<label class="min-w-0 flex-1">
					<span
						class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
					>
						Title
					</span>
					<input
						type="text"
						name="title"
						bind:value={editTitle}
						required
						class="focus-live mt-1 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
					/>
				</label>
				<label class="w-20 shrink-0">
					<span
						class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
					>
						Length
					</span>
					<input
						type="text"
						name="duration"
						bind:value={editDuration}
						placeholder="3:45"
						inputmode="numeric"
						required
						class="focus-live mt-1 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-center text-surface-900 tabular-nums dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
					/>
				</label>
			</div>
			<label class="mt-3 block">
				<span
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
				>
					Notes
				</span>
				<textarea
					name="notes"
					bind:value={editNotes}
					rows="3"
					placeholder="Stage cues, count-ins, tunings..."
					class="focus-live mt-1 w-full resize-y rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
				></textarea>
			</label>
			{#if detailsError}
				<p role="alert" class="mt-2 text-sm text-danger-600 dark:text-danger-400">
					{detailsError}
				</p>
			{/if}
			<div class="mt-3 flex items-center gap-3">
				<button
					type="submit"
					disabled={detailsSaving || !editTitle.trim()}
					class="focus-live rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-600 disabled:opacity-50"
				>
					Save
				</button>
				{#if detailsSaved}
					<span role="status" class="text-sm text-success-600 dark:text-success-400">Saved</span>
				{/if}
			</div>
		</form>

		<!-- Rehearsal audio -->
		<div class="mt-6 border-t border-surface-200 pt-5 dark:border-surface-700">
			<h4 class="font-display text-sm font-semibold text-surface-900 dark:text-surface-100">
				Rehearsal audio
			</h4>
			<p class="mt-0.5 text-xs text-surface-500 dark:text-surface-300">
				Plays in rehearse mode — upload variants like a mix without your instrument.
			</p>

			{#if variants.length > 0}
				<ul
					class="mt-3 divide-y divide-surface-200 overflow-hidden rounded-lg border border-surface-200 dark:divide-surface-700 dark:border-surface-700"
				>
					{#each variants as variant (variant.id)}
						<li class="flex items-center gap-3 px-3 py-2.5">
							{#if renamingId === variant.id}
								<input
									type="text"
									bind:value={renameValue}
									placeholder={'Label — e.g. "No guitar"'}
									maxlength={MAX_LABEL_LENGTH}
									disabled={renameSaving}
									onkeydown={handleRenameKeydown}
									class="focus-live min-w-0 flex-1 rounded border border-surface-300 bg-surface-50 px-2 py-1 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
								/>
								<button
									type="button"
									onclick={saveRename}
									disabled={renameSaving}
									class="rounded p-1 text-success-600 hover:bg-success-50 disabled:opacity-50 dark:text-success-400 dark:hover:bg-success-900/20"
									aria-label="Save label"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								</button>
								<button
									type="button"
									onclick={() => (renamingId = null)}
									disabled={renameSaving}
									class="rounded p-1 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700"
									aria-label="Cancel rename"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M18 6 6 18M6 6l12 12" />
									</svg>
								</button>
							{:else}
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-surface-900 dark:text-surface-100">
										{#if variant.label}
											{variant.label}
										{:else}
											<span class="text-surface-500 italic dark:text-surface-300">Unlabeled</span>
										{/if}
									</p>
									<p class="truncate text-xs text-surface-500 dark:text-surface-300">
										{variant.file_name}
										{#if variant.duration_seconds}
											&middot; {formatDuration(Math.round(variant.duration_seconds))}
										{/if}
									</p>
								</div>
								{#if canManage}
									<button
										type="button"
										onclick={() => startRename(variant, 'song_audio')}
										class="rounded p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-700 dark:hover:text-surface-200"
										aria-label="Rename {variant.label ?? variant.file_name}"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path
												d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
											/>
										</svg>
									</button>
									<button
										type="button"
										onclick={() => handleDeleteVariant(variant)}
										class="rounded p-1 text-surface-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/20 dark:hover:text-danger-400"
										aria-label="Delete {variant.label ?? variant.file_name}"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path
												d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											/>
										</svg>
									</button>
								{/if}
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="mt-3 text-sm text-surface-500 dark:text-surface-300">
					No audio yet{canManage
						? ' — upload a mix to rehearse with.'
						: ". Only the song's owner can upload rehearsal audio."}
				</p>
			{/if}

			{#if audioError}
				<p role="alert" class="mt-2 text-sm text-danger-600 dark:text-danger-400">{audioError}</p>
			{/if}

			{#if canManage}
				<div class="mt-4">
					<input
						type="text"
						bind:value={label}
						placeholder={'Label — e.g. "No guitar" (optional)'}
						maxlength={MAX_LABEL_LENGTH}
						disabled={uploadBusy}
						class="focus-live mb-3 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
					/>

					<AudioUploadZone
						{supabase}
						bucket="song-audio"
						makePath={(ext) => `songs/${song.id}/${crypto.randomUUID()}.${ext}`}
						action={uploadAction}
						uploadLabel="Upload audio"
						dense
						bind:busy={uploadBusy}
						onsuccess={async (_data, update) => {
							label = '';
							await update({ reset: true });
						}}
					>
						{#snippet fields()}
							<input type="hidden" name="song_id" value={song.id} />
							<input type="hidden" name="label" value={label} />
						{/snippet}
					</AudioUploadZone>
				</div>
			{/if}
		</div>

		<!-- Charts & tabs -->
		<div class="mt-6 border-t border-surface-200 pt-5 dark:border-surface-700">
			<h4 class="font-display text-sm font-semibold text-surface-900 dark:text-surface-100">
				Charts & tabs
			</h4>
			<p class="mt-0.5 text-xs text-surface-500 dark:text-surface-300">
				PDFs, Word docs, and Guitar Pro files — chord charts, tabs, lyric sheets.
			</p>

			{#if files.length > 0}
				<ul
					class="mt-3 divide-y divide-surface-200 overflow-hidden rounded-lg border border-surface-200 dark:divide-surface-700 dark:border-surface-700"
				>
					{#each files as file (file.id)}
						<li class="flex items-center gap-3 px-3 py-2.5">
							{#if renamingId === file.id}
								<input
									type="text"
									bind:value={renameValue}
									placeholder={'Label — e.g. "Rhythm tab"'}
									maxlength={MAX_LABEL_LENGTH}
									disabled={renameSaving}
									onkeydown={handleRenameKeydown}
									class="focus-live min-w-0 flex-1 rounded border border-surface-300 bg-surface-50 px-2 py-1 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
								/>
								<button
									type="button"
									onclick={saveRename}
									disabled={renameSaving}
									class="rounded p-1 text-success-600 hover:bg-success-50 disabled:opacity-50 dark:text-success-400 dark:hover:bg-success-900/20"
									aria-label="Save label"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<polyline points="20 6 9 17 4 12" />
									</svg>
								</button>
								<button
									type="button"
									onclick={() => (renamingId = null)}
									disabled={renameSaving}
									class="rounded p-1 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700"
									aria-label="Cancel rename"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="18"
										height="18"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M18 6 6 18M6 6l12 12" />
									</svg>
								</button>
							{:else}
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-medium text-surface-900 dark:text-surface-100">
										{#if file.label}
											{file.label}
										{:else}
											<span class="text-surface-500 italic dark:text-surface-300">Unlabeled</span>
										{/if}
									</p>
									<p class="truncate text-xs text-surface-500 dark:text-surface-300">
										{file.file_name} &middot; {formatSize(file.file_size_bytes)}
									</p>
								</div>
								{#if file.mime_type === 'application/pdf'}
									<button
										type="button"
										onclick={() => openFile(file)}
										class="rounded px-1.5 py-1 text-xs font-medium text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100"
										aria-label="Open {file.label ?? file.file_name}"
									>
										Open
									</button>
								{/if}
								<button
									type="button"
									onclick={() => downloadFile(file)}
									class="rounded p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-700 dark:hover:text-surface-200"
									aria-label="Download {file.label ?? file.file_name}"
								>
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="16"
										height="16"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
									</svg>
								</button>
								{#if canManage}
									<button
										type="button"
										onclick={() => startRename(file, 'song_files')}
										class="rounded p-1 text-surface-400 hover:bg-surface-100 hover:text-surface-600 dark:hover:bg-surface-700 dark:hover:text-surface-200"
										aria-label="Rename {file.label ?? file.file_name}"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path
												d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
											/>
										</svg>
									</button>
									<button
										type="button"
										onclick={() => handleDeleteFile(file)}
										class="rounded p-1 text-surface-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/20 dark:hover:text-danger-400"
										aria-label="Delete {file.label ?? file.file_name}"
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											stroke-linecap="round"
											stroke-linejoin="round"
										>
											<path
												d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
											/>
										</svg>
									</button>
								{/if}
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="mt-3 text-sm text-surface-500 dark:text-surface-300">
					No charts yet{canManage
						? ' — add a tab or chord chart to practice with.'
						: ". Only the song's owner can upload charts."}
				</p>
			{/if}

			{#if fileError}
				<p role="alert" class="mt-2 text-sm text-danger-600 dark:text-danger-400">{fileError}</p>
			{/if}

			{#if canManage}
				<div class="mt-4">
					<input
						type="text"
						bind:value={fileLabel}
						placeholder={'Label — e.g. "Rhythm tab" (optional)'}
						maxlength={MAX_LABEL_LENGTH}
						disabled={fileUploadBusy}
						class="focus-live mb-3 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
					/>

					<FileUploadZone
						{supabase}
						bucket="song-files"
						makePath={(ext) => `songs/${song.id}/${crypto.randomUUID()}.${ext}`}
						action={uploadFileAction}
						uploadLabel="Upload chart"
						dense
						bind:busy={fileUploadBusy}
						onsuccess={async (_data, update) => {
							fileLabel = '';
							await update({ reset: true });
						}}
					>
						{#snippet fields()}
							<input type="hidden" name="song_id" value={song.id} />
							<input type="hidden" name="label" value={fileLabel} />
						{/snippet}
					</FileUploadZone>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Hidden variant delete form -->
<form
	bind:this={deleteForm}
	method="POST"
	action={deleteAudioAction}
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				await update();
			} else {
				audioError = 'Failed to delete audio';
			}
		};
	}}
>
	<input bind:this={deleteInput} type="hidden" name="id" value="" />
</form>

<!-- Hidden chart delete form -->
<form
	bind:this={deleteFileForm}
	method="POST"
	action={deleteFileAction}
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				await update();
			} else {
				fileError = 'Failed to delete file';
			}
		};
	}}
>
	<input bind:this={deleteFileInput} type="hidden" name="id" value="" />
</form>

<ConfirmDialog bind:this={confirmDialog} />
