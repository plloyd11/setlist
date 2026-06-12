<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { deserialize } from '$app/forms';
	import TrackCard from '$lib/components/tracks/TrackCard.svelte';
	import TrackUploadForm from '$lib/components/tracks/TrackUploadForm.svelte';
	import FolderRow from '$lib/components/tracks/FolderRow.svelte';
	import MoveDialog from '$lib/components/tracks/MoveDialog.svelte';
	import FolderNameDialog from '$lib/components/tracks/FolderNameDialog.svelte';
	import Breadcrumb from '$lib/components/ui/Breadcrumb.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import ContextMenu from '$lib/components/ui/ContextMenu.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { TRACK_DRAG_TYPE, FOLDER_DRAG_TYPE } from '$lib/utils/trackDrag';

	let { data } = $props();

	let bandId = $derived(data.band.id);
	let basePath = $derived(`/bands/${bandId}/demos`);

	let showUploadForm = $state(false);
	let toast: Toast;
	let confirmDialog: ConfirmDialog;
	let moveDialog: MoveDialog;
	let nameDialog: FolderNameDialog;

	let menuVisible = $state(false);
	let menuX = $state(0);
	let menuY = $state(0);
	let menuItems = $state<{ label: string; action: () => void }[]>([]);

	const FOLDER_VIEW_KEY = 'tracks:folderView';
	let folderView = $state<'list' | 'grid'>('list');
	onMount(() => {
		const stored = localStorage.getItem(FOLDER_VIEW_KEY);
		if (stored === 'grid' || stored === 'list') folderView = stored;
	});
	function setFolderView(view: 'list' | 'grid') {
		folderView = view;
		localStorage.setItem(FOLDER_VIEW_KEY, view);
	}

	let hasTracks = $derived(data.tracks.length > 0);
	let hasFolders = $derived(data.folders.length > 0);
	let currentFolderId = $derived(data.currentFolder?.id ?? null);
	let trackCountLabel = $derived(
		data.tracks.length === 1 ? '1 demo' : `${data.tracks.length} demos`
	);

	// The in-flight in-app drag — page-level so folder rows and crumbs can
	// decide whether to accept it (dragover can't read the payload, only types)
	let activeDrag = $state<{ kind: 'track' | 'folder'; id: string } | null>(null);

	// A dragged folder must not land on itself or inside its own subtree
	let invalidFolderDropIds = $derived.by(() => {
		if (activeDrag?.kind !== 'folder') return new Set<string>();
		const childrenOf = new Map<string | null, string[]>();
		for (const f of data.allFolders) {
			const ids = childrenOf.get(f.parent_id) ?? [];
			ids.push(f.id);
			childrenOf.set(f.parent_id, ids);
		}
		const set = new Set<string>();
		const collect = (id: string) => {
			set.add(id);
			for (const child of childrenOf.get(id) ?? []) collect(child);
		};
		collect(activeDrag.id);
		return set;
	});

	let crumbs = $derived([
		{ label: 'Demos', href: basePath },
		...data.breadcrumb.map((b, i) => ({
			label: b.name,
			href: i === data.breadcrumb.length - 1 ? null : `${basePath}?folder=${b.id}`
		}))
	]);

	async function postAction(
		action: string,
		fields: Record<string, string>
	): Promise<string | null> {
		const body = new FormData();
		for (const [key, value] of Object.entries(fields)) body.set(key, value);
		const response = await fetch(`?/${action}`, { method: 'POST', body });
		const result = deserialize(await response.text());
		if (result.type === 'success') {
			await invalidateAll();
			return null;
		}
		if (result.type === 'failure') {
			return String((result.data as { error?: string })?.error ?? 'Something went wrong');
		}
		return 'Something went wrong';
	}

	function handleUploaded(result: { trackId: string }) {
		showUploadForm = false;
		toast.show('Demo uploaded', { variant: 'success' });
		goto(`${basePath}/${result.trackId}`);
	}

	function openMenu(items: { label: string; action: () => void }[], pos: { x: number; y: number }) {
		menuItems = items;
		menuX = pos.x;
		menuY = pos.y;
		menuVisible = true;
	}

	function newFolder() {
		nameDialog.open({
			title: 'New folder',
			submitLabel: 'Create',
			onsubmit: async (name) => {
				const err = await postAction('createFolder', {
					name,
					parent_id: currentFolderId ?? ''
				});
				if (!err) toast.show('Folder created', { variant: 'success' });
				return err;
			}
		});
	}

	function renameFolder(folder: { id: string; name: string }) {
		nameDialog.open({
			title: 'Rename folder',
			initial: folder.name,
			submitLabel: 'Rename',
			onsubmit: async (name) => {
				const err = await postAction('renameFolder', { folder_id: folder.id, name });
				if (!err) toast.show('Folder renamed', { variant: 'success' });
				return err;
			}
		});
	}

	async function moveFolderViaDialog(folder: { id: string; name: string }) {
		const dest = await moveDialog.pick({
			title: `Move "${folder.name}"`,
			folders: data.allFolders,
			excludeSubtreeOf: folder.id,
			currentLocation: currentFolderId
		});
		if (dest === undefined) return;
		await moveItem({ kind: 'folder', id: folder.id }, dest);
	}

	async function moveTrackViaDialog(track: { id: string; title: string }) {
		const dest = await moveDialog.pick({
			title: `Move "${track.title}"`,
			folders: data.allFolders,
			currentLocation: currentFolderId
		});
		if (dest === undefined) return;
		await moveItem({ kind: 'track', id: track.id }, dest);
	}

	async function deleteFolder(folder: { id: string; name: string }) {
		const ok = await confirmDialog.confirm(
			`Delete "${folder.name}"?`,
			'Demos and folders inside will move up a level.'
		);
		if (!ok) return;
		const err = await postAction('deleteFolder', { folder_id: folder.id });
		if (err) {
			toast.show(err, { variant: 'error' });
		} else {
			toast.show('Folder deleted', { variant: 'success' });
		}
	}

	/** Shared by the Move-to dialog and both drop targets. dest null = root. */
	async function moveItem(item: { kind: 'track' | 'folder'; id: string }, dest: string | null) {
		const err =
			item.kind === 'track'
				? await postAction('moveTrack', { track_id: item.id, folder_id: dest ?? '' })
				: await postAction('moveFolder', { folder_id: item.id, parent_id: dest ?? '' });
		if (err) {
			toast.show(err, { variant: 'error' });
		} else {
			toast.show(item.kind === 'track' ? 'Demo moved' : 'Folder moved', { variant: 'success' });
		}
	}

	function handleDropOnFolder(folderId: string) {
		if (!activeDrag) return;
		const drag = activeDrag;
		activeDrag = null;
		if (drag.kind === 'folder' && invalidFolderDropIds.has(folderId)) return;
		moveItem(drag, folderId);
	}

	function handleDropOnCrumb(index: number) {
		if (!activeDrag) return;
		const drag = activeDrag;
		activeDrag = null;
		moveItem(drag, index === 0 ? null : data.breadcrumb[index - 1].id);
	}
</script>

<div class="p-6 md:p-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-baseline gap-3">
			<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100">Demos</h1>
			{#if hasTracks}
				<span class="text-sm text-surface-500 dark:text-surface-300">{trackCountLabel}</span>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			<button
				onclick={newFolder}
				class="flex items-center justify-center rounded-lg border border-surface-300 p-2 text-surface-600 hover:border-accent-400 hover:text-accent-600 dark:border-surface-600 dark:text-surface-300 dark:hover:border-accent-600 dark:hover:text-accent-400"
				aria-label="New folder"
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
					<path
						d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"
					/>
					<path d="M12 10v6M9 13h6" />
				</svg>
			</button>
			<button
				onclick={() => (showUploadForm = !showUploadForm)}
				class="flex items-center justify-center rounded-lg bg-accent-500 p-2 text-white shadow-sm hover:bg-accent-600"
				aria-label="New demo"
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
					<path d="M12 5v14M5 12h14" />
				</svg>
			</button>
		</div>
	</div>

	{#if data.currentFolder}
		<div class="mt-3">
			<Breadcrumb
				items={crumbs}
				droptypes={[TRACK_DRAG_TYPE, FOLDER_DRAG_TYPE]}
				candrop={(index) => !!activeDrag && index < crumbs.length - 1}
				ondropon={handleDropOnCrumb}
			/>
		</div>
	{/if}

	{#if showUploadForm}
		<div class="mt-4">
			<TrackUploadForm
				{bandId}
				folderId={currentFolderId}
				supabase={data.supabase}
				onsuccess={handleUploaded}
				oncancel={() => (showUploadForm = false)}
			/>
		</div>
	{/if}

	{#if hasFolders}
		<div class="mt-6 flex items-center justify-between">
			<span
				class="text-xs font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
			>
				Folders
			</span>
			<div
				class="flex overflow-hidden rounded-lg border border-surface-300 dark:border-surface-600"
				role="group"
				aria-label="Folder view"
			>
				<button
					type="button"
					aria-label="List view"
					aria-pressed={folderView === 'list'}
					class="p-1.5 {folderView === 'list'
						? 'bg-surface-200 text-surface-900 dark:bg-surface-700 dark:text-surface-100'
						: 'text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100'}"
					onclick={() => setFolderView('list')}
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<path d="M4 6h16M4 12h16M4 18h16" />
					</svg>
				</button>
				<button
					type="button"
					aria-label="Grid view"
					aria-pressed={folderView === 'grid'}
					class="p-1.5 {folderView === 'grid'
						? 'bg-surface-200 text-surface-900 dark:bg-surface-700 dark:text-surface-100'
						: 'text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100'}"
					onclick={() => setFolderView('grid')}
				>
					<svg
						class="h-4 w-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						aria-hidden="true"
					>
						<rect x="4" y="4" width="7" height="7" rx="1" />
						<rect x="13" y="4" width="7" height="7" rx="1" />
						<rect x="4" y="13" width="7" height="7" rx="1" />
						<rect x="13" y="13" width="7" height="7" rx="1" />
					</svg>
				</button>
			</div>
		</div>
		<div
			class="mt-3 {folderView === 'grid'
				? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
				: 'space-y-2'}"
		>
			{#each data.folders as folder (folder.id)}
				<FolderRow
					{folder}
					{basePath}
					view={folderView}
					acceptDrop={!!activeDrag &&
						!(activeDrag.kind === 'folder' && invalidFolderDropIds.has(folder.id))}
					oncontextmenu={(pos) =>
						openMenu(
							[
								{ label: 'Rename', action: () => renameFolder(folder) },
								{ label: 'Move to…', action: () => moveFolderViaDialog(folder) },
								{ label: 'Delete', action: () => deleteFolder(folder) }
							],
							pos
						)}
					ondropon={() => handleDropOnFolder(folder.id)}
					ondragstartrow={() => (activeDrag = { kind: 'folder', id: folder.id })}
					ondragendrow={() => (activeDrag = null)}
				/>
			{/each}
		</div>
	{/if}

	{#if hasTracks}
		<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.tracks as track (track.id)}
				<TrackCard
					{track}
					{basePath}
					draggable
					oncontextmenu={(pos) =>
						openMenu([{ label: 'Move to…', action: () => moveTrackViaDialog(track) }], pos)}
					ondragstartcard={() => (activeDrag = { kind: 'track', id: track.id })}
					ondragendcard={() => (activeDrag = null)}
				/>
			{/each}
		</div>
	{:else if data.currentFolder}
		{#if !hasFolders && !showUploadForm}
			<!-- Empty folder — lighter than the first-run onboarding block -->
			<div
				class="mt-8 rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-8 text-center dark:border-surface-700 dark:bg-surface-900/50"
			>
				<p class="font-display text-lg text-surface-700 dark:text-surface-300">
					This folder is empty
				</p>
				<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
					Upload a demo here, or drag demos in.
				</p>
			</div>
		{/if}
	{:else if !hasFolders && !showUploadForm}
		<!-- Empty state -->
		<div
			class="mt-8 rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-12 text-center dark:border-surface-700 dark:bg-surface-900/50"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="mx-auto text-surface-300 dark:text-surface-600"
			>
				<path
					d="M9 19V6l12-3v13M9 19c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3zm12-3c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"
				/>
			</svg>
			<p class="mt-4 font-display text-lg text-surface-700 dark:text-surface-300">No demos yet</p>
			<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
				Share a demo with your band and get timestamped feedback.
			</p>
			<button
				onclick={() => (showUploadForm = true)}
				class="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
			>
				Upload your first demo
			</button>
		</div>
	{/if}
</div>

<ContextMenu items={menuItems} x={menuX} y={menuY} bind:visible={menuVisible} />
<MoveDialog bind:this={moveDialog} />
<FolderNameDialog bind:this={nameDialog} />
<ConfirmDialog bind:this={confirmDialog} />
<Toast bind:this={toast} />
