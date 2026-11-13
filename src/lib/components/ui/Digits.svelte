<script lang="ts">
	/**
	 * Digits in equal-width slots, so a running timer doesn't wobble and a column of
	 * durations lines up. Neither Klima nor Cartridge has tabular figures, so
	 * `tabular-nums` does nothing here, and a 1 is about 60% as wide as a 0.
	 *
	 * For readings that tick or stack. Leave static display numbers alone: their
	 * natural spacing looks better. The real text stays in the DOM and the slots draw
	 * from data attributes, so a reading is announced once, not digit by digit.
	 */
	let { value }: { value: string } = $props();
</script>

<span class="whitespace-nowrap"
	><span class="sr-only">{value}</span><span aria-hidden="true"
		>{#each [...value] as ch, i (i)}<span class="slot" class:digit={/\d/.test(ch)} data-ch={ch}
			></span>{/each}</span
	></span
>

<style>
	.slot {
		display: inline-block;
		/* A slot holding a space would collapse to nothing: "1h 05m" came out "1h05m" */
		white-space: pre;
	}
	.slot::before {
		content: attr(data-ch);
	}
	.digit {
		/* Just under the widest figure (0.64em): a 1 keeps close to its neighbours,
		   and the overhang on a 0 is too small to see */
		width: 0.6em;
		text-align: center;
	}
</style>
