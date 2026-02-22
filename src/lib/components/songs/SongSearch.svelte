<script lang="ts">
	let {
		searchQuery = $bindable(''),
		durationFilter = $bindable('all' as 'all' | 'under3' | '3to5' | 'over5'),
		expanded = $bindable(false)
	}: {
		searchQuery: string;
		durationFilter: 'all' | 'under3' | '3to5' | 'over5';
		expanded: boolean;
	} = $props();

	const filters: { label: string; value: typeof durationFilter }[] = [
		{ label: 'All', value: 'all' },
		{ label: '< 3 min', value: 'under3' },
		{ label: '3-5 min', value: '3to5' },
		{ label: '> 5 min', value: 'over5' }
	];

	function clear() {
		searchQuery = '';
		durationFilter = 'all';
	}

	let hasFilters = $derived(searchQuery !== '' || durationFilter !== 'all');
</script>

{#if expanded}
	<div class="mt-4 space-y-3">
		<div class="flex items-center gap-2">
			<input
				type="text"
				placeholder="Search songs..."
				bind:value={searchQuery}
				class="flex-1 rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-500"
			/>
			{#if hasFilters}
				<button
					onclick={clear}
					class="rounded-lg p-2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
					aria-label="Clear search and filters"
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
			{/if}
		</div>
		<div class="flex flex-wrap gap-2">
			{#each filters as f}
				<button
					class="rounded-full px-3 py-1 text-xs font-medium transition-colors {durationFilter ===
					f.value
						? 'bg-accent-500 text-white'
						: 'bg-surface-200 text-surface-600 hover:bg-surface-300 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600'}"
					onclick={() => (durationFilter = f.value)}
				>
					{f.label}
				</button>
			{/each}
		</div>
	</div>
{/if}
