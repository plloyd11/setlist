<script lang="ts">
	import Knob from '#lib/components/ui/Knob.svelte';
	import SectionList from '#lib/components/practice/SectionList.svelte';
	import { microLabel, panel } from '#lib/components/practice/practiceStyles.js';
	import { formatDuration } from '#lib/utils/duration.js';
	import { SPEED_DETENTS, type LoopRange, type SavedSection } from '#lib/utils/practicePrefs.js';

	let {
		volume,
		speed,
		loop,
		loopEnabled,
		preRoll,
		returnOnStop,
		sections,
		currentSectionId,
		disabled = false,
		onvolumechange,
		onspeedchange,
		onloopclear,
		onprerolltoggle,
		onreturnonstoptoggle,
		onmark,
		onsavesection,
		onrecallsection,
		onrenamesection,
		ondeletesection,
		onsectiontoloop
	}: {
		volume: number;
		speed: number;
		loop: LoopRange | null;
		loopEnabled: boolean;
		preRoll: boolean;
		/** A stop goes back to where the pass started, instead of staying put */
		returnOnStop: boolean;
		sections: SavedSection[];
		currentSectionId: string | null;
		disabled?: boolean;
		onvolumechange: (v: number) => void;
		onspeedchange: (v: number) => void;
		onloopclear: () => void;
		onprerolltoggle: () => void;
		onreturnonstoptoggle: () => void;
		onmark: () => void;
		onsavesection: (label: string) => void;
		onrecallsection: (s: SavedSection) => void;
		onrenamesection: (id: string, label: string) => void;
		ondeletesection: (id: string) => void;
		onsectiontoloop: (id: string) => void;
	} = $props();

	const percent = (v: number) => `${Math.round(v * 100)}%`;
	const toggle = (on: boolean) =>
		`focus-live min-h-9 rounded-lg border px-2.5 text-sm font-medium disabled:opacity-50 ${
			on
				? 'border-accent-500 bg-accent-500 text-white shadow-sm'
				: 'border-surface-300 text-surface-700 hover:border-accent-400 hover:text-accent-600 dark:border-surface-600 dark:text-surface-300 dark:hover:border-accent-600 dark:hover:text-accent-400'
		}`;
</script>

<div class={panel}>
	<!-- Amp head: the two pots, then how the loop and the transport behave. Arming
	     the loop is on the transport. -->
	<div class="flex flex-wrap items-start gap-x-5 gap-y-3 px-4 py-3">
		<Knob value={volume} label="Volume" format={percent} {disabled} onchange={onvolumechange} />
		<Knob
			value={speed}
			min={SPEED_DETENTS[0]}
			max={SPEED_DETENTS[SPEED_DETENTS.length - 1]}
			detents={[...SPEED_DETENTS]}
			label="Speed"
			format={percent}
			{disabled}
			onchange={onspeedchange}
		/>

		<div class="min-w-0 flex-1">
			<p class={microLabel}>Loop</p>
			<div class="flex h-7 items-center gap-1">
				<p
					data-testid="loop-reading"
					class="text-sm font-medium {loop
						? 'text-surface-900 dark:text-surface-100'
						: 'text-surface-500 dark:text-surface-300'}"
				>
					{#if loop}
						{formatDuration(Math.round(loop.start))}–{formatDuration(Math.round(loop.end))}
					{:else}
						Not set
					{/if}
				</p>
				{#if loop}
					<button
						type="button"
						onclick={onloopclear}
						{disabled}
						aria-label="Clear loop"
						title="Clear loop"
						class="focus-live flex h-7 w-7 items-center justify-center rounded-md text-base leading-none text-surface-500 hover:bg-surface-100 hover:text-surface-800 disabled:opacity-50 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100"
					>
						&times;
					</button>
				{/if}
			</div>
			<div class="mt-1 flex flex-wrap items-center gap-1.5">
				<button
					type="button"
					onclick={onprerolltoggle}
					{disabled}
					aria-pressed={preRoll}
					title="Back up 2 seconds before every pass of the loop"
					class={toggle(preRoll)}
				>
					Pre-roll 2s
				</button>
				<button
					type="button"
					onclick={onreturnonstoptoggle}
					{disabled}
					aria-pressed={returnOnStop}
					title="Stopping goes back to where you started, so every pass begins at the same spot. Shift+Space does the other."
					class={toggle(returnOnStop)}
				>
					Return on stop
				</button>
			</div>
		</div>
	</div>

	<div class="border-t border-surface-200 dark:border-surface-700">
		<SectionList
			{sections}
			{loop}
			{loopEnabled}
			currentId={currentSectionId}
			{disabled}
			{onmark}
			onsaveloop={onsavesection}
			onrecall={onrecallsection}
			onrename={onrenamesection}
			ondelete={ondeletesection}
			onsettoloop={onsectiontoloop}
		/>
	</div>
</div>
