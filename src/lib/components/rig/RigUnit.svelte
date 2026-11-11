<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * One unit in the rack: the signal runs down the page through them, top to bottom.
	 * Its name sits beside its controls when the board is wide enough (a container
	 * query, so the rail beside the board doesn't throw it off).
	 */
	let { title, note, children }: { title: string; note: string; children: Snippet } = $props();
</script>

<div
	role="group"
	aria-label={title}
	class="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 border-t border-surface-200 p-4 md:px-5 @2xl:grid-cols-[7.5rem_minmax(0,1fr)] dark:border-surface-700"
>
	<div>
		<h3 class="font-display text-base text-surface-900 dark:text-surface-100">{title}</h3>
		<p class="mt-0.5 text-xs text-surface-500 dark:text-surface-300">{note}</p>
	</div>
	<div class="min-w-0">{@render children()}</div>
</div>
