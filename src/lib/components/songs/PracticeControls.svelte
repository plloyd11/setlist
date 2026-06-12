<script lang="ts">
	import Knob from '$lib/components/ui/Knob.svelte';
	import { formatDuration } from '$lib/utils/duration';
	import {
		SPEED_DETENTS,
		MAX_SECTIONS,
		type LoopRange,
		type SavedSection
	} from '$lib/utils/practicePrefs';

	let {
		volume,
		speed,
		loop,
		loopEnabled,
		preRoll,
		sections,
		disabled = false,
		onvolumechange,
		onspeedchange,
		onlooptoggle,
		onloopclear,
		onprerolltoggle,
		onsavesection,
		onrecallsection,
		ondeletesection
	}: {
		volume: number;
		speed: number;
		loop: LoopRange | null;
		loopEnabled: boolean;
		preRoll: boolean;
		sections: SavedSection[];
		disabled?: boolean;
		onvolumechange: (v: number) => void;
		onspeedchange: (v: number) => void;
		onlooptoggle: () => void;
		onloopclear: () => void;
		onprerolltoggle: () => void;
		onsavesection: (label: string) => void;
		onrecallsection: (s: SavedSection) => void;
		ondeletesection: (id: string) => void;
	} = $props();

	const percent = (v: number) => `${Math.round(v * 100)}%`;

	// Inline label input replaces window.prompt for "Save section"
	let savingSection = $state(false);
	let sectionLabel = $state('');

	function commitSection() {
		const label = sectionLabel.trim();
		if (label) onsavesection(label);
		savingSection = false;
		sectionLabel = '';
	}

	function isCurrentLoop(s: SavedSection): boolean {
		return (
			loop !== null && Math.abs(s.start - loop.start) < 0.05 && Math.abs(s.end - loop.end) < 0.05
		);
	}

	function rangeLabel(r: LoopRange): string {
		return `${formatDuration(Math.round(r.start))}–${formatDuration(Math.round(r.end))}`;
	}
</script>

<div
	class="mt-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-800"
>
	<!-- Amp head: the two pots, then the loop cluster -->
	<div class="flex flex-wrap items-start gap-x-6 gap-y-3">
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

		<div class="flex min-h-12 flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={onlooptoggle}
				disabled={disabled || !loop}
				aria-pressed={loopEnabled}
				title={loop ? undefined : 'Drag on the waveform or press [ and ] to set a loop'}
				class="focus-live flex h-11 items-center gap-2 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 {loopEnabled
					? 'border-accent-500 bg-accent-500 text-white shadow-sm'
					: 'border-surface-300 text-surface-700 hover:border-accent-400 hover:text-accent-600 dark:border-surface-600 dark:text-surface-300 dark:hover:border-accent-600 dark:hover:text-accent-400'}"
			>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="m17 2 4 4-4 4" />
					<path d="M3 11v-1a4 4 0 0 1 4-4h14" />
					<path d="m7 22-4-4 4-4" />
					<path d="M21 13v1a4 4 0 0 1-4 4H3" />
				</svg>
				Loop
				{#if loop}
					<span class="text-xs tabular-nums opacity-80">{rangeLabel(loop)}</span>
				{/if}
			</button>
			<button
				type="button"
				onclick={onprerolltoggle}
				disabled={disabled || !loop}
				aria-pressed={preRoll}
				class="focus-live h-11 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 {preRoll
					? 'border-accent-500 bg-accent-500 text-white shadow-sm'
					: 'border-surface-300 text-surface-700 hover:border-accent-400 hover:text-accent-600 dark:border-surface-600 dark:text-surface-300 dark:hover:border-accent-600 dark:hover:text-accent-400'}"
			>
				Pre-roll 2s
			</button>
			{#if loop}
				<button
					type="button"
					onclick={onloopclear}
					{disabled}
					class="focus-live h-11 rounded-lg px-3 text-sm font-medium text-surface-500 hover:bg-surface-100 hover:text-surface-700 disabled:opacity-50 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100"
				>
					Clear
				</button>
			{/if}
		</div>
	</div>

	<!-- Saved sections -->
	<div class="mt-3 border-t border-surface-200 pt-3 dark:border-surface-700">
		<p
			class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
		>
			Sections
		</p>
		<div class="mt-2 flex flex-wrap items-center gap-2">
			{#each sections as section (section.id)}
				<span
					class="flex items-center rounded-full border {isCurrentLoop(section)
						? 'border-accent-500 bg-accent-500 text-white shadow-sm'
						: 'border-transparent bg-accent-100 text-accent-700 dark:bg-accent-900/30 dark:text-accent-400'}"
				>
					<button
						type="button"
						onclick={() => onrecallsection(section)}
						{disabled}
						title="{section.label} ({rangeLabel(section)})"
						class="focus-live max-w-48 truncate rounded-l-full py-1.5 pr-1 pl-3 text-sm font-medium disabled:opacity-50"
					>
						{section.label}
					</button>
					<button
						type="button"
						onclick={() => ondeletesection(section.id)}
						aria-label="Delete section {section.label}"
						class="focus-live rounded-r-full py-1.5 pr-2.5 pl-1 text-sm opacity-70 hover:opacity-100"
					>
						&times;
					</button>
				</span>
			{/each}
			{#if savingSection}
				<!-- svelte-ignore a11y_autofocus — revealed by an explicit click -->
				<input
					type="text"
					bind:value={sectionLabel}
					autofocus
					maxlength="40"
					placeholder="Section name"
					aria-label="Section name"
					onkeydown={(e) => {
						if (e.key === 'Enter') commitSection();
						if (e.key === 'Escape') {
							savingSection = false;
							sectionLabel = '';
						}
					}}
					onblur={() => {
						savingSection = false;
						sectionLabel = '';
					}}
					class="focus-live w-40 rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100"
				/>
			{:else}
				<button
					type="button"
					onclick={() => (savingSection = true)}
					disabled={disabled || !loop || sections.length >= MAX_SECTIONS}
					title={loop ? undefined : 'Set a loop first, then save it as a section'}
					class="focus-live rounded-lg px-3 py-1.5 text-sm font-medium text-surface-500 hover:bg-surface-100 hover:text-surface-700 disabled:opacity-50 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100"
				>
					+ Save section
				</button>
			{/if}
		</div>
	</div>
</div>
