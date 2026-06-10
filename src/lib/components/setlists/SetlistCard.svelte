<script lang="ts">
	import type { Setlist } from '$lib/types/database';
	import { formatDuration } from '$lib/utils/duration';

	let {
		setlist,
		songCount = 0,
		totalSeconds = 0,
		basePath = '/setlists',
		ondelete,
		onduplicate,
		onrename
	}: {
		setlist: Setlist;
		songCount: number;
		totalSeconds: number;
		basePath?: string;
		ondelete: (id: string, name: string) => void;
		onduplicate: (id: string) => void;
		onrename: (id: string, name: string) => void;
	} = $props();

	let editing = $state(false);
	let editName = $state('');
	let menuOpen = $state(false);

	function startEdit(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		editName = setlist.name;
		editing = true;
	}

	function saveEdit() {
		const trimmed = editName.trim();
		if (trimmed && trimmed !== setlist.name) {
			onrename(setlist.id, trimmed);
		}
		editing = false;
	}

	function cancelEdit() {
		editName = setlist.name;
		editing = false;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveEdit();
		} else if (e.key === 'Escape') {
			cancelEdit();
		}
	}

	function toggleMenu(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		menuOpen = !menuOpen;
	}

	function handleDuplicate(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		menuOpen = false;
		onduplicate(setlist.id);
	}

	function handleDelete(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		menuOpen = false;
		ondelete(setlist.id, setlist.name);
	}

	function handleWindowKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && menuOpen) {
			menuOpen = false;
		}
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '';
		try {
			const date = new Date(dateStr + 'T00:00:00');
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		} catch {
			return dateStr;
		}
	}

	let songLabel = $derived(songCount === 1 ? '1 song' : `${songCount} songs`);
	let timeLabel = $derived(totalSeconds > 0 ? formatDuration(totalSeconds) : '--:--');
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="group relative">
	<a
		href="{basePath}/{setlist.id}"
		class="block rounded-lg border border-surface-200 bg-surface-50 p-4 shadow-sm transition-shadow hover:shadow-md dark:border-surface-700 dark:bg-surface-800"
	>
		<!-- Header: name + menu -->
		<div class="flex items-start justify-between gap-2">
			{#if editing}
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="text"
					bind:value={editName}
					onblur={saveEdit}
					onkeydown={handleKeydown}
					autofocus
					aria-label="Setlist name"
					class="min-w-0 flex-1 rounded border border-neon-400 bg-surface-50 px-2 py-0.5 font-display text-lg font-semibold text-surface-900 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-neon-600 dark:bg-surface-800 dark:text-surface-100"
					onclick={(e) => e.preventDefault()}
				/>
			{:else}
				<button
					class="min-w-0 flex-1 truncate text-left font-display text-lg font-semibold text-surface-900 hover:text-neon-500 dark:text-surface-100 dark:hover:text-neon-400"
					onclick={startEdit}
					title="Click to rename"
				>
					{setlist.name}
				</button>
			{/if}

			<!-- Three-dot menu -->
			<div class="relative">
				<button
					onclick={toggleMenu}
					class="rounded p-1 text-surface-400 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface-100 hover:text-surface-600 focus-visible:opacity-100 dark:hover:bg-surface-700 dark:hover:text-surface-300 pointer-coarse:opacity-100"
					aria-label="Setlist options"
					aria-haspopup="menu"
					aria-expanded={menuOpen}
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="currentColor"
					>
						<circle cx="12" cy="5" r="2" />
						<circle cx="12" cy="12" r="2" />
						<circle cx="12" cy="19" r="2" />
					</svg>
				</button>

				{#if menuOpen}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="absolute top-8 right-0 z-10 w-36 rounded-lg border border-surface-200 bg-surface-50 py-1 shadow-lg dark:border-surface-700 dark:bg-surface-800"
						onclick={(e) => e.stopPropagation()}
					>
						<button
							class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-surface-700 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-700"
							onclick={handleDuplicate}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
								<path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
							</svg>
							Duplicate
						</button>
						<button
							class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger-600 hover:bg-danger-50 dark:text-danger-400 dark:hover:bg-danger-900/20"
							onclick={handleDelete}
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="14"
								height="14"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path
									d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
								/>
							</svg>
							Delete
						</button>
					</div>
				{/if}
			</div>
		</div>

		<!-- Meta: date + venue -->
		{#if setlist.gig_date || setlist.venue}
			<p class="mt-1.5 truncate text-sm text-surface-500 dark:text-surface-400">
				{#if setlist.venue}{setlist.venue}{/if}
				{#if setlist.venue && setlist.gig_date}
					&mdash;
				{/if}
				{#if setlist.gig_date}{formatDate(setlist.gig_date)}{/if}
			</p>
		{/if}

		<!-- Stats: song count + total time -->
		<div class="mt-3 flex items-center gap-3 text-sm text-surface-500 dark:text-surface-400">
			<span class="flex items-center gap-1">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M9 19V6l12-3v13" />
					<circle cx="6" cy="19" r="3" />
					<circle cx="18" cy="16" r="3" />
				</svg>
				{songLabel}
			</span>
			<span class="flex items-center gap-1">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10" />
					<polyline points="12 6 12 12 16 14" />
				</svg>
				{timeLabel}
			</span>
		</div>
	</a>
</div>

<!-- Click-away listener for menu -->
{#if menuOpen}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div class="fixed inset-0 z-0" onclick={() => (menuOpen = false)}></div>
{/if}
