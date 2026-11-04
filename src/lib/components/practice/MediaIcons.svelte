<script lang="ts">
	let { hasChart, hasAudio }: { hasChart: boolean; hasAudio: boolean } = $props();

	const iconClass = 'shrink-0 text-accent-500 dark:text-accent-400';
</script>

{#if hasChart}
	<span class="shrink-0" title="Has a chart">
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
			class={iconClass}
			aria-hidden="true"
		>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<path d="M14 2v6h6M8 13h8M8 17h8" />
		</svg>
		<span class="sr-only">Has a chart</span>
	</span>
{/if}
{#if hasAudio}
	<span class="shrink-0" title="Has audio">
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
			class={iconClass}
			aria-hidden="true"
		>
			<path d="M9 18V5l12-2v13" />
			<circle cx="6" cy="18" r="3" />
			<circle cx="18" cy="16" r="3" />
		</svg>
		<span class="sr-only">Has audio</span>
	</span>
{/if}
