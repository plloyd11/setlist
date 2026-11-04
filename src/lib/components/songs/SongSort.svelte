<script lang="ts" generics="T extends string">
	type Direction = 'asc' | 'desc';

	let {
		options,
		sortBy = $bindable(),
		sortDir = $bindable()
	}: {
		/** firstDir: the direction a field starts in when chosen. Defaults to ascending. */
		options: { label: string; value: T; firstDir?: Direction }[];
		sortBy: T;
		sortDir: Direction;
	} = $props();

	const uid = $props.id();

	function choose(option: (typeof options)[number]) {
		if (sortBy === option.value) {
			sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		} else {
			sortBy = option.value;
			sortDir = option.firstDir ?? 'asc';
		}
	}
</script>

<div
	class="mt-4 flex flex-wrap items-center gap-1.5 pointer-coarse:mt-5"
	role="group"
	aria-labelledby={uid}
>
	<span id={uid} class="mr-1 text-xs text-surface-500 dark:text-surface-300">Sort:</span>
	{#each options as option (option.value)}
		{@const selected = sortBy === option.value}
		<button
			type="button"
			aria-pressed={selected}
			class="rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors {selected
				? 'bg-accent-500 text-white'
				: 'bg-surface-200 text-surface-600 hover:bg-surface-300 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600'}"
			onclick={() => choose(option)}
		>
			{option.label}
			{#if selected}
				<span class="ml-0.5" aria-hidden="true">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
				<span class="sr-only">, {sortDir === 'asc' ? 'ascending' : 'descending'}</span>
			{/if}
		</button>
	{/each}
</div>
