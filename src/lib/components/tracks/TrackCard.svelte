<script lang="ts">
	import { formatDuration } from '$lib/utils/duration';
	import { longpress } from '$lib/actions/longpress';
	import { TRACK_DRAG_TYPE } from '$lib/utils/trackDrag';

	interface UploaderProfile {
		id: string;
		display_name: string | null;
		logo_url: string | null;
	}

	interface TrackListItem {
		id: string;
		title: string;
		description: string | null;
		updated_at: string;
		versionCount: number;
		latestVersion: {
			version_number: number;
			duration_seconds: number | null;
			created_at: string;
		} | null;
		uploaderProfile: UploaderProfile | null;
	}

	let {
		track,
		basePath,
		bandName,
		draggable = false,
		oncontextmenu,
		ondragstartcard,
		ondragendcard
	}: {
		track: TrackListItem;
		basePath: string;
		bandName?: string;
		/** Opt-in (tracks list only — the dashboard renders plain cards) */
		draggable?: boolean;
		oncontextmenu?: (pos: { x: number; y: number }) => void;
		ondragstartcard?: () => void;
		ondragendcard?: () => void;
	} = $props();

	function handleDragStart(e: DragEvent) {
		if (!e.dataTransfer) return;
		e.dataTransfer.setData(TRACK_DRAG_TYPE, track.id);
		e.dataTransfer.effectAllowed = 'move';
		ondragstartcard?.();
	}

	function handleContextMenu(e: MouseEvent) {
		if (!oncontextmenu) return;
		e.preventDefault();
		oncontextmenu({ x: e.clientX, y: e.clientY });
	}

	function handleLongpress(e: CustomEvent<{ x: number; y: number }>) {
		oncontextmenu?.(e.detail);
	}

	let initial = $derived(track.uploaderProfile?.display_name?.charAt(0).toUpperCase() ?? '?');
	let updatedLabel = $derived(
		new Date(track.updated_at).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric'
		})
	);
</script>

<!-- Anchors are natively draggable; the browser's drag threshold separates
     click-to-open from drag-to-move with no custom handling -->
<a
	href="{basePath}/{track.id}"
	class="block rounded-xl border border-surface-200 bg-surface-50 p-4 transition-colors hover:border-accent-400 dark:border-surface-800 dark:bg-surface-900 dark:hover:border-accent-600"
	draggable={draggable ? 'true' : undefined}
	ondragstart={draggable ? handleDragStart : undefined}
	ondragend={draggable ? () => ondragendcard?.() : undefined}
	oncontextmenu={oncontextmenu ? handleContextMenu : undefined}
	use:longpress
	onlongpress={handleLongpress}
>
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			{#if bandName}
				<p
					class="truncate text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
				>
					{bandName}
				</p>
			{/if}
			<h3 class="truncate font-display text-lg text-surface-900 dark:text-surface-100">
				{track.title}
			</h3>
			{#if track.description}
				<p class="mt-0.5 truncate text-sm text-surface-500 dark:text-surface-300">
					{track.description}
				</p>
			{/if}
		</div>
		{#if track.latestVersion}
			<span
				class="shrink-0 rounded-full bg-accent-100 px-2 py-0.5 text-xs font-semibold text-accent-700 dark:bg-accent-900/30 dark:text-accent-400"
			>
				v{track.latestVersion.version_number}
			</span>
		{/if}
	</div>

	<div class="mt-3 flex items-center justify-between">
		<div class="flex items-center gap-2">
			{#if track.uploaderProfile?.logo_url}
				<img
					src={track.uploaderProfile.logo_url}
					alt={track.uploaderProfile.display_name ?? 'Uploader'}
					class="h-6 w-6 rounded-full object-cover"
				/>
			{:else}
				<div
					class="flex h-6 w-6 items-center justify-center rounded-full bg-accent-100 text-xs font-semibold text-accent-700 dark:bg-surface-700 dark:text-surface-300"
				>
					{initial}
				</div>
			{/if}
			<span class="text-xs text-surface-500 dark:text-surface-300">
				{track.uploaderProfile?.display_name ?? 'Former member'}
			</span>
		</div>
		<div class="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-300">
			{#if track.latestVersion?.duration_seconds}
				<span>{formatDuration(Math.round(track.latestVersion.duration_seconds))}</span>
				<span aria-hidden="true">&middot;</span>
			{/if}
			<span>{updatedLabel}</span>
		</div>
	</div>
</a>
