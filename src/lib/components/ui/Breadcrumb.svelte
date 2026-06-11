<script lang="ts">
	interface Crumb {
		label: string;
		href: string | null;
	}

	let {
		items,
		droptypes = [],
		candrop,
		ondropon
	}: {
		items: Crumb[];
		/** dataTransfer types that activate crumbs as drop targets (off by default) */
		droptypes?: string[];
		candrop?: (index: number) => boolean;
		ondropon?: (index: number) => void;
	} = $props();

	let dropIndex = $state<number | null>(null);

	// Depth is capped at 5, but 5 crumbs still overflow small screens —
	// collapse the middle to "…" past 4, keeping first + last two
	let entries = $derived.by(() => {
		const indexed = items.map((crumb, index) => ({ crumb, index }));
		if (indexed.length <= 4) return indexed;
		return [indexed[0], 'ellipsis' as const, ...indexed.slice(-2)];
	});

	function dropAllowed(e: DragEvent, index: number): boolean {
		const types = e.dataTransfer?.types ?? [];
		if (!droptypes.some((t) => types.includes(t))) return false;
		return candrop ? candrop(index) : true;
	}

	function handleDragOver(e: DragEvent, index: number) {
		if (!dropAllowed(e, index)) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dropIndex = index;
	}

	function handleDrop(e: DragEvent, index: number) {
		dropIndex = null;
		if (!dropAllowed(e, index)) return;
		e.preventDefault();
		ondropon?.(index);
	}
</script>

<nav aria-label="Breadcrumb">
	<ol class="flex min-w-0 items-center gap-1.5 text-sm">
		{#each entries as entry (typeof entry === 'string' ? entry : entry.index)}
			{#if entry === 'ellipsis'}
				<li aria-hidden="true" class="text-surface-400 dark:text-surface-500">…</li>
				<li aria-hidden="true" class="text-surface-400 dark:text-surface-500">▸</li>
			{:else}
				<li
					class="min-w-0 rounded-md transition-shadow
						{dropIndex === entry.index ? 'shadow-glow-neon ring-2 ring-neon-600 dark:ring-neon-400' : ''}"
					ondragover={(e) => handleDragOver(e, entry.index)}
					ondragleave={() => (dropIndex = null)}
					ondrop={(e) => handleDrop(e, entry.index)}
				>
					{#if entry.crumb.href}
						<a
							href={entry.crumb.href}
							class="focus-live block max-w-40 truncate px-1 py-0.5 text-surface-500 hover:text-accent-600 dark:text-surface-300 dark:hover:text-accent-400"
						>
							{entry.crumb.label}
						</a>
					{:else}
						<span
							aria-current="page"
							class="block max-w-40 truncate px-1 py-0.5 font-medium text-surface-900 dark:text-surface-100"
						>
							{entry.crumb.label}
						</span>
					{/if}
				</li>
				{#if entry.index < items.length - 1}
					<li aria-hidden="true" class="text-surface-400 dark:text-surface-500">▸</li>
				{/if}
			{/if}
		{/each}
	</ol>
</nav>
