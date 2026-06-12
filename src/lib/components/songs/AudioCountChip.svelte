<script lang="ts">
	let { count }: { count: number } = $props();
</script>

{#if count > 0}
	<!-- Quiet tonal chip — rehearsal audio attached, not a live signal -->
	<span
		class="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-50 px-1.5 py-0.5 text-[11px] font-medium text-accent-700 dark:bg-accent-900/40 dark:text-accent-300"
		title="{count} rehearsal audio {count === 1 ? 'file' : 'files'}"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="11"
			height="11"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M9 18V5l12-2v13" />
			<circle cx="6" cy="18" r="3" />
			<circle cx="18" cy="16" r="3" />
		</svg>
		{count}
	</span>
{/if}
