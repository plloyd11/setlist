<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { refreshAll } from '$app/navigation';
	import WaveformPlayer from '#lib/components/tracks/WaveformPlayer.svelte';
	import PracticeControls from '#lib/components/songs/PracticeControls.svelte';
	import SectionLane from '#lib/components/practice/SectionLane.svelte';
	import TransportBar from '#lib/components/practice/TransportBar.svelte';
	import { getRememberedVariant, rememberVariant } from '#lib/utils/variantChoice.js';
	import {
		fitLoop,
		loadPracticePrefs,
		loadReturnOnStop,
		savePracticePrefs,
		saveReturnOnStop,
		MAX_SECTIONS,
		MIN_LOOP_SECONDS,
		type LoopRange,
		type SavedSection
	} from '#lib/utils/practicePrefs.js';
	import type { PracticeAction } from '#lib/utils/practiceKeys.js';
	import {
		markAt,
		moveBoundary,
		nextSection,
		previousSection,
		sameRange,
		sectionAt,
		sortSections,
		type Boundary
	} from '#lib/utils/sections.js';
	import { formatDuration } from '#lib/utils/duration.js';
	import type { SongAudio } from '#lib/types/database.js';

	// Peaks may be absent: long sets fetch them per song through loadPeaks
	type Variant = Omit<SongAudio, 'waveform_peaks' | 'song_id'> & {
		waveform_peaks?: number[] | null;
		signedUrl: string | null;
	};

	let {
		songId,
		lengthSeconds,
		variants,
		empty,
		arrange,
		autoplay = false,
		media,
		compactStrip = false,
		tall = false,
		versioned = false,
		loadPeaks,
		onfinish,
		onplaystatechange,
		onautoplayblocked,
		onreadychange
	}: {
		/** Keys the durable per-song settings and the remembered mix */
		songId: string;
		lengthSeconds: number;
		variants: Variant[];
		/** Shown when the song has no audio at all */
		empty?: Snippet;
		/** Lay out the readout strip, player, controls and transport. Defaults to stacking them. */
		arrange?: Snippet<[Snippet, Snippet, Snippet, Snippet]>;
		/** Start playing as soon as the player is ready */
		autoplay?: boolean;
		/** See WaveformPlayer: required for playing on without a tap on iOS */
		media?: HTMLMediaElement;
		/** One quiet line, for screens that already have a loud reading and need the room */
		compactStrip?: boolean;
		/** See WaveformPlayer: a taller waveform when the screen has the room */
		tall?: boolean;
		/**
		 * The variants are takes of one recording, newest first, not mixes of a song. So
		 * each has its own length, and this always opens on the newest: nobody should
		 * keep learning an old take without noticing the band has moved on.
		 */
		versioned?: boolean;
		/** Fetches peaks for variants that don't carry them */
		loadPeaks?: (variantId: string) => Promise<number[] | null>;
		onfinish?: () => void;
		onplaystatechange?: (playing: boolean) => void;
		onautoplayblocked?: () => void;
		onreadychange?: (ready: boolean) => void;
	} = $props();

	const reduceMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let player: WaveformPlayer | undefined = $state();
	let playing = $state(false);
	let playable = $derived(variants.filter((v) => v.signedUrl));
	let selectedVariantId = $state<string | null>(null);
	let currentVariant = $derived(
		playable.find((v) => v.id === selectedVariantId) ?? playable[0] ?? null
	);
	// Audio exists but nothing signed — a storage/signing failure, not an
	// empty library. Must not render as "No rehearsal audio yet".
	let signingFailed = $derived(variants.length > 0 && playable.length === 0);
	let shownLength = $derived(
		versioned ? (currentVariant?.duration_seconds ?? lengthSeconds) : lengthSeconds
	);

	// DAW practice state — durable per song; the player instance is recreated
	// per variant, so these are re-applied in applySettings on every `ready`
	let volume = $state(1);
	let speed = $state(1);
	let loop = $state<LoopRange | null>(null);
	let preRoll = $state(false);
	// One setting for every song: a stop goes back to where the pass started
	let returnOnStop = $state(false);
	let sections = $state<SavedSection[]>([]);
	// Deliberately not persisted: restoring an armed loop trap on load is
	// surprising — the region comes back muted and `L` re-arms it
	let loopEnabled = $state(false);
	let playerReady = $state(false);
	let sectionNotice = $state('');
	// The playhead, a few times a second: enough to say which section it's in
	let currentTime = $state(0);
	let duration = $state(0);

	// A section that starts past the end of this mix isn't on it
	let playableSections = $derived(
		sections.filter((s) => !duration || s.start < duration - MIN_LOOP_SECONDS)
	);
	let currentSection = $derived(sectionAt(playableSections, currentTime));
	// The section the loop is sitting on. Worked out by comparing, so dragging the
	// loop off it lets go of the section without any bookkeeping.
	let loopedSection = $derived.by(() => {
		const range = loop;
		return range ? (sections.find((s) => sameRange(s, range)) ?? null) : null;
	});
	let canStepForward = $derived(
		nextSection(playableSections, loopEnabled && loop ? loop.start : currentTime) !== null
	);

	$effect(() => onreadychange?.(playerReady));

	// A variant without peaks waits for them before the player mounts, or wavesurfer
	// would download and decode the whole file to draw its own.
	let fetchedPeaks = $state<{ variantId: string; peaks: number[] | null } | null>(null);
	let peaksReady = $derived(
		!currentVariant ||
			currentVariant.waveform_peaks !== undefined ||
			fetchedPeaks?.variantId === currentVariant.id
	);
	let currentPeaks = $derived(
		currentVariant?.waveform_peaks ??
			(fetchedPeaks?.variantId === currentVariant?.id ? fetchedPeaks?.peaks : null) ??
			null
	);

	$effect(() => {
		const variantId = currentVariant?.id;
		if (!variantId || peaksReady || !loadPeaks) return;
		let cancelled = false;
		loadPeaks(variantId).then((peaks) => {
			if (!cancelled) fetchedPeaks = { variantId, peaks };
		});
		return () => {
			cancelled = true;
		};
	});

	function persist() {
		savePracticePrefs(songId, {
			volume,
			speed,
			loop,
			preRoll,
			sections,
			updatedAt: Date.now()
		});
	}

	// The remembered choices live in localStorage (variant shared with rehearse
	// mode), so they can only be applied after hydration
	onMount(() => {
		const remembered = versioned ? undefined : getRememberedVariant(songId);
		if (remembered && playable.some((v) => v.id === remembered)) {
			selectedVariantId = remembered;
		}
		const prefs = loadPracticePrefs(songId);
		volume = prefs.volume;
		speed = prefs.speed;
		loop = prefs.loop;
		preRoll = prefs.preRoll;
		sections = sortSections(prefs.sections);
		returnOnStop = loadReturnOnStop();
	});

	// Push everything onto the fresh wavesurfer instance. A loop from another
	// variant (or a stale store) may overshoot this file — clamp or drop it.
	async function applySettings() {
		playerReady = true;
		currentTime = 0;
		duration = player?.getDuration() ?? 0;
		player?.setVolume(volume);
		player?.setPlaybackRate(speed);
		player?.setPreRoll(preRoll);
		player?.setReturnOnStop(returnOnStop);
		if (loop) {
			const fitted = fitLoop(loop, player?.getDuration() ?? 0);
			if (fitted) {
				loop = fitted;
				player?.setLoop(loop);
			} else {
				loop = null;
				loopEnabled = false;
				persist();
			}
		}
		player?.setLoopEnabled(loopEnabled);
		if (autoplay && (await player?.play()) === false) onautoplayblocked?.();
	}

	function handleVariantChange(e: Event) {
		const id = (e.currentTarget as HTMLSelectElement).value;
		selectedVariantId = id;
		playing = false;
		playerReady = false;
		sectionNotice = '';
		if (!versioned) rememberVariant(songId, id);
	}

	// Refresh signed URLs once if one expired mid-session; a second failure on
	// the same variant means the audio itself is the problem.
	let retriedVariantId = $state<string | null>(null);
	let failedVariantId = $state<string | null>(null);

	function handlePlayerError() {
		playing = false;
		if (currentVariant && retriedVariantId !== currentVariant.id) {
			retriedVariantId = currentVariant.id;
			refreshAll();
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
		await refreshAll();
		retrying = false;
	}

	// ---- DAW controls ----

	function handleRegionChange(r: LoopRange | null) {
		loop = r;
		persist();
	}

	function toggleLoop() {
		if (!loop) return;
		loopEnabled = !loopEnabled;
		player?.setLoopEnabled(loopEnabled);
	}

	function clearLoop() {
		loop = null;
		loopEnabled = false;
		player?.setLoop(null);
		player?.setLoopEnabled(false);
		persist();
	}

	function togglePreRoll() {
		preRoll = !preRoll;
		player?.setPreRoll(preRoll);
		persist();
	}

	function toggleReturnOnStop() {
		returnOnStop = !returnOnStop;
		player?.setReturnOnStop(returnOnStop);
		saveReturnOnStop(returnOnStop);
	}

	function setVolume(v: number) {
		volume = v;
		player?.setVolume(v);
		persist();
	}

	function setSpeed(v: number) {
		speed = v;
		player?.setPlaybackRate(v);
		persist();
	}

	function skip(delta: number) {
		if (!player) return;
		const dur = player.getDuration();
		player.seekTo(Math.min(dur, Math.max(0, player.getCurrentTime() + delta)));
	}

	// `[` pins A at the playhead, `]` pins B — whichever half is missing
	// stretches to the file edge so one keypress always yields a usable loop
	function setLoopPoint(side: 'start' | 'end') {
		if (!player) return;
		const t = player.getCurrentTime();
		const dur = player.getDuration();
		if (!dur) return;
		const next: LoopRange =
			side === 'start'
				? { start: t, end: loop && loop.end >= t + MIN_LOOP_SECONDS ? loop.end : dur }
				: { start: loop && loop.start <= t - MIN_LOOP_SECONDS ? loop.start : 0, end: t };
		// Pinning a point too close to the file edge would make a degenerate loop
		if (next.end - next.start < MIN_LOOP_SECONDS) return;
		loop = next;
		player.setLoop(next);
		persist();
	}

	// ---- Sections ----

	function saveSection(label: string) {
		if (!loop || sections.length >= MAX_SECTIONS) return;
		sections = sortSections([
			...sections,
			{ id: crypto.randomUUID(), label, start: loop.start, end: loop.end }
		]);
		persist();
	}

	/** Loop a section and go to the top of it */
	function recallSection(s: SavedSection) {
		// Sections are saved per song, but this mix may be shorter than the one
		// the section was saved on
		const fitted = fitLoop(s, player?.getDuration() ?? 0);
		if (!fitted) {
			sectionNotice = `"${s.label}" runs past the end of this mix.`;
			return;
		}
		sectionNotice = '';
		loop = fitted;
		loopEnabled = true;
		player?.setLoop(loop);
		player?.setLoopEnabled(true);
		// Arming only jumps in from outside. Picking a section always starts it over.
		player?.seekToLoopStart();
		persist();
	}

	function deleteSection(id: string) {
		sections = sections.filter((s) => s.id !== id);
		persist();
	}

	function renameSection(id: string, label: string) {
		sections = sections.map((s) => (s.id === id ? { ...s, label } : s));
		persist();
	}

	/** Drop a boundary at the playhead (see markAt) */
	function markSection() {
		if (!player || !playerReady) return;
		const result = markAt(sections, player.getCurrentTime(), player.getDuration());
		if (result.ok) {
			sections = result.sections;
			sectionNotice = '';
			persist();
		} else {
			sectionNotice =
				result.reason === 'limit'
					? `That's all ${MAX_SECTIONS} sections. Delete one to mark another.`
					: 'Too close to the edge of a section to mark here.';
		}
	}

	/** Move a section to where the loop is: the way to trim one without a mouse */
	function sectionToLoop(id: string) {
		if (!loop) return;
		const { start, end } = loop;
		sections = sortSections(sections.map((s) => (s.id === id ? { ...s, start, end } : s)));
		persist();
	}

	// Dragging an edge in the lane. The loop follows the section it's sitting on,
	// so trimming the section you're looping changes what you hear straight away.
	function dragBoundary(boundary: Boundary, time: number) {
		const followId = loopedSection?.id;
		sections = moveBoundary(sections, boundary, time);
		if (followId !== boundary.endOf && followId !== boundary.startOf) return;
		const followed = sections.find((s) => s.id === followId);
		if (followed) {
			loop = { start: followed.start, end: followed.end };
			player?.setLoop(loop);
		}
	}

	/**
	 * Step to the section before or after. With the loop armed the loop moves with
	 * you, so drilling a song section by section is one key. Otherwise it's a seek.
	 */
	function stepSection(direction: 1 | -1) {
		if (!player || !playerReady) return;
		const now = player.getCurrentTime();
		const target =
			direction === 1
				? nextSection(playableSections, loopEnabled && loop ? loop.start : now)
				: previousSection(playableSections, now);
		if (!target) {
			if (direction === -1) player.seekTo(0);
			return;
		}
		if (loopEnabled) recallSection(target);
		else player.seekTo(target.start);
	}

	/** Back to the top of the track and play */
	export function restart() {
		player?.seekTo(0);
		void player?.play();
	}

	/**
	 * Run a keyboard shortcut (see practiceShortcut). `shift` turns a stop into the
	 * other kind: stay put when stops go back, go back when they stay put.
	 */
	export function perform(action: PracticeAction, shift = false) {
		switch (action) {
			case 'playPause':
				player?.playPause(shift);
				break;
			case 'toggleLoop':
				toggleLoop();
				break;
			case 'pinLoopStart':
				setLoopPoint('start');
				break;
			case 'pinLoopEnd':
				setLoopPoint('end');
				break;
			case 'back':
				skip(-5);
				break;
			case 'forward':
				skip(5);
				break;
			case 'markSection':
				markSection();
				break;
			case 'previousSection':
				stepSection(-1);
				break;
			case 'nextSection':
				stepSection(1);
				break;
			case 'zoomIn':
				player?.zoomBy(1.5);
				break;
			case 'zoomOut':
				player?.zoomBy(1 / 1.5);
				break;
			case 'zoomFit':
				player?.zoomFit();
				break;
			default:
				// 1 to 9: loop that section
				if (action.startsWith('section')) {
					const section = sections[Number(action.slice('section'.length)) - 1];
					if (section) recallSection(section);
				}
		}
	}
</script>

<!-- Instrument readout strip: length in the TimingBar's copper voice, the
     mix control, and the live lamp while audio plays. The mix selector
     lives here — outside the player branch — so a broken mix never strands
     the user; switching mixes is the recovery path. -->
<!-- items-start so the micro-labels sit on one line across cells of unequal
     height (the xl number, the sm mix value, the select all differ) -->
{#snippet stripBlock()}
	{#if compactStrip}
		<div class="flex items-center gap-3">
			<span class="text-sm font-medium text-surface-600 dark:text-surface-300">
				<span class="sr-only">Length</span>
				{formatDuration(shownLength)}
			</span>
			{#if playable.length > 1}
				<label for="practice-variant" class="sr-only">Mix</label>
				<select
					id="practice-variant"
					value={currentVariant?.id}
					onchange={handleVariantChange}
					class="focus-live min-h-11 max-w-48 min-w-0 rounded-lg border border-surface-300 bg-surface-50 px-3 py-1 text-sm text-surface-900 md:min-h-9 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
				>
					{#each playable as variant (variant.id)}
						<option value={variant.id}>{variant.label ?? variant.file_name}</option>
					{/each}
				</select>
			{:else if currentVariant}
				<span class="truncate text-sm text-surface-500 dark:text-surface-300">
					{currentVariant.label ?? currentVariant.file_name}
				</span>
			{/if}
			{#if playing}
				<span
					class="h-2 w-2 shrink-0 animate-pulse rounded-full bg-neon-600 shadow-glow-neon motion-reduce:animate-none dark:bg-neon-400"
					role="img"
					aria-label="Playing"
				></span>
			{/if}
		</div>
	{:else}
		<div
			class="flex items-start gap-6 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-800"
		>
			<div class="shrink-0">
				<p class="text-label text-surface-500 uppercase dark:text-surface-300">Length</p>
				<p class="font-display text-xl font-bold text-accent-600 dark:text-accent-hot">
					{formatDuration(shownLength)}
				</p>
			</div>
			{#if playable.length > 1}
				<div class="min-w-0">
					<label
						for="practice-variant"
						class="text-label text-surface-500 uppercase dark:text-surface-300"
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
					<p class="text-label text-surface-500 uppercase dark:text-surface-300">Mix</p>
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
	{/if}
{/snippet}

{#snippet playerBlock()}
	{#if currentVariant?.signedUrl && !audioFailed}
		{#if peaksReady}
			{#key currentVariant.id}
				<WaveformPlayer
					bind:this={player}
					url={currentVariant.signedUrl}
					peaks={currentPeaks}
					duration={currentVariant.duration_seconds}
					practice={true}
					{media}
					transport={false}
					readout={false}
					{tall}
					{lane}
					onready={applySettings}
					ontimeupdate={(t) => (currentTime = t)}
					onregionchange={handleRegionChange}
					onloaderror={handlePlayerError}
					onplaystatechange={(p) => {
						playing = p;
						onplaystatechange?.(p);
					}}
					onfinish={() => {
						playing = false;
						onfinish?.();
					}}
				/>
			{/key}
		{:else}
			<div
				class="min-h-[8.5rem] animate-pulse rounded-xl border border-surface-200 bg-surface-50 motion-reduce:animate-none dark:border-surface-800 dark:bg-surface-900"
				aria-hidden="true"
			></div>
		{/if}
	{:else if audioFailed || signingFailed}
		<div
			role="alert"
			class="rounded-xl border border-surface-200 bg-surface-50 p-6 text-center dark:border-surface-800 dark:bg-surface-900"
		>
			<p class="text-sm text-surface-700 dark:text-surface-300">
				{audioFailed && playable.length > 1
					? "Couldn't load this mix. Try another, or retry."
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
		{@render empty?.()}
	{/if}
{/snippet}

{#snippet controlsBlock()}
	{#if currentVariant?.signedUrl && !audioFailed}
		<PracticeControls
			{volume}
			{speed}
			{loop}
			{loopEnabled}
			{preRoll}
			{returnOnStop}
			{sections}
			currentSectionId={currentSection?.id ?? null}
			disabled={!playerReady}
			onvolumechange={setVolume}
			onspeedchange={setSpeed}
			onloopclear={clearLoop}
			onprerolltoggle={togglePreRoll}
			onreturnonstoptoggle={toggleReturnOnStop}
			onmark={markSection}
			onsavesection={saveSection}
			onrecallsection={recallSection}
			onrenamesection={renameSection}
			ondeletesection={deleteSection}
			onsectiontoloop={sectionToLoop}
		/>
		{#if sectionNotice}
			<p role="status" class="mt-2 text-sm text-surface-600 dark:text-surface-300">
				{sectionNotice}
			</p>
		{/if}
	{/if}
{/snippet}

{#snippet lane()}
	<SectionLane
		{sections}
		{duration}
		{currentTime}
		{loop}
		{loopEnabled}
		disabled={!playerReady}
		onselect={(id) => {
			const section = sections.find((s) => s.id === id);
			if (section) recallSection(section);
		}}
		onboundarymove={dragBoundary}
		onboundaryend={persist}
	/>
{/snippet}

{#snippet transportBlock()}
	{#if variants.length > 0}
		<TransportBar
			{playing}
			{returnOnStop}
			disabled={!playerReady}
			{currentTime}
			duration={duration || shownLength}
			section={currentSection?.label ?? null}
			hasSections={sections.length > 0}
			canNext={canStepForward}
			canMark={sections.length < MAX_SECTIONS}
			{loop}
			{loopEnabled}
			onplaypause={() => player?.playPause()}
			onback={() => skip(-5)}
			onforward={() => skip(5)}
			onprevious={() => stepSection(-1)}
			onnext={() => stepSection(1)}
			onlooptoggle={toggleLoop}
			onmark={markSection}
		/>
	{/if}
{/snippet}

{#if arrange}
	{@render arrange(stripBlock, playerBlock, controlsBlock, transportBlock)}
{:else}
	<div class="mt-5">{@render stripBlock()}</div>
	<div class="mt-6 space-y-3">
		{@render playerBlock()}
		{@render transportBlock()}
		{@render controlsBlock()}
	</div>
{/if}
