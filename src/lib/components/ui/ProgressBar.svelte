<script lang="ts">
	let {
		percent = 0,
		isOver = false,
		ariaLabel = 'Progress'
	}: {
		percent: number;
		isOver: boolean;
		ariaLabel?: string;
	} = $props();

	let clampedWidth = $derived(Math.min(Math.max(percent, 0), 100));
</script>

<div
	class="h-3 w-full overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700"
	role="progressbar"
	aria-label={ariaLabel}
	aria-valuenow={Math.round(clampedWidth)}
	aria-valuemin={0}
	aria-valuemax={100}
>
	<div
		class="h-full rounded-full transition-all duration-300 motion-reduce:transition-none {isOver
			? 'bg-danger-600 dark:bg-danger-400'
			: 'bg-success-600 dark:bg-success-400'}"
		style="width: {clampedWidth}%"
	></div>
</div>
