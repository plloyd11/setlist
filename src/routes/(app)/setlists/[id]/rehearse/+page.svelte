<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import SongPracticePanel from '#lib/components/songs/SongPracticePanel.svelte';
	import ChartList from '#lib/components/songs/ChartList.svelte';
	import {
		buildRehearseItems,
		RehearseState
	} from '#lib/components/rehearse/rehearseState.svelte.js';
	import { formatDuration } from '#lib/utils/duration.js';
	import { practiceShortcut } from '#lib/utils/practiceKeys.js';
	import { createWakeLock } from '#lib/utils/wakeLock.js';

	// A silent clip played from the Start tap: iOS only lets an element play without a
	// tap once it has played from one, and every song after this plays through it.
	const SILENT_WAV =
		'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

	type Pane = 'chart' | 'controls' | 'set' | 'notes';
	const PANE_LABELS: Record<Pane, string> = {
		chart: 'Chart',
		controls: 'Controls',
		set: 'Set',
		notes: 'Notes'
	};

	let { data } = $props();

	// The timeline is a one-shot snapshot, since nothing edits the set mid-session
	// svelte-ignore state_referenced_locally
	const rehearse = new RehearseState(
		buildRehearseItems(data.rows, data.setlist.transition_seconds)
	);

	// Signed links are not part of that snapshot: retrying an expired link reruns the
	// load, and the fresh links reach the player through this map.
	let rowsById = $derived(new Map(data.rows.map((row) => [row.id, row])));

	// Song numbering counts songs only; gaps and transitions are un-numbered
	const songNumbers = new Map<string, number>();
	{
		let n = 0;
		for (const item of rehearse.items) {
			if (item.kind === 'song') songNumbers.set(item.key, ++n);
		}
	}
	const songCount = songNumbers.size;

	let panel: SongPracticePanel | undefined = $state();
	let mediaEl: HTMLAudioElement | undefined = $state();
	let listEl: HTMLOListElement | undefined = $state();
	let playerReady = $state(false);
	let autoplayBlocked = $state(false);
	let chosenPane = $state<Pane | null>(null);

	const wakeLock = createWakeLock();

	onMount(() => {
		// Wall-clock deltas inside tick() mean a throttled background tab self-corrects
		const interval = setInterval(() => rehearse.tick(Date.now()), 250);
		return () => {
			clearInterval(interval);
			wakeLock.stop();
		};
	});

	$effect(() => {
		if (rehearse.status === 'finished') wakeLock.stop();
	});

	function start() {
		if (mediaEl) {
			const el = mediaEl;
			el.src = SILENT_WAV;
			el.play()
				.then(() => {
					// Only if the first song hasn't already taken the element over
					if (el.src === SILENT_WAV) el.pause();
				})
				.catch(() => {});
		}
		autoplayBlocked = false;
		rehearse.start();
		wakeLock.start();
	}

	// Peaks are heavy, so they ship separately from the load: fetched per variant the
	// first time it's about to play, then cached. Null peaks are fine, since wavesurfer
	// then decodes the audio itself.
	const peaksCache = new Map<string, number[] | null>();
	async function loadPeaks(variantId: string): Promise<number[] | null> {
		if (peaksCache.has(variantId)) return peaksCache.get(variantId) ?? null;
		const { peaks } = await fetch(`/setlists/${data.setlist.id}/rehearse/peaks/${variantId}`)
			.then((r) => (r.ok ? r.json() : { peaks: null }))
			.catch(() => ({ peaks: null }));
		peaksCache.set(variantId, peaks ?? null);
		return peaks ?? null;
	}

	let current = $derived(rehearse.current);
	let currentSong = $derived(current?.kind === 'song' ? current : null);
	let hasAudio = $derived(!!currentSong && currentSong.variants.length > 0);
	let isLive = $derived(rehearse.status === 'running');
	let inSession = $derived(rehearse.status === 'running' || rehearse.status === 'paused');
	let currentRow = $derived(currentSong ? rowsById.get(currentSong.key) : undefined);
	let currentCharts = $derived(currentRow?.charts ?? []);

	// Phone panes: only offer what this item actually has
	let paneOptions = $derived.by((): Pane[] => {
		if (!currentSong) return ['set'];
		return [
			...(currentCharts.length > 0 ? (['chart'] as const) : []),
			...(hasAudio ? (['controls'] as const) : []),
			'set',
			'notes'
		];
	});
	let pane = $derived(chosenPane && paneOptions.includes(chosenPane) ? chosenPane : paneOptions[0]);

	// Keep the current row visible as the set advances
	$effect(() => {
		const key = current?.key;
		if (!key || !listEl) return;
		const row = listEl.querySelector(`[data-key="${key}"]`);
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		row?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
	});

	function handleTogglePlay() {
		if (rehearse.trackEnded) {
			panel?.restart();
		} else if (hasAudio) {
			panel?.perform('playPause');
		} else {
			rehearse.togglePause();
		}
	}

	function goToRow(index: number) {
		if (index !== rehearse.index) rehearse.goTo(index);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!inSession) return;
		const action = practiceShortcut(e);
		if (!action) return;
		e.preventDefault();
		if (action === 'nextSong') {
			rehearse.next();
		} else if (action === 'previousSong') {
			rehearse.previous();
		} else if (action === 'playPause') {
			handleTogglePlay();
		} else {
			panel?.perform(action);
		}
	}

	let playLabel = $derived.by(() => {
		if (rehearse.trackEnded) return 'Again';
		if (current?.kind === 'song' && !hasAudio) return isLive ? 'Stop stopwatch' : 'Start stopwatch';
		return isLive ? 'Pause' : 'Play';
	});
</script>

<svelte:head>
	<title>Rehearse: {data.setlist.name}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<!-- Outlives every song: see SILENT_WAV -->
<audio bind:this={mediaEl} preload="auto" playsinline class="hidden"></audio>

{#snippet microLabel(text: string)}
	<p
		class="shrink-0 text-[10px] font-medium tracking-wider whitespace-nowrap text-surface-500 uppercase dark:text-surface-300"
	>
		{text}
	</p>
{/snippet}

{#snippet runSwitch()}
	<div class="flex items-center justify-between gap-3">
		<div class="min-w-0">
			<p class="text-sm font-medium text-surface-900 dark:text-surface-100">Run the set</p>
			<p class="text-xs text-surface-500 dark:text-surface-300">
				{rehearse.runSet
					? 'Tracks play on, breaks count down.'
					: 'Stay on one song until you move on.'}
			</p>
		</div>
		<button
			type="button"
			role="switch"
			aria-checked={rehearse.runSet}
			aria-label="Run the set"
			onclick={() => (rehearse.runSet = !rehearse.runSet)}
			class="focus-live relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-150 motion-reduce:transition-none {rehearse.runSet
				? 'border-accent-600 bg-accent-500'
				: 'border-surface-300 bg-surface-200 dark:border-surface-600 dark:bg-surface-700'}"
		>
			<span
				class="absolute top-0.5 left-0.5 h-[1.375rem] w-[1.375rem] rounded-full bg-surface-50 shadow-sm transition-transform duration-150 motion-reduce:transition-none {rehearse.runSet
					? 'translate-x-5'
					: ''}"
			></span>
		</button>
	</div>
{/snippet}

{#snippet setList(interactive: boolean)}
	<ol
		bind:this={listEl}
		class="divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-surface-50 dark:divide-surface-700 dark:border-surface-700 dark:bg-surface-800/50"
	>
		{#each rehearse.items as item, i (item.key)}
			{@const isCurrent = interactive && i === rehearse.index}
			{@const liveRing =
				isCurrent && isLive
					? 'shadow-glow-neon ring-2 ring-neon-600 ring-inset dark:ring-neon-400'
					: ''}
			{#if item.kind === 'song'}
				<li data-key={item.key} class={liveRing}>
					<button
						type="button"
						disabled={!interactive}
						aria-current={isCurrent ? 'true' : undefined}
						onclick={() => goToRow(i)}
						class="focus-live flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left {isCurrent
							? 'bg-surface-100 dark:bg-surface-800'
							: interactive
								? 'hover:bg-surface-100 dark:hover:bg-surface-800'
								: ''}"
					>
						<span class="w-5 shrink-0 text-right text-sm text-surface-500 tabular-nums">
							{songNumbers.get(item.key)}
						</span>
						<span
							class="min-w-0 flex-1 truncate text-sm font-medium {interactive && i < rehearse.index
								? 'text-surface-500 dark:text-surface-400'
								: 'text-surface-900 dark:text-surface-100'}"
						>
							{item.title}
						</span>
						{#if item.variants.length > 0}
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="12"
								height="12"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								class="shrink-0 text-accent-500 dark:text-accent-400"
								aria-label="Has a backing track"
								role="img"
							>
								<path d="M9 18V5l12-2v13" />
								<circle cx="6" cy="18" r="3" />
								<circle cx="18" cy="16" r="3" />
							</svg>
						{/if}
						<span class="shrink-0 text-sm text-surface-500 tabular-nums dark:text-surface-300">
							{formatDuration(item.durationSeconds)}
						</span>
					</button>
				</li>
			{:else if item.kind === 'gap' && (rehearse.runSet || isCurrent)}
				<li data-key={item.key} class="flex items-center gap-3 px-3 py-1.5 {liveRing}">
					<span class="w-5 shrink-0"></span>
					<span
						class="min-w-0 flex-1 truncate text-xs text-surface-500 italic dark:text-surface-300"
					>
						{item.label ?? 'Break'}
					</span>
					<span class="shrink-0 text-xs text-surface-500 tabular-nums dark:text-surface-300">
						{formatDuration(item.seconds)}
					</span>
				</li>
			{:else if item.kind === 'transition' && isCurrent}
				<li
					data-key={item.key}
					class="px-3 py-1 text-center text-[10px] tracking-wider text-surface-500 uppercase dark:text-surface-300 {liveRing}"
				>
					Transition &middot; {formatDuration(item.seconds)}
				</li>
			{/if}
		{/each}
	</ol>
{/snippet}

{#snippet stopwatch()}
	<div
		class="rounded-xl border border-surface-200 bg-surface-50 p-6 text-center dark:border-surface-700 dark:bg-surface-800"
	>
		{@render microLabel('Stopwatch')}
		<p
			role="timer"
			class="mt-1 font-display text-5xl font-bold text-surface-900 tabular-nums md:text-6xl dark:text-surface-100"
		>
			{formatDuration(Math.floor(rehearse.stopwatchSeconds))}
		</p>
		<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
			No backing track for this one. Play it live, then tap Next.
		</p>
	</div>
{/snippet}

{#snippet stage(strip: Snippet | null, player: Snippet, controls: Snippet | null)}
	<div class="stage">
		<!-- Left: what you're playing and what you're reading -->
		<div class="stage-column">
			<div class="stage-title">
				<div class="flex items-baseline justify-between gap-3">
					{@render microLabel(
						currentSong ? `Song ${songNumbers.get(currentSong.key)} of ${songCount}` : 'Break'
					)}
					{#if rehearse.upNext}
						<p class="min-w-0 truncate text-xs text-surface-500 lg:hidden dark:text-surface-300">
							Next: {rehearse.upNext}
						</p>
					{/if}
				</div>
				<div class="md:flex md:items-center md:justify-between md:gap-6">
					<h2
						class="min-w-0 truncate font-display text-2xl font-bold text-surface-900 md:text-3xl dark:text-surface-100"
					>
						{currentSong?.title ??
							(current?.kind === 'gap' ? (current.label ?? 'Break') : 'Transition')}
					</h2>
					{#if strip}
						<div class="shrink-0">{@render strip()}</div>
					{/if}
				</div>
			</div>

			{#if paneOptions.length > 1}
				<div class="stage-tabs flex md:hidden">
					{#each paneOptions as option (option)}
						<button
							type="button"
							aria-pressed={pane === option}
							onclick={() => (chosenPane = option)}
							class="focus-live min-h-11 flex-1 border-b-2 text-sm font-medium {pane === option
								? 'border-accent-500 text-accent-700 dark:border-accent-400 dark:text-accent-300'
								: 'border-transparent text-surface-500 dark:text-surface-300'}"
						>
							{PANE_LABELS[option]}
						</button>
					{/each}
				</div>
			{/if}

			<div class="stage-player">{@render player()}</div>

			{#if currentCharts.length > 0}
				<div class="stage-pane {pane === 'chart' ? '' : 'hidden md:block'}">
					<ChartList charts={currentCharts} autoOpen compact />
				</div>
			{/if}
		</div>

		<!-- Right: how you're practicing it, and what's around it -->
		<div class="stage-column">
			{#if controls}
				<div class="stage-pane {pane === 'controls' ? '' : 'hidden md:block'}">
					{@render controls()}
				</div>
			{/if}
			<div class="stage-pane {pane === 'set' ? '' : 'hidden md:block'}">
				<div class="mb-3">{@render runSwitch()}</div>
				{@render setList(true)}
			</div>
			{#if currentSong}
				<div class="stage-pane {pane === 'notes' ? '' : 'hidden md:block'}">
					{@render microLabel('Notes')}
					{#if currentSong.notes}
						<p
							class="mt-1 text-sm break-words whitespace-pre-wrap text-surface-700 dark:text-surface-300"
						>
							{currentSong.notes}
						</p>
					{:else}
						<p class="mt-1 text-sm text-surface-500 dark:text-surface-300">
							No notes for this song.
						</p>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/snippet}

{#snippet breakCountdown()}
	<div
		class="rounded-xl border border-surface-200 bg-surface-50 p-6 text-center dark:border-surface-700 dark:bg-surface-800"
	>
		<p
			role="timer"
			class="font-display text-6xl font-bold text-surface-900 tabular-nums dark:text-surface-100"
		>
			{formatDuration(Math.ceil(rehearse.countdownRemaining))}
		</p>
		{#if isLive}
			<span
				class="mx-auto mt-3 block h-2 w-2 animate-pulse rounded-full bg-neon-600 shadow-glow-neon motion-reduce:animate-none dark:bg-neon-400"
				aria-hidden="true"
			></span>
		{:else}
			<p class="mt-3 text-xs text-surface-500 dark:text-surface-300">Paused</p>
		{/if}
	</div>
{/snippet}

<div class="flex h-full min-h-0 flex-col">
	<!-- Header: where you are, how long you've been at it, how to leave -->
	<header class="flex shrink-0 items-center gap-2 px-3 py-1 md:px-6 md:py-3">
		<a
			href={data.backHref}
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
		{#if inSession}
			<h1
				class="min-w-0 flex-1 truncate font-display text-base text-surface-700 md:text-lg dark:text-surface-300"
			>
				{data.setlist.name}
			</h1>
			<div class="flex shrink-0 items-center gap-3 md:gap-4">
				<div class="text-right">
					<div class="sr-only md:not-sr-only">{@render microLabel('Practiced')}</div>
					<p
						class="font-display text-lg leading-tight font-bold text-accent-600 tabular-nums md:text-xl dark:text-accent-hot"
					>
						<span class="sr-only md:hidden">Practiced</span>
						{formatDuration(Math.floor(rehearse.practicedSeconds))}
					</p>
				</div>
				<div class="hidden text-right md:block">
					{@render microLabel('Set')}
					<p
						class="font-display text-xl leading-tight font-bold text-surface-700 tabular-nums dark:text-surface-300"
					>
						{formatDuration(rehearse.totalSeconds)}
					</p>
				</div>
				{#if data.setlist.target_seconds}
					<div class="hidden text-right md:block">
						{@render microLabel('Target')}
						<p
							class="font-display text-xl leading-tight font-bold text-surface-700 tabular-nums dark:text-surface-300"
						>
							{formatDuration(data.setlist.target_seconds)}
						</p>
					</div>
				{/if}
				{#if rehearse.upNext}
					<div class="hidden max-w-48 min-w-0 text-right lg:block">
						{@render microLabel('Up next')}
						<p class="truncate text-sm font-medium text-surface-700 dark:text-surface-300">
							{rehearse.upNext}
						</p>
					</div>
				{/if}
				<button
					type="button"
					onclick={() => rehearse.end()}
					class="focus-live min-h-11 rounded-lg px-3 text-sm font-medium text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
				>
					End
				</button>
			</div>
		{/if}
	</header>

	{#if rehearse.items.length === 0}
		<div class="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4 md:p-6">
			<h1 class="font-display text-3xl text-surface-900 md:text-5xl dark:text-surface-100">
				{data.setlist.name}
			</h1>
			<p class="mt-4 text-sm font-medium text-surface-700 dark:text-surface-300">
				This setlist is empty
			</p>
			<p class="mt-1 text-sm text-surface-500 dark:text-surface-300">
				Add songs to the set, then come back to practice it.
			</p>
			<a
				href={data.backHref}
				class="focus-live mt-6 inline-block rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
			>
				Back to setlist
			</a>
		</div>
	{:else if rehearse.status === 'idle'}
		<div class="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4 md:p-6">
			<h1
				class="font-display text-3xl leading-[1.1] text-balance break-words text-surface-900 md:text-5xl dark:text-surface-100"
			>
				{data.setlist.name}
			</h1>
			<p class="mt-3 text-sm text-surface-500 dark:text-surface-300">
				{songCount}
				{songCount === 1 ? 'song' : 'songs'} &middot; {formatDuration(rehearse.totalSeconds)}
			</p>
			<p class="mt-2 max-w-prose text-sm text-surface-700 dark:text-surface-300">
				Drill one song or run the whole set. Songs with audio play as backing tracks, and the rest
				get a stopwatch so you can time them live.
			</p>
			<div class="mt-6">{@render runSwitch()}</div>
			<!-- The hero CTA: the one always-energized button on this screen -->
			<button
				type="button"
				onclick={start}
				class="focus-live mt-6 w-full rounded-lg bg-accent-hot px-8 py-4 font-display text-lg font-bold text-surface-950 shadow-glow-accent hover:brightness-105 md:w-auto"
			>
				Start rehearsal
			</button>
			<div class="mt-8">{@render setList(false)}</div>
		</div>
	{:else if rehearse.status === 'finished'}
		<div class="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-4 md:p-6">
			<h1
				class="font-display text-3xl font-bold text-surface-900 md:text-5xl dark:text-surface-100"
			>
				Set complete
			</h1>
			<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
				You played for {formatDuration(Math.floor(rehearse.practicedSeconds))}. The set runs
				{formatDuration(rehearse.totalSeconds)}.
			</p>
			<div class="mt-6 flex items-center gap-3">
				<button
					type="button"
					onclick={start}
					class="focus-live min-h-11 rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
				>
					Start again
				</button>
				<a
					href={data.backHref}
					class="focus-live flex min-h-11 items-center rounded-lg px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-800 dark:text-surface-300 dark:hover:text-surface-100"
				>
					Back to setlist
				</a>
			</div>
		</div>
	{:else if currentSong}
		<!-- Remounted per row, not per song: the same song twice in a row must reload -->
		{#key currentSong.key}
			<SongPracticePanel
				bind:this={panel}
				songId={currentSong.songId ?? currentSong.key}
				lengthSeconds={currentSong.durationSeconds}
				variants={currentRow?.variants ?? currentSong.variants}
				autoplay={isLive}
				media={mediaEl}
				transport={false}
				compactStrip
				{loadPeaks}
				empty={stopwatch}
				arrange={stage}
				onreadychange={(ready) => (playerReady = ready)}
				onplaystatechange={(playing) => {
					if (playing) autoplayBlocked = false;
					rehearse.setAudioPlaying(playing);
				}}
				onfinish={() => rehearse.onAudioFinished()}
				onautoplayblocked={() => {
					rehearse.setAudioPlaying(false);
					autoplayBlocked = true;
				}}
			/>
		{/key}
	{:else}
		{@render stage(null, breakCountdown, null)}
	{/if}

	<!-- Transport: big targets at the bottom, within reach of a hand off the strings -->
	{#if inSession}
		<div
			class="shrink-0 border-t border-surface-200 bg-surface-50 pb-[env(safe-area-inset-bottom)] dark:border-surface-700 dark:bg-surface-900"
		>
			{#if autoplayBlocked}
				<p
					role="status"
					class="px-4 pt-2 text-center text-sm text-surface-600 dark:text-surface-300"
				>
					Your browser blocked autoplay. Press play to carry on.
				</p>
			{/if}
			<div class="flex items-center justify-center gap-2 px-3 py-2 md:gap-4">
				<button
					type="button"
					onclick={() => rehearse.previous()}
					disabled={!rehearse.hasPrevious}
					class="focus-live flex h-11 w-11 items-center justify-center rounded-full text-surface-600 hover:bg-surface-200 disabled:opacity-40 dark:text-surface-300 dark:hover:bg-surface-700"
					aria-label="Previous"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" />
					</svg>
				</button>

				{#if hasAudio}
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
				{/if}

				<button
					type="button"
					onclick={handleTogglePlay}
					disabled={hasAudio && !playerReady}
					class="focus-live flex h-14 w-14 items-center justify-center rounded-full bg-accent-500 text-white shadow-sm hover:bg-accent-600 disabled:opacity-50"
					aria-label={playLabel}
				>
					{#if rehearse.trackEnded}
						<svg
							width="22"
							height="22"
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
					{:else if isLive}
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

				{#if hasAudio}
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
				{/if}

				<button
					type="button"
					onclick={() => rehearse.next()}
					class="focus-live flex h-11 w-11 items-center justify-center rounded-full text-surface-600 hover:bg-surface-200 dark:text-surface-300 dark:hover:bg-surface-700"
					aria-label={currentSong ? 'Next' : 'Skip'}
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
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
	   long chart scrolls beneath it, and the chart sits directly under it rather than
	   below the controls. */
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
