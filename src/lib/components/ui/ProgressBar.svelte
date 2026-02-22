<script lang="ts">
	let {
		percent = 0,
		isOver = false
	}: {
		percent: number;
		isOver: boolean;
	} = $props();

	let clampedWidth = $derived(Math.min(Math.max(percent, 0), 100));
</script>

<div
	class="h-3 w-full overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700"
	role="progressbar"
	aria-valuenow={Math.round(percent)}
	aria-valuemin={0}
	aria-valuemax={100}
>
	<div
		class="h-full rounded-full transition-all duration-300 {isOver ? 'bg-danger-500' : 'bg-accent-500'}"
		style="width: {clampedWidth}%"
	></div>
</div>
