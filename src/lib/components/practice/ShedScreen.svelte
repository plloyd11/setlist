<script lang="ts">
	import Digits from '#lib/components/ui/Digits.svelte';
	import { onMount, type Snippet } from 'svelte';
	import { page } from '$app/state';
	import SongPracticePanel from '#lib/components/songs/SongPracticePanel.svelte';
	import ChartList from '#lib/components/songs/ChartList.svelte';
	import Metronome from '#lib/components/practice/Metronome.svelte';
	import PlanBar from '#lib/components/practice/PlanBar.svelte';
	import RigPanel from '#lib/components/practice/RigPanel.svelte';
	import { PracticeTracker, type PracticeItemRef } from './practiceTracker.svelte.js';
	import { rig } from '#lib/utils/rig.svelte.js';
	import { formatDuration } from '#lib/utils/duration.js';
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
	let playerReady = $state(false);
	let playing = $state(false);
	let metronomeRunning = $state(false);
	let chosenPane = $state<Pane | null>(null);
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
			panel?.perform(action);
		}
	}
</script>

<svelte:window onkeydown={handlePageKeydown} />

{#snippet stage(strip: Snippet, player: Snippet, controls: Snippet)}
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
					<div class="shrink-0">{@render strip()}</div>
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
				<div class="stage-pane {pane === 'chart' ? '' : 'hidden md:block'}">
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
				<p class="text-right" aria-live="off">
					<span class="sr-only">Practiced </span>
					<span
						data-testid="practice-clock"
						class="font-display text-lg leading-tight font-bold text-accent-600 md:text-xl dark:text-accent-hot"
					>
						<Digits value={formatDuration(Math.floor(tracker.seconds))} />
					</span>
				</p>
				<button
					type="button"
					onclick={() => tracker?.togglePause()}
					aria-pressed={tracker.paused}
					title="Pause the practice clock"
					class="focus-live min-h-11 rounded-lg px-3 text-sm font-medium text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
				>
					{tracker.paused ? 'Resume' : 'Pause clock'}
				</button>
			{/if}
		</div>
	</header>

	<SongPracticePanel
		bind:this={panel}
		songId={prefsKey ?? item.refId ?? item.label}
		{lengthSeconds}
		{variants}
		{versioned}
		transport={false}
		compactStrip
		empty={emptyAudio}
		arrange={stage}
		onreadychange={(ready) => (playerReady = ready)}
		onplaystatechange={(p) => (playing = p)}
		onfinish={() => (playing = false)}
	/>

	<!-- Transport: big targets at the bottom, within reach of a hand off the strings -->
	{#if hasAudio}
		<div
			class="shrink-0 border-t border-surface-200 bg-surface-50 pb-[env(safe-area-inset-bottom)] dark:border-surface-700 dark:bg-surface-900"
		>
			<div class="flex items-center justify-center gap-3 px-3 py-2 md:gap-4">
				<button
					type="button"
					onclick={() => panel?.perform('back')}
					disabled={!playerReady}
					class="focus-live flex h-11 w-11 items-center justify-center rounded-full text-surface-600 hover:bg-surface-200 disabled:opacity-40 dark:text-surface-300 dark:hover:bg-surface-700"
					aria-label="Back 5 seconds"
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M3 12a9 9 0 1 0 9-9 9.7 9.7 0 0 0-6.7 2.8L3 8" />
						<path d="M3 3v5h5" />
					</svg>
				</button>
				<button
					type="button"
					onclick={() => panel?.perform('playPause')}
					disabled={!playerReady}
					class="focus-live flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-white shadow-sm hover:bg-accent-600 disabled:opacity-50"
					aria-label={playing ? 'Pause' : 'Play'}
				>
					{#if playing}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<rect x="6" y="4" width="4" height="16" rx="1" />
							<rect x="14" y="4" width="4" height="16" rx="1" />
						</svg>
					{:else}
						<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path
								d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"
							/>
						</svg>
					{/if}
				</button>
				<button
					type="button"
					onclick={() => panel?.perform('forward')}
					disabled={!playerReady}
					class="focus-live flex h-11 w-11 items-center justify-center rounded-full text-surface-600 hover:bg-surface-200 disabled:opacity-40 dark:text-surface-300 dark:hover:bg-surface-700"
					aria-label="Forward 5 seconds"
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M21 12a9 9 0 1 1-9-9 9.7 9.7 0 0 1 6.7 2.8L21 8" />
						<path d="M21 3v5h-5" />
					</svg>
				</button>
			</div>
		</div>
	{/if}
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
