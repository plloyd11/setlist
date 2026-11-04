<script lang="ts">
	let {
		searchQuery = $bindable(''),
		durationFilter = $bindable('all' as 'all' | 'under3' | '3to5' | 'over5'),
		expanded = $bindable(false),
		onclose
	}: {
		searchQuery: string;
		durationFilter: 'all' | 'under3' | '3to5' | 'over5';
		expanded: boolean;
		/** Esc closed the search: put focus back on whatever opened it */
		onclose?: () => void;
	} = $props();

	const filters: { label: string; value: typeof durationFilter }[] = [
		{ label: 'All', value: 'all' },
		{ label: '< 3 min', value: 'under3' },
		{ label: '3-5 min', value: '3to5' },
		{ label: '> 5 min', value: 'over5' }
	];

	let inputEl: HTMLInputElement | undefined = $state();

	export function focusInput() {
		inputEl?.focus();
	}

	// Opening means you're about to type. Closing means you're done, so a filter
	// can't stay on with its controls hidden and songs quietly missing from the list.
	$effect(() => {
		if (expanded) {
			inputEl?.focus();
		} else {
			searchQuery = '';
			durationFilter = 'all';
		}
	});

	function clear() {
		searchQuery = '';
		durationFilter = 'all';
		// This button is about to disappear, so give focus somewhere to go
		inputEl?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			expanded = false;
			onclose?.();
		}
	}

	let hasFilters = $derived(searchQuery !== '' || durationFilter !== 'all');
</script>

{#if expanded}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="mt-4 space-y-3" role="search" onkeydown={handleKeydown}>
		<div class="flex items-center gap-2">
			<input
				bind:this={inputEl}
				type="text"
				placeholder="Search songs..."
				aria-label="Search songs"
				enterkeyhint="search"
				autocapitalize="off"
				autocorrect="off"
				spellcheck="false"
				bind:value={searchQuery}
				class="focus-live min-w-0 flex-1 rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
			/>
			{#if hasFilters}
				<button
					onclick={clear}
					class="rounded-lg p-2 text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100"
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
		<div class="flex flex-wrap gap-1.5" role="group" aria-label="Filter by length">
			{#each filters as f}
				<button
					aria-pressed={durationFilter === f.value}
					class="rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors {durationFilter ===
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
