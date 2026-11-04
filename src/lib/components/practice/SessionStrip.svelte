<script lang="ts">
	import { formatPracticeTime } from '#lib/utils/practiceTime.js';

	let {
		segments,
		label,
		highlight = null,
		format = formatPracticeTime
	}: {
		/** Drawn to scale, in order. Tone is a background class. */
		segments: { key: string; label: string; seconds: number; tone: string }[];
		label: string;
		/** Dims the others, when a row beside the strip is being pointed at */
		highlight?: string | null;
		/** How a segment's amount reads aloud and on hover, when it isn't time */
		format?: (amount: number) => string;
	} = $props();

	let summary = $derived(segments.map((s) => `${s.label} ${format(s.seconds)}`).join(', '));
</script>

<div role="img" aria-label="{label}: {summary}" class="flex h-2.5 gap-0.5">
	{#each segments as segment (segment.key)}
		<span
			title="{segment.label}, {format(segment.seconds)}"
			style="flex: {segment.seconds} 1 0"
			class="min-w-1 rounded-[2px] transition-opacity duration-150 first:rounded-l-full last:rounded-r-full {segment.tone} {highlight &&
			highlight !== segment.key
				? 'opacity-35'
				: ''}"
		></span>
	{/each}
</div>
