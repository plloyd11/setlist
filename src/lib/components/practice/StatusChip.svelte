<script lang="ts">
	import { STATUS_TONES } from './practiceStyles.js';

	let { status }: { status: string } = $props();

	const STYLES: Record<string, { label: string; chip: string; dot: string }> = {
		needs_work: {
			label: 'Needs work',
			chip: 'bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-200',
			dot: STATUS_TONES.needs_work
		},
		learning: {
			label: 'Learning',
			chip: 'bg-accent-100 text-accent-800 dark:bg-accent-800/50 dark:text-accent-200',
			dot: STATUS_TONES.learning
		},
		solid: {
			label: 'Solid',
			chip: 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-200',
			dot: STATUS_TONES.solid
		}
	};

	let style = $derived(STYLES[status]);
</script>

{#if style}
	<span
		class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium {style.chip}"
	>
		<span class="h-1.5 w-1.5 rounded-full {style.dot}" aria-hidden="true"></span>
		{style.label}
	</span>
{/if}
