<script lang="ts">
	import {
		boundaries,
		fitSections,
		layoutRows,
		sameRange,
		sectionAt,
		type Boundary,
		type LaidSection
	} from '#lib/utils/sections.js';
	import type { LoopRange, SavedSection } from '#lib/utils/practicePrefs.js';
	import { formatDuration } from '#lib/utils/duration.js';

	let {
		sections,
		duration,
		currentTime,
		loop,
		loopEnabled,
		disabled = false,
		onselect,
		onboundarymove,
		onboundaryend
	}: {
		sections: SavedSection[];
		/** Length of the mix on screen: the lane shares the waveform's timeline */
		duration: number;
		currentTime: number;
		loop: LoopRange | null;
		loopEnabled: boolean;
		disabled?: boolean;
		onselect: (id: string) => void;
		onboundarymove: (boundary: Boundary, time: number) => void;
		onboundaryend: () => void;
	} = $props();

	let lane: HTMLDivElement | undefined = $state();
	let laid = $derived(layoutRows(fitSections(sections, duration)));
	let rows = $derived(Math.max(1, ...laid.map((s) => s.row + 1)));
	let edges = $derived(boundaries(laid, duration));
	let here = $derived(sectionAt(laid, currentTime));

	// The edge in hand keeps the limits it had when picked up. Rows can reshuffle
	// under a drag, so it's followed by its section ids, not by its element.
	let held = $state<Boundary | null>(null);
	let heldTime = $derived(
		held
			? (edges.find((e) => e.endOf === held?.endOf && e.startOf === held?.startOf)?.time ??
					held.time)
			: 0
	);

	const percent = (seconds: number) => (seconds / duration) * 100;
	const tenths = (seconds: number) =>
		`${formatDuration(Math.floor(seconds))}.${Math.floor((seconds % 1) * 10)}`;
	const range = (s: LoopRange) =>
		`${formatDuration(Math.round(s.start))}–${formatDuration(Math.round(s.end))}`;

	function grab(e: PointerEvent, edge: Boundary) {
		if (e.button !== 0 || disabled) return;
		e.preventDefault();
		held = edge;
		const move = (ev: PointerEvent) => {
			if (!lane || !held) return;
			const box = lane.getBoundingClientRect();
			onboundarymove(held, ((ev.clientX - box.left) / box.width) * duration);
		};
		const release = () => {
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', release);
			window.removeEventListener('pointercancel', release);
			held = null;
			onboundaryend();
		};
		window.addEventListener('pointermove', move);
		window.addEventListener('pointerup', release);
		window.addEventListener('pointercancel', release);
	}

	// Chartreuse only while the loop is armed on it (live). The section under the
	// playhead is copper; a parked loop is just a firmer edge.
	function tone(section: LaidSection): string {
		const looped = loop !== null && sameRange(section, loop);
		if (looped && loopEnabled) {
			return 'border-neon-600 bg-neon-600/10 text-surface-900 dark:border-neon-400 dark:bg-neon-400/15 dark:text-surface-50';
		}
		const fill =
			here?.id === section.id
				? 'bg-accent-100 text-accent-800 dark:bg-accent-900/50 dark:text-accent-300'
				: 'bg-surface-100 text-surface-700 dark:bg-surface-700/60 dark:text-surface-200';
		const edge = looped
			? 'border-surface-500 dark:border-surface-300'
			: here?.id === section.id
				? 'border-accent-400 dark:border-accent-600'
				: 'border-surface-300 hover:border-accent-400 dark:border-surface-600 dark:hover:border-accent-500';
		return `${fill} ${edge}`;
	}
</script>

{#if duration > 0 && laid.length > 0}
	<div
		bind:this={lane}
		role="group"
		aria-label="Section map"
		class="lane relative mb-1.5 select-none"
		style="height: calc({rows} * var(--lane-row))"
	>
		{#each laid as section (section.id)}
			<!-- Out of the tab order: the section list is the keyboard's way in -->
			<button
				type="button"
				tabindex="-1"
				{disabled}
				aria-pressed={loopEnabled && loop !== null && sameRange(section, loop)}
				title="{section.label} ({range(section)})"
				onclick={() => onselect(section.id)}
				class="block-button absolute overflow-hidden rounded-md border px-1 text-left text-xs font-medium transition-colors duration-150 disabled:opacity-50 motion-reduce:transition-none {tone(
					section
				)}"
				style="left: calc({percent(section.start)}% + 1px); width: calc({percent(
					section.end - section.start
				)}% - 2px); top: calc({section.row} * var(--lane-row) + 1px)"
			>
				<!-- Cut off, not ellipsised: a narrow block keeps more of its name -->
				<span class="block overflow-hidden whitespace-nowrap">{section.label}</span>
			</button>
		{/each}

		{#each edges as edge (`${edge.row}:${edge.endOf}:${edge.startOf}`)}
			{@const inHand = held !== null && held.endOf === edge.endOf && held.startOf === edge.startOf}
			<!-- Mouse only. The list's "Set to loop" does this job for touch and keyboard. -->
			<span
				aria-hidden="true"
				class="edge absolute z-10 pointer-coarse:hidden {inHand ? 'in-hand' : ''}"
				style="left: {percent(edge.time)}%; top: calc({edge.row} * var(--lane-row))"
				onpointerdown={(e) => grab(e, edge)}
			></span>
		{/each}

		{#if held}
			<span
				class="pointer-events-none absolute -top-6 z-20 -translate-x-1/2 rounded bg-surface-900 px-1.5 py-0.5 text-xs font-medium text-surface-50 shadow-md dark:bg-surface-100 dark:text-surface-900"
				style="left: {percent(heldTime)}%"
			>
				{tenths(heldTime)}
			</span>
		{/if}
	</div>
{:else}
	<!-- Says how to start a map. Phones skip it: the room goes to the chart. -->
	<p
		class="mb-1.5 hidden h-7 items-center rounded-md border border-dashed border-surface-300 px-2 text-xs text-surface-500 md:flex dark:border-surface-600 dark:text-surface-300"
	>
		Press&nbsp;<kbd
			class="rounded border border-surface-300 bg-surface-100 px-1 font-sans text-label font-medium dark:border-surface-600 dark:bg-surface-800"
			>S</kbd
		>&nbsp;at each change to map this song's sections.
	</p>
{/if}

<style>
	.lane {
		--lane-row: 1.75rem;
	}
	/* Touch: taller, but short of 44px. The chart needs the room, and the section
	   list and the transport's keys are the full-size way to pick one. */
	@media (pointer: coarse) {
		.lane {
			--lane-row: 2.5rem;
		}
	}
	.block-button {
		height: calc(var(--lane-row) - 2px);
	}
	.edge {
		width: 11px;
		height: var(--lane-row);
		transform: translateX(-50%);
		cursor: ew-resize;
		touch-action: none;
	}
	.edge::before {
		content: '';
		position: absolute;
		inset: 2px 4px;
		border-radius: 2px;
		background: transparent;
		transition: background-color 150ms;
	}
	.edge:hover::before {
		background: var(--color-accent-500);
	}
	/* A drag in flight is live */
	.edge.in-hand::before {
		background: var(--focus-live-color);
	}
</style>
