<script lang="ts">
	let {
		best,
		goal,
		label
	}: {
		best: number;
		goal: number;
		/** Leave off where the numbers sit right beside it in text */
		label?: string;
	} = $props();

	let percent = $derived(Math.min(100, (best / goal) * 100));
</script>

<span
	role={label ? 'progressbar' : undefined}
	aria-label={label}
	aria-valuemin={label ? 0 : undefined}
	aria-valuemax={label ? goal : undefined}
	aria-valuenow={label ? Math.min(best, goal) : undefined}
	aria-hidden={label ? undefined : true}
	class="block h-1.5 overflow-hidden rounded-full bg-accent-100 dark:bg-accent-800/60"
>
	<span
		class="block h-full rounded-full {best >= goal
			? 'bg-success-500 dark:bg-success-300'
			: 'bg-accent-500 dark:bg-accent-400'}"
		style="width: {percent}%"
	></span>
</span>
