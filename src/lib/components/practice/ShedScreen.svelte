<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import SongPracticePanel from '#lib/components/songs/SongPracticePanel.svelte';
	import ChartList from '#lib/components/songs/ChartList.svelte';
	import Metronome from '#lib/components/practice/Metronome.svelte';
	import PlanBar from '#lib/components/practice/PlanBar.svelte';
	import PracticeClock from '#lib/components/practice/PracticeClock.svelte';
	import RigPanel from '#lib/components/practice/RigPanel.svelte';
	import { PracticeTracker, type PracticeItemRef } from './practiceTracker.svelte.js';
	import { rig } from '#lib/utils/rig.svelte.js';
	import { formatPracticeTime } from '#lib/utils/practiceTime.js';
	import { practiceShortcut } from '#lib/utils/practiceKeys.js';
	import { createWakeLock } from '#lib/utils/wakeLock.js';

	type Pane = 'chart' | 'controls' | 'metronome' | 'rig' | 'notes' | 'more';

	let {
		item,
		title,
		lengthSeconds,
		variants,
		charts,
		notes = null,
		backHref,
		emptyAudio,
		side,
		sideLabel = 'More',
		prefsKey,
		versioned = false,
		onready
	}: {
		/** What this screen's practice time counts toward */
		item: PracticeItemRef;
		title: string;
		lengthSeconds: number;
		variants: Parameters<typeof SongPracticePanel>[1]['variants'];
		charts: Parameters<typeof ChartList>[1]['charts'];
		notes?: string | null;
		backHref: string;
		emptyAudio: Snippet;
		/** Extra tools beside the player: status, a run timer, uploads */
		side?: Snippet<[PracticeTracker | null]>;
		sideLabel?: string;
		/** Keys remembered settings when the item has no link to keep in the practice log */
		prefsKey?: string;
		/** See SongPracticePanel */
		versioned?: boolean;
		onready?: () => void;
	} = $props();

	let panel: SongPracticePanel | undefined = $state();
	let metronome: Metronome | undefined = $state();
	let playing = $state(false);
	let metronomeRunning = $state(false);
	let chosenPane = $state<Pane | null>(null);
	// Wider screens: put the chart away and give its room to the waveform, for
	// mapping sections and placing loop points. A phone already shows one or the other.
	let chartHidden = $state(false);
	let tracker = $state<PracticeTracker | null>(null);

	let hasAudio = $derived(variants.length > 0);

	// Phone panes: only offer what this screen actually has
	let paneOptions = $derived.by((): { value: Pane; label: string }[] => [
		...(charts.length > 0 ? [{ value: 'chart' as const, label: 'Chart' }] : []),
		...(hasAudio ? [{ value: 'controls' as const, label: 'Controls' }] : []),
		{ value: 'metronome', label: 'Metronome' },
		{ value: 'rig', label: 'Rig' },
		...(notes ? [{ value: 'notes' as const, label: 'Notes' }] : []),
		...(side ? [{ value: 'more' as const, label: sideLabel }] : [])
	]);
	let pane = $derived(
		paneOptions.find((option) => option.value === chosenPane)?.value ?? paneOptions[0].value
	);

	onMount(() => {
		// A phone on a music stand must not sleep mid-song
		const wakeLock = createWakeLock();
		wakeLock.start();

		const userId = page.data.user?.id;
		if (userId) {
			// Playing through the rig counts, with or without a track
			tracker = new PracticeTracker(
				userId,
				item,
				() => playing || metronomeRunning || rig.isPlaying()
			);
			tracker.start();
		}
		onready?.();
		return () => {
			wakeLock.stop();
			tracker?.stop();
		};
	});

	function handlePageKeydown(e: KeyboardEvent) {
		const action = practiceShortcut(e);
		if (!action || action === 'nextSong' || action === 'previousSong') return;
		// With no audio, Space and L belong to the tab player, if there is one
		if (!hasAudio && action !== 'toggleMetronome') return;
		e.preventDefault();
		if (action === 'toggleMetronome') {
			metronome?.toggle();
		} else {
			panel?.perform(action, e.shiftKey);
		}
	}
</script>

<svelte:window onkeydown={handlePageKeydown} />

{#snippet stage(strip: Snippet, player: Snippet, controls: Snippet, transport: Snippet)}
	<div class="stage">
		<!-- Left: what you're playing and what you're reading -->
		<div class="stage-column">
			<div class="stage-title">
				<div class="md:flex md:items-center md:justify-between md:gap-6">
					<h1
						class="min-w-0 truncate font-display text-2xl font-bold text-surface-900 md:text-3xl dark:text-surface-100"
					>
						{title}
					</h1>
					<div class="flex shrink-0 items-center gap-3">
						{#if hasAudio && charts.length > 0}
							<button
								type="button"
								onclick={() => (chartHidden = !chartHidden)}
								aria-pressed={chartHidden}
								title={chartHidden
									? 'Bring the chart back'
									: 'Put the chart away and make the waveform bigger'}
								class="focus-live hidden min-h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium md:flex {chartHidden
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
									<path d="M2 12h2M6 7v10M10 4v16M14 8v8M18 6v12M22 12h0" />
								</svg>
								Big waveform
							</button>
						{/if}
						{@render strip()}
					</div>
				</div>
			</div>

			{#if paneOptions.length > 1}
				<!-- Scrolls sideways when every pane is offered on the narrowest phones -->
				<div class="stage-tabs flex overflow-x-auto md:hidden">
					{#each paneOptions as option (option.value)}
						<button
							type="button"
							aria-pressed={pane === option.value}
							onclick={() => (chosenPane = option.value)}
							class="focus-live min-h-11 flex-auto border-b-2 px-1 text-sm font-medium whitespace-nowrap {pane ===
							option.value
								? 'border-accent-500 text-accent-700 dark:border-accent-400 dark:text-accent-300'
								: 'border-transparent text-surface-500 dark:text-surface-300'}"
						>
							{option.label}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Nothing to play and something to read: the chart gets the room -->
			{#if hasAudio || charts.length === 0}
				<div class="stage-player">{@render player()}</div>
			{/if}

			{#if charts.length > 0}
				<!-- Hidden, not unmounted: a tab keeps its place and its settings -->
				<div
					class="stage-pane {pane === 'chart' ? '' : 'hidden'} {chartHidden
						? 'md:hidden'
						: 'md:block'}"
				>
					<ChartList {charts} autoOpen compact tabKeyboard={!hasAudio} />
				</div>
			{/if}
		</div>

		<!-- Right: how you're practicing it -->
		<div class="stage-column">
			{#if hasAudio}
				<div class="stage-pane {pane === 'controls' ? '' : 'hidden md:block'}">
					{@render controls()}
				</div>
			{/if}
			<div class="stage-pane {pane === 'metronome' ? '' : 'hidden md:block'}">
				<Metronome
					bind:this={metronome}
					songId={prefsKey ?? item.refId ?? undefined}
					onrunningchange={(running) => (metronomeRunning = running)}
				/>
			</div>
			<div class="stage-pane {pane === 'rig' ? '' : 'hidden md:block'}">
				<RigPanel />
			</div>
			{#if side}
				<div class="stage-pane {pane === 'more' ? '' : 'hidden md:block'}">
					{@render side(tracker)}
				</div>
			{/if}
			{#if notes}
				<div class="stage-pane {pane === 'notes' ? '' : 'hidden md:block'}">
					<p class="text-label text-surface-500 uppercase dark:text-surface-300">Notes</p>
					<p
						class="mt-1 text-sm break-words whitespace-pre-wrap text-surface-700 dark:text-surface-300"
					>
						{notes}
					</p>
				</div>
			{/if}
		</div>
	</div>

	{@render transport()}
{/snippet}

<div class="flex h-full min-h-0 flex-col">
	<header class="flex shrink-0 items-center gap-2 px-3 py-1 md:px-6 md:py-3">
		<a
			href={backHref}
			class="focus-live flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-surface-100"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
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
				<path d="m15 18-6-6 6-6" />
			</svg>
			Back
		</a>
		<div class="ml-auto flex min-w-0 items-center gap-2">
			<PlanBar />
			{#if tracker}
				<PracticeClock {tracker} />
			{/if}
		</div>
	</header>

	<SongPracticePanel
		bind:this={panel}
		songId={prefsKey ?? item.refId ?? item.label}
		{lengthSeconds}
		{variants}
		{versioned}
		compactStrip
		tall={chartHidden || charts.length === 0}
		empty={emptyAudio}
		arrange={stage}
		onplaystatechange={(p) => (playing = p)}
		onfinish={() => (playing = false)}
	/>
</div>

<style>
	/* Phone: one column that fits the screen. Title, tabs, one scrolling pane, then
	   the waveform, so a chart gets whatever height is left. The columns dissolve so
	   every part is a direct row of this grid. */
	.stage {
		flex: 1;
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto auto minmax(0, 1fr) auto;
		padding: 0 0.75rem;
	}
	.stage-column {
		display: contents;
	}
	.stage-title {
		grid-row: 1;
		padding-bottom: 0.25rem;
	}
	.stage-tabs {
		grid-row: 2;
	}
	.stage-pane {
		grid-row: 3;
		min-height: 0;
		overflow-y: auto;
		padding: 0.5rem 0;
	}
	.stage-player {
		grid-row: 4;
		padding-bottom: 0.5rem;
	}

	/* Wider: two columns that scroll on their own. The waveform stays pinned while a
	   long chart scrolls beneath it, and the chart sits directly under it. */
	@media (min-width: 768px) {
		.stage {
			grid-template-columns: minmax(0, 1fr) 20rem;
			grid-template-rows: minmax(0, 1fr);
			gap: 1.5rem;
			padding: 0 1.5rem;
		}
		.stage-column {
			display: flex;
			flex-direction: column;
			gap: 1rem;
			min-height: 0;
			overflow-y: auto;
			padding-bottom: 1rem;
		}
		.stage-title,
		.stage-pane,
		.stage-player {
			padding: 0;
			overflow: visible;
			flex-shrink: 0;
		}
		.stage-player {
			position: sticky;
			top: 0;
			z-index: 10;
		}
	}
</style>
