<script lang="ts">
	import { longpress } from '$lib/actions/longpress';
	import { FOLDER_DRAG_TYPE, isAppDrag } from '$lib/utils/trackDrag';

	let {
		folder,
		basePath,
		view = 'list',
		acceptDrop = false,
		oncontextmenu,
		ondropon,
		ondragstartrow,
		ondragendrow
	}: {
		folder: { id: string; name: string; trackCount: number };
		basePath: string;
		/** 'list' = full-width row; 'grid' = compact card for a multi-column grid */
		view?: 'list' | 'grid';
		/** Page-computed: whether the drag currently in flight may land here
		 * (false for a folder dragged onto itself or its own subtree). */
		acceptDrop?: boolean;
		oncontextmenu?: (pos: { x: number; y: number }) => void;
		ondropon?: () => void;
		ondragstartrow?: () => void;
		ondragendrow?: () => void;
	} = $props();

	// dragenter/dragleave fire for every child element — a depth counter is
	// the standard way to keep the highlight stable while moving over them
	let dragDepth = $state(0);
	let dropActive = $derived(dragDepth > 0 && acceptDrop);

	let countLabel = $derived(`${folder.trackCount} ${folder.trackCount === 1 ? 'demo' : 'demos'}`);

	function handleDragStart(e: DragEvent) {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData(FOLDER_DRAG_TYPE, folder.id);
		e.dataTransfer.effectAllowed = 'move';
		ondragstartrow?.();
	}

	function handleDragEnd() {
		dragDepth = 0;
		ondragendrow?.();
	}

	function handleDragEnter(e: DragEvent) {
		if (isAppDrag(e)) dragDepth += 1;
	}

	function handleDragLeave(e: DragEvent) {
		if (isAppDrag(e)) dragDepth = Math.max(0, dragDepth - 1);
	}

	function handleDragOver(e: DragEvent) {
		if (!isAppDrag(e) || !acceptDrop) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
	}

	function handleDrop(e: DragEvent) {
		dragDepth = 0;
		if (!isAppDrag(e) || !acceptDrop) return;
		e.preventDefault();
		ondropon?.();
	}

	function handleContextMenu(e: MouseEvent) {
		e.preventDefault();
		oncontextmenu?.({ x: e.clientX, y: e.clientY });
	}

	function handleLongpress(e: CustomEvent<{ x: number; y: number }>) {
		oncontextmenu?.(e.detail);
	}

	function handleKebab(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		oncontextmenu?.({ x: rect.left, y: rect.bottom + 4 });
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative rounded-xl border transition-colors
		{dropActive
		? 'border-neon-600 bg-surface-50 shadow-glow-neon ring-2 ring-neon-600 dark:border-neon-400 dark:bg-surface-900 dark:ring-neon-400'
		: 'border-surface-200 bg-surface-50 hover:border-accent-400 dark:border-surface-800 dark:bg-surface-900 dark:hover:border-accent-600'}"
	draggable="true"
	ondragstart={handleDragStart}
	ondragend={handleDragEnd}
	ondragenter={handleDragEnter}
	ondragleave={handleDragLeave}
	ondragover={handleDragOver}
	ondrop={handleDrop}
	oncontextmenu={handleContextMenu}
	use:longpress
	onlongpress={handleLongpress}
>
	<a
		href="{basePath}?folder={folder.id}"
		class="focus-live rounded-xl
			{view === 'grid'
			? 'flex flex-col items-center gap-1.5 p-4 pt-5 text-center'
			: 'flex items-center gap-3 py-3 pr-12 pl-4'}"
	>
		<svg
			class="{view === 'grid'
				? 'h-8 w-8'
				: 'h-5 w-5'} shrink-0 text-accent-500 dark:text-accent-400"
			fill="currentColor"
			viewBox="0 0 24 24"
			aria-hidden="true"
		>
			<path
				d="M3.75 5.25A1.5 1.5 0 015.25 3.75h4.193c.4 0 .784.16 1.066.444l1.547 1.556h6.694a1.5 1.5 0 011.5 1.5v11a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V5.25z"
			/>
		</svg>
		<span
			class="min-w-0 truncate font-medium text-surface-900 dark:text-surface-100
				{view === 'grid' ? 'w-full' : ''}"
		>
			{folder.name}
		</span>
		<span
			class="shrink-0 text-xs text-surface-500 dark:text-surface-300
				{view === 'grid' ? '' : 'ml-auto'}"
		>
			{countLabel}
		</span>
	</a>
	<button
		type="button"
		aria-label="Folder options for {folder.name}"
		class="focus-live absolute rounded-lg p-1.5 text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-surface-100
			{view === 'grid' ? 'top-2 right-2' : 'top-1/2 right-2 -translate-y-1/2'}"
		onclick={handleKebab}
	>
		<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path
				d="M12 6.75a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm0 6.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm0 6.5a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z"
			/>
		</svg>
	</button>
</div>
