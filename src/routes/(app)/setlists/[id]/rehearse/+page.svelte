<script lang="ts">
	import { onMount } from 'svelte';
	import WaveformPlayer from '$lib/components/tracks/WaveformPlayer.svelte';
	import { buildRehearseItems, RehearseState } from '$lib/components/rehearse/rehearseState.svelte';
	import { formatDuration } from '$lib/utils/duration';

	let { data } = $props();

	// Intentional one-shot snapshot: the rehearse page is read-only, so the
	// timeline never needs to react to invalidation mid-session
	// svelte-ignore state_referenced_locally
	const rehearse = new RehearseState(
		buildRehearseItems(data.rows, data.setlist.transition_seconds)
	);

	// Song numbering counts songs only — gaps and transitions are un-numbered
	const songNumbers = new Map<string, number>();
	{
		let n = 0;
		for (const item of rehearse.items) {
			if (item.kind === 'song') songNumbers.set(item.key, ++n);
		}
	}
	const songCount = songNumbers.size;

	let player: WaveformPlayer | undefined = $state();
	let playerReady = $state(false);
	let loadError = $state(false);
	let autoplayBlocked = $state(false);
	let listEl: HTMLOListElement | undefined = $state();

	// Peaks ship separately from the load (10KB/variant adds up on long sets):
	// fetched per variant the first time it's about to play, then cached.
	const peaksCache = new Map<string, number[] | null>();
	let currentPeaks = $state<number[] | null>(null);
	let peaksReady = $state(false);

	// Drives gap/transition countdowns; wall-clock deltas inside tick() mean a
	// throttled background tab self-corrects on wake
	onMount(() => {
		const interval = setInterval(() => rehearse.tick(Date.now()), 250);
		return () => clearInterval(interval);
	});

	// New audio source (item advance or variant switch) -> reset player state
	// and resolve the variant's peaks before mounting the player
	$effect(() => {
		const variant = rehearse.currentVariant;
		playerReady = false;
		loadError = false;
		autoplayBlocked = false;
		currentPeaks = null;
		peaksReady = false;
		if (!variant?.signedUrl) {
			peaksReady = true;
			return;
		}
		if (peaksCache.has(variant.id)) {
			currentPeaks = peaksCache.get(variant.id) ?? null;
			peaksReady = true;
			return;
		}
		let cancelled = false;
		fetch(`/setlists/${data.setlist.id}/rehearse/peaks/${variant.id}`)
			.then((r) => (r.ok ? r.json() : { peaks: null }))
			.catch(() => ({ peaks: null }))
			.then(({ peaks }) => {
				// Null peaks are fine — wavesurfer decodes the audio itself
				peaksCache.set(variant.id, peaks ?? null);
				if (!cancelled) {
					currentPeaks = peaks ?? null;
					peaksReady = true;
				}
			});
		return () => {
			cancelled = true;
		};
	});

	// Keep the current row visible as the set advances
	$effect(() => {
		const item = rehearse.current;
		if (!item || !listEl) return;
		const row = listEl.querySelector(`[data-key="${item.key}"]`);
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		row?.scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
	});

	async function handlePlayerReady() {
		playerReady = true;
		if (rehearse.current?.kind === 'song' && rehearse.status === 'running') {
			const ok = await player?.play();
			// Browser autoplay policy can break the auto-advance chain — degrade
			// to one tap per song instead of hanging silently, and say so
			if (ok === false) {
				rehearse.setAudioPlaying(false);
				autoplayBlocked = true;
			}
		}
	}

	function handlePlayStateChange(playing: boolean) {
		if (playing) autoplayBlocked = false;
		rehearse.setAudioPlaying(playing);
	}

	function handleTogglePause() {
		const item = rehearse.current;
		if (!item) return;
		if (item.kind === 'song') {
			if (rehearse.status === 'waiting' || !playerReady) return;
			player?.playPause();
		} else {
			rehearse.togglePause();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (target.closest('input, select, textarea, button, a, [role="slider"]')) return;
		if (rehearse.status === 'idle' || rehearse.status === 'finished') return;
		if (e.key === ' ') {
			e.preventDefault();
			handleTogglePause();
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			rehearse.next();
		} else if (e.key === 'ArrowLeft') {
			e.preventDefault();
			rehearse.prev();
		}
	}

	function handleVariantChange(e: Event) {
		const item = rehearse.current;
		if (!item || item.kind !== 'song' || !item.songId) return;
		rehearse.selectVariant(item.songId, (e.currentTarget as HTMLSelectElement).value);
	}

	let isLive = $derived(rehearse.status === 'running');
	let progressPercent = $derived(
		rehearse.totalSeconds > 0 ? (rehearse.elapsedSeconds / rehearse.totalSeconds) * 100 : 0
	);
</script>

<svelte:head>
	<title>Rehearse — {data.setlist.name}</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} />

<div class="mx-auto flex min-h-full w-full max-w-3xl flex-col p-4 pb-0 md:p-8 md:pb-0">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<a
			href={data.backHref}
			class="focus-live flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-surface-500 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-surface-100"
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
			>
				<path d="m15 18-6-6 6-6" />
			</svg>
			Back
		</a>
		<h1 class="min-w-0 truncate font-display text-xl text-surface-900 dark:text-surface-100">
			{data.setlist.name}
		</h1>
	</div>

	<!-- Instrument-panel readout strip — items-start keeps the micro-labels on
	     one line when cell heights differ (xl numbers vs the sm up-next value) -->
	<div
		class="mt-4 flex items-start gap-6 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-800"
	>
		<div>
			<p
				class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
			>
				Elapsed
			</p>
			<p class="font-display text-xl font-bold text-accent-600 tabular-nums dark:text-accent-hot">
				{formatDuration(Math.floor(rehearse.elapsedSeconds))}
			</p>
		</div>
		<div>
			<p
				class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
			>
				Total
			</p>
			<p class="font-display text-xl font-bold text-surface-700 tabular-nums dark:text-surface-300">
				{formatDuration(rehearse.totalSeconds)}
			</p>
		</div>
		{#if rehearse.upNext && rehearse.status !== 'finished'}
			<div class="min-w-0 flex-1 text-right">
				<p
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
				>
					Up next
				</p>
				<p class="truncate text-sm font-medium text-surface-700 dark:text-surface-300">
					{rehearse.upNext}
				</p>
			</div>
		{/if}
	</div>

	<!-- Overall progress -->
	<div class="mt-2 h-1 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700">
		<div
			class="h-full rounded-full bg-accent-500 transition-[width] duration-300 motion-reduce:transition-none dark:bg-accent-hot"
			style="width: {Math.min(progressPercent, 100)}%"
		></div>
	</div>

	{#if rehearse.items.length === 0}
		<div
			class="mt-8 rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-12 text-center dark:border-surface-700 dark:bg-surface-900/50"
		>
			<p class="font-display text-lg text-surface-700 dark:text-surface-300">
				This setlist is empty
			</p>
			<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
				Add songs to the set before rehearsing.
			</p>
			<a
				href={data.backHref}
				class="mt-6 inline-block rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
			>
				Back to setlist
			</a>
		</div>
	{:else if rehearse.status === 'idle'}
		<!-- Start screen -->
		<div
			class="mt-8 flex flex-col items-center rounded-xl border border-surface-200 bg-surface-50 p-10 text-center dark:border-surface-700 dark:bg-surface-800"
		>
			<p class="text-sm text-surface-500 dark:text-surface-300">
				{songCount}
				{songCount === 1 ? 'song' : 'songs'} &middot; {formatDuration(rehearse.totalSeconds)}
			</p>
			<p class="mt-2 max-w-md text-sm text-surface-500 dark:text-surface-300">
				Plays your set in order — songs with audio play through, timed breaks count down, and songs
				without audio wait for you to play them live.
			</p>
			<!-- The hero CTA: the one always-energized button on this screen -->
			<button
				type="button"
				onclick={() => rehearse.start()}
				class="focus-live mt-6 rounded-lg bg-accent-hot px-8 py-4 font-display text-lg font-bold text-surface-950 shadow-glow-accent hover:brightness-105"
			>
				Start rehearsal
			</button>
		</div>
	{:else if rehearse.status === 'finished'}
		<!-- Finished -->
		<div
			class="mt-8 flex flex-col items-center rounded-xl border border-surface-200 bg-surface-50 p-10 text-center dark:border-surface-700 dark:bg-surface-800"
		>
			<p class="font-display text-3xl font-bold text-surface-900 dark:text-surface-100">
				Set complete
			</p>
			<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
				{formatDuration(rehearse.totalSeconds)} of music, breaks included.
			</p>
			<div class="mt-6 flex items-center gap-3">
				<button
					type="button"
					onclick={() => rehearse.start()}
					class="focus-live rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
				>
					Restart
				</button>
				<a
					href={data.backHref}
					class="focus-live rounded-lg px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-800 dark:text-surface-300 dark:hover:text-surface-100"
				>
					Back to setlist
				</a>
			</div>
		</div>
	{:else if rehearse.current}
		{@const item = rehearse.current}
		<!-- Current item panel -->
		<div class="mt-6">
			{#if item.kind === 'song'}
				{@const variant = rehearse.currentVariant}
				<div class="flex items-end justify-between gap-3">
					<div class="min-w-0">
						<p
							class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
						>
							Now {variant ? 'playing' : 'up'}
						</p>
						<h2
							class="truncate font-display text-2xl font-bold text-surface-900 dark:text-surface-100"
						>
							{item.title}
						</h2>
					</div>
					{#if item.variants.length > 1 && item.songId}
						<select
							value={variant?.id}
							onchange={handleVariantChange}
							aria-label="Audio variant"
							class="focus-live shrink-0 rounded-lg border border-surface-300 bg-surface-50 px-2 py-1.5 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
						>
							{#each item.variants as v (v.id)}
								<option value={v.id} disabled={!v.signedUrl}>
									{v.label ?? 'Unlabeled'}{v.signedUrl ? '' : ' (unavailable)'}
								</option>
							{/each}
						</select>
					{/if}
				</div>

				{#if variant?.signedUrl}
					{#if peaksReady}
						<div class="mt-3">
							<WaveformPlayer
								bind:this={player}
								url={variant.signedUrl}
								peaks={currentPeaks}
								duration={variant.duration_seconds}
								onready={handlePlayerReady}
								onfinish={() => rehearse.onAudioFinished()}
								onplaystatechange={handlePlayStateChange}
								ontimeupdate={(t) => (rehearse.songElapsed = t)}
								onloaderror={() => (loadError = true)}
							/>
						</div>
					{/if}
					{#if autoplayBlocked}
						<p role="status" class="mt-2 text-sm text-surface-600 dark:text-surface-300">
							Your browser blocked autoplay — press play to continue.
						</p>
					{/if}
					{#if loadError}
						<p role="alert" class="mt-2 text-sm text-danger-600 dark:text-danger-400">
							Audio failed to load — it may have expired. Skip ahead, or reload the page for fresh
							links.
						</p>
					{/if}
				{:else}
					<!-- Pause-and-wait: no audio means the band plays this one live -->
					<div
						class="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-6 text-center dark:border-surface-700 dark:bg-surface-800"
					>
						<p class="text-sm text-surface-500 dark:text-surface-300">
							No audio for this one — play it live, then carry on.
						</p>
						<button
							type="button"
							onclick={() => rehearse.next()}
							class="focus-live mt-4 rounded-lg bg-accent-500 px-6 py-3 font-semibold text-white shadow-sm hover:bg-accent-600"
						>
							Done — next song
						</button>
					</div>
				{/if}

				{#if item.notes}
					<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">{item.notes}</p>
				{/if}
			{:else}
				<!-- Gap / transition countdown -->
				<div
					class="rounded-xl border border-surface-200 bg-surface-50 p-8 text-center dark:border-surface-700 dark:bg-surface-800"
				>
					<p
						class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
					>
						{item.kind === 'gap' ? (item.label ?? 'Break') : 'Transition'}
					</p>
					<p
						class="mt-1 font-display text-6xl font-bold text-surface-900 tabular-nums dark:text-surface-100"
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
			{/if}
		</div>

		<!-- Set order -->
		<ol
			bind:this={listEl}
			class="mt-6 divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-surface-50 dark:divide-surface-700 dark:border-surface-700 dark:bg-surface-800/50"
		>
			{#each rehearse.items as listItem, i (listItem.key)}
				{@const isCurrent = i === rehearse.index}
				{#if listItem.kind === 'song'}
					<li
						data-key={listItem.key}
						class="flex items-center gap-3 px-4 py-2.5 {isCurrent
							? 'bg-surface-100 dark:bg-surface-800'
							: ''} {isCurrent && isLive
							? 'shadow-glow-neon ring-2 ring-neon-600 ring-inset dark:ring-neon-400'
							: ''}"
					>
						<span
							class="w-6 shrink-0 text-right text-sm text-surface-400 tabular-nums dark:text-surface-500"
							>{songNumbers.get(listItem.key)}</span
						>
						<span
							class="min-w-0 flex-1 truncate text-sm font-medium {i < rehearse.index
								? 'text-surface-400 dark:text-surface-500'
								: 'text-surface-900 dark:text-surface-100'}"
						>
							{listItem.title}
						</span>
						{#if listItem.variants.some((v) => v.signedUrl)}
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
								aria-label="Has audio"
							>
								<path d="M9 18V5l12-2v13" />
								<circle cx="6" cy="18" r="3" />
								<circle cx="18" cy="16" r="3" />
							</svg>
						{/if}
						<span class="shrink-0 text-sm text-surface-500 tabular-nums dark:text-surface-300">
							{formatDuration(listItem.durationSeconds)}
						</span>
					</li>
				{:else if listItem.kind === 'gap'}
					<li
						data-key={listItem.key}
						class="flex items-center gap-3 px-4 py-1.5 {isCurrent
							? 'bg-surface-100 dark:bg-surface-800'
							: ''} {isCurrent && isLive
							? 'shadow-glow-neon ring-2 ring-neon-600 ring-inset dark:ring-neon-400'
							: ''}"
					>
						<span class="w-6 shrink-0"></span>
						<span
							class="min-w-0 flex-1 truncate text-xs text-surface-500 italic dark:text-surface-300"
						>
							{listItem.label ?? 'Break'}
						</span>
						<span class="shrink-0 text-xs text-surface-500 tabular-nums dark:text-surface-300">
							{formatDuration(listItem.seconds)}
						</span>
					</li>
				{:else}
					<li
						data-key={listItem.key}
						class="px-4 py-1 text-center text-[10px] tracking-wider text-surface-400 uppercase dark:text-surface-500 {isCurrent &&
						isLive
							? 'shadow-glow-neon ring-2 ring-neon-600 ring-inset dark:ring-neon-400'
							: ''}"
					>
						Transition &middot; {formatDuration(listItem.seconds)}
					</li>
				{/if}
			{/each}
		</ol>
	{/if}

	<!-- Transport — sticky bottom (same idiom as TimingBar), ≥44px targets for
	     phones in dark rooms -->
	{#if rehearse.status !== 'idle' && rehearse.status !== 'finished' && rehearse.items.length > 0}
		<div
			class="sticky bottom-0 z-10 -mx-4 mt-auto border-t border-surface-200 bg-surface-50/95 pt-0 backdrop-blur md:-mx-8 dark:border-surface-700 dark:bg-surface-900/95"
		>
			<div class="flex items-center justify-center gap-6 px-4 py-3">
				<button
					type="button"
					onclick={() => rehearse.prev()}
					disabled={rehearse.index === 0}
					class="focus-live flex h-11 w-11 items-center justify-center rounded-full text-surface-600 hover:bg-surface-200 disabled:opacity-40 dark:text-surface-300 dark:hover:bg-surface-700"
					aria-label="Previous"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
						<path d="M6 6h2v12H6zM9.5 12l8.5 6V6z" />
					</svg>
				</button>

				{#if rehearse.status === 'waiting'}
					<button
						type="button"
						onclick={() => rehearse.next()}
						class="focus-live flex h-12 items-center justify-center rounded-full bg-accent-500 px-6 font-semibold text-white shadow-sm hover:bg-accent-600"
					>
						Done — next
					</button>
				{:else}
					<button
						type="button"
						onclick={handleTogglePause}
						disabled={rehearse.current?.kind === 'song' && !playerReady}
						class="focus-live flex h-12 w-12 items-center justify-center rounded-full bg-accent-500 text-white shadow-sm hover:bg-accent-600 disabled:opacity-50"
						aria-label={isLive ? 'Pause' : 'Play'}
					>
						{#if isLive}
							<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
								<rect x="6" y="4" width="4" height="16" rx="1" />
								<rect x="14" y="4" width="4" height="16" rx="1" />
							</svg>
						{:else}
							<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
								<path
									d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"
								/>
							</svg>
						{/if}
					</button>
				{/if}

				<button
					type="button"
					onclick={() => rehearse.next()}
					class="focus-live flex h-11 w-11 items-center justify-center rounded-full text-surface-600 hover:bg-surface-200 dark:text-surface-300 dark:hover:bg-surface-700"
					aria-label="Next"
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
						<path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
					</svg>
				</button>
			</div>
		</div>
	{/if}
</div>
