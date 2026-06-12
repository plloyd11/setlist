<script lang="ts">
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import { invalidateAll } from '$app/navigation';
	import WaveformPlayer from '$lib/components/tracks/WaveformPlayer.svelte';
	import { getRememberedVariant, rememberVariant } from '$lib/utils/variantChoice';
	import { formatDuration } from '$lib/utils/duration';

	let { data } = $props();

	const reduceMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let player: WaveformPlayer | undefined = $state();
	let playing = $state(false);
	let playable = $derived(data.variants.filter((v) => v.signedUrl));
	let selectedVariantId = $state<string | null>(null);
	let currentVariant = $derived(
		playable.find((v) => v.id === selectedVariantId) ?? playable[0] ?? null
	);
	// Audio exists but nothing signed — a storage/signing failure, not an
	// empty library. Must not render as "No rehearsal audio yet".
	let signingFailed = $derived(data.variants.length > 0 && playable.length === 0);

	// The remembered choice lives in localStorage (shared with rehearse mode),
	// so it can only be applied after hydration
	onMount(() => {
		const remembered = getRememberedVariant(data.song.id);
		if (remembered && playable.some((v) => v.id === remembered)) {
			selectedVariantId = remembered;
		}
	});

	function handleVariantChange(e: Event) {
		const id = (e.currentTarget as HTMLSelectElement).value;
		selectedVariantId = id;
		playing = false;
		rememberVariant(data.song.id, id);
	}

	// PDF charts toggle an inline viewer; one open at a time
	let viewingChartId = $state<string | null>(null);
	let viewingChart = $derived(
		viewingChartId ? (data.charts.find((c) => c.id === viewingChartId) ?? null) : null
	);

	function downloadHref(c: (typeof data.charts)[number]): string | null {
		if (!c.signedUrl) return null;
		try {
			const u = new URL(c.signedUrl);
			u.searchParams.set('download', c.file_name);
			return u.toString();
		} catch {
			return c.signedUrl;
		}
	}

	// Refresh signed URLs once if one expired mid-session; a second failure on
	// the same variant means the audio itself is the problem.
	let retriedVariantId = $state<string | null>(null);
	let failedVariantId = $state<string | null>(null);

	function handlePlayerError() {
		playing = false;
		if (currentVariant && retriedVariantId !== currentVariant.id) {
			retriedVariantId = currentVariant.id;
			invalidateAll();
		} else if (currentVariant) {
			failedVariantId = currentVariant.id;
		}
	}

	let audioFailed = $derived(failedVariantId !== null && failedVariantId === currentVariant?.id);

	// Manual recovery: clear the once-only retry markers and re-sign every
	// URL. WaveformPlayer reloads itself when its url prop changes.
	let retrying = $state(false);
	async function retryAudio() {
		if (retrying) return;
		retrying = true;
		retriedVariantId = null;
		failedVariantId = null;
		await invalidateAll();
		retrying = false;
	}

	// Space toggles playback from anywhere on the page except form fields and
	// other controls — same idiom as the demo detail and rehearse pages
	function handlePageKeydown(e: KeyboardEvent) {
		if (e.key !== ' ' || e.defaultPrevented) return;
		const target = e.target as HTMLElement | null;
		if (target?.closest('input, textarea, select, button, a, [role="slider"], dialog')) return;
		e.preventDefault();
		player?.playPause();
	}
</script>

<svelte:window onkeydown={handlePageKeydown} />

<svelte:head>
	<title>Practice — {data.song.title}</title>
</svelte:head>

<div class="mx-auto w-full max-w-3xl p-4 md:p-8">
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
	</div>

	<!-- The marquee: the song name is the headline of this screen -->
	<h1
		class="mt-6 font-display text-4xl leading-[1.1] text-balance break-words text-surface-900 md:text-5xl dark:text-surface-100"
	>
		{data.song.title}
	</h1>

	<!-- Instrument readout strip: length in the TimingBar's copper voice, the
	     mix control, and the live lamp while audio plays. The mix selector
	     lives here — outside the player branch — so a broken mix never strands
	     the user; switching mixes is the recovery path. -->
	<!-- items-start so the micro-labels sit on one line across cells of unequal
	     height (the xl number, the sm mix value, the select all differ) -->
	<div
		class="mt-5 flex items-start gap-6 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-800"
	>
		<div class="shrink-0">
			<p
				class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
			>
				Length
			</p>
			<p class="font-display text-xl font-bold text-accent-600 tabular-nums dark:text-accent-hot">
				{formatDuration(data.song.duration_seconds)}
			</p>
		</div>
		{#if playable.length > 1}
			<div class="min-w-0">
				<label
					for="practice-variant"
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
				>
					Mix
				</label>
				<select
					id="practice-variant"
					value={currentVariant?.id}
					onchange={handleVariantChange}
					class="focus-live mt-0.5 block max-w-full min-w-0 rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
				>
					{#each playable as variant (variant.id)}
						<option value={variant.id}>{variant.label ?? variant.file_name}</option>
					{/each}
				</select>
			</div>
		{:else if currentVariant}
			<div class="min-w-0">
				<p
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
				>
					Mix
				</p>
				<p class="truncate text-sm font-medium text-surface-700 dark:text-surface-300">
					{currentVariant.label ?? currentVariant.file_name}
				</p>
			</div>
		{/if}
		{#if playing}
			<!-- Powered-on: the lamp lights only while audio is actually playing -->
			<div
				class="ml-auto flex shrink-0 items-center gap-2 self-center"
				transition:fade={{ duration: reduceMotion ? 0 : 150 }}
			>
				<span
					class="h-2 w-2 animate-pulse rounded-full bg-neon-600 shadow-glow-neon motion-reduce:animate-none dark:bg-neon-400"
				></span>
				<span class="text-xs font-medium text-surface-500 dark:text-surface-300">Playing</span>
			</div>
		{/if}
	</div>

	<!-- Player -->
	<div class="mt-6">
		{#if currentVariant?.signedUrl && !audioFailed}
			{#key currentVariant.id}
				<WaveformPlayer
					bind:this={player}
					url={currentVariant.signedUrl}
					peaks={currentVariant.waveform_peaks}
					duration={currentVariant.duration_seconds}
					onloaderror={handlePlayerError}
					onplaystatechange={(p) => (playing = p)}
					onfinish={() => (playing = false)}
				/>
			{/key}
		{:else if audioFailed || signingFailed}
			<div
				role="alert"
				class="rounded-xl border border-surface-200 bg-surface-50 p-6 text-center dark:border-surface-800 dark:bg-surface-900"
			>
				<p class="text-sm text-surface-700 dark:text-surface-300">
					{audioFailed && playable.length > 1
						? "Couldn't load this mix — try another, or retry."
						: "Couldn't load the audio for this song."}
				</p>
				<button
					type="button"
					onclick={retryAudio}
					disabled={retrying}
					class="focus-live mt-4 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-600 disabled:opacity-50"
				>
					{retrying ? 'Retrying...' : 'Try again'}
				</button>
			</div>
		{:else}
			<div
				class="rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-10 text-center dark:border-surface-700 dark:bg-surface-900/50"
			>
				<p class="font-display text-lg text-surface-700 dark:text-surface-300">
					No rehearsal audio yet
				</p>
				<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
					Upload a mix from the song panel to practice along to it.
				</p>
				<a
					href={data.backHref}
					class="focus-live mt-6 inline-block rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
				>
					Back to songs
				</a>
			</div>
		{/if}
	</div>

	<!-- Notes -->
	{#if data.song.notes}
		<div
			class="mt-6 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-800"
		>
			<p
				class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
			>
				Notes
			</p>
			<p
				class="mt-1 text-sm break-words whitespace-pre-wrap text-surface-700 dark:text-surface-300"
			>
				{data.song.notes}
			</p>
		</div>
	{/if}

	<!-- Charts & tabs -->
	{#if data.charts.length > 0}
		<div class="mt-6">
			<h2 class="font-display text-lg font-semibold text-surface-900 dark:text-surface-100">
				Charts & tabs
			</h2>
			<ul class="mt-3 flex flex-wrap gap-2">
				{#each data.charts as chart (chart.id)}
					<li class="flex max-w-full items-center gap-1">
						{#if chart.mime_type === 'application/pdf' && chart.signedUrl}
							<button
								type="button"
								onclick={() => (viewingChartId = viewingChartId === chart.id ? null : chart.id)}
								aria-pressed={viewingChartId === chart.id}
								class="focus-live max-w-full truncate rounded-lg border px-3 py-1.5 text-sm font-medium {viewingChartId ===
								chart.id
									? 'border-accent-500 bg-accent-500 text-white shadow-sm'
									: 'border-surface-300 text-surface-700 hover:border-accent-400 hover:text-accent-600 dark:border-surface-600 dark:text-surface-300 dark:hover:border-accent-600 dark:hover:text-accent-400'}"
							>
								{chart.label ?? chart.file_name}
							</button>
						{:else if chart.signedUrl}
							<a
								href={downloadHref(chart)}
								class="focus-live inline-block max-w-full truncate rounded-lg border border-surface-300 px-3 py-1.5 text-sm font-medium text-surface-700 hover:border-accent-400 hover:text-accent-600 dark:border-surface-600 dark:text-surface-300 dark:hover:border-accent-600 dark:hover:text-accent-400"
							>
								{chart.label ?? chart.file_name}
								<span class="text-xs text-surface-400 dark:text-surface-500">↓</span>
							</a>
						{:else}
							<span
								class="inline-block max-w-full truncate rounded-lg border border-surface-200 px-3 py-1.5 text-sm text-surface-400 dark:border-surface-700 dark:text-surface-500"
							>
								{chart.label ?? chart.file_name} (unavailable)
							</span>
						{/if}
					</li>
				{/each}
			</ul>

			{#if viewingChart?.signedUrl}
				<div class="mt-4" transition:slide={{ duration: reduceMotion ? 0 : 200 }}>
					<div class="flex items-center justify-between">
						<!-- The chip already shows the label (or, unlabeled, the file name) —
						     only repeat the file name when it adds information -->
						{#if viewingChart.label}
							<p class="truncate text-xs text-surface-500 dark:text-surface-300">
								{viewingChart.file_name}
							</p>
						{/if}
						<a
							href={viewingChart.signedUrl}
							target="_blank"
							rel="noopener"
							class="focus-live ml-auto shrink-0 rounded px-2 py-1 text-xs font-medium text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100"
						>
							Open in new tab
						</a>
					</div>
					<iframe
						src={viewingChart.signedUrl}
						title="Chart: {viewingChart.label ?? viewingChart.file_name}"
						class="mt-2 h-[70vh] w-full rounded-xl border border-surface-200 bg-white dark:border-surface-700"
					></iframe>
				</div>
			{/if}
		</div>
	{/if}
</div>
