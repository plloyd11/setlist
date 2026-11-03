<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import { refreshAll } from '$app/navigation';
	import WaveformPlayer from '#lib/components/tracks/WaveformPlayer.svelte';
	import PracticeControls from '#lib/components/songs/PracticeControls.svelte';
	import { getRememberedVariant, rememberVariant } from '#lib/utils/variantChoice.js';
	import {
		fitLoop,
		loadPracticePrefs,
		savePracticePrefs,
		MAX_SECTIONS,
		MIN_LOOP_SECONDS,
		type LoopRange,
		type SavedSection
	} from '#lib/utils/practicePrefs.js';
	import type { PracticeAction } from '#lib/utils/practiceKeys.js';
	import { formatDuration } from '#lib/utils/duration.js';
	import type { SongAudio } from '#lib/types/database.js';

	type Variant = SongAudio & { signedUrl: string | null };

	let {
		songId,
		lengthSeconds,
		variants,
		empty
	}: {
		/** Keys the durable per-song settings and the remembered mix */
		songId: string;
		lengthSeconds: number;
		variants: Variant[];
		/** Shown when the song has no audio at all */
		empty?: Snippet;
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

	// DAW practice state — durable per song; the player instance is recreated
	// per variant, so these are re-applied in applySettings on every `ready`
	let volume = $state(1);
	let speed = $state(1);
	let loop = $state<LoopRange | null>(null);
	let preRoll = $state(false);
	let sections = $state<SavedSection[]>([]);
	// Deliberately not persisted: restoring an armed loop trap on load is
	// surprising — the region comes back muted and `L` re-arms it
	let loopEnabled = $state(false);
	let playerReady = $state(false);
	let sectionNotice = $state('');

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
		const remembered = getRememberedVariant(songId);
		if (remembered && playable.some((v) => v.id === remembered)) {
			selectedVariantId = remembered;
		}
		const prefs = loadPracticePrefs(songId);
		volume = prefs.volume;
		speed = prefs.speed;
		loop = prefs.loop;
		preRoll = prefs.preRoll;
		sections = prefs.sections;
	});

	// Push everything onto the fresh wavesurfer instance. A loop from another
	// variant (or a stale store) may overshoot this file — clamp or drop it.
	function applySettings() {
		playerReady = true;
		player?.setVolume(volume);
		player?.setPlaybackRate(speed);
		player?.setPreRoll(preRoll);
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
	}

	function handleVariantChange(e: Event) {
		const id = (e.currentTarget as HTMLSelectElement).value;
		selectedVariantId = id;
		playing = false;
		playerReady = false;
		sectionNotice = '';
		rememberVariant(songId, id);
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

	function saveSection(label: string) {
		if (!loop || sections.length >= MAX_SECTIONS) return;
		sections = [...sections, { id: crypto.randomUUID(), label, start: loop.start, end: loop.end }];
		persist();
	}

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
		persist();
	}

	function deleteSection(id: string) {
		sections = sections.filter((s) => s.id !== id);
		persist();
	}

	/** Run a keyboard shortcut (see practiceShortcut) */
	export function perform(action: PracticeAction) {
		switch (action) {
			case 'playPause':
				player?.playPause();
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
		}
	}
</script>

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
			{formatDuration(lengthSeconds)}
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
				practice={true}
				onready={applySettings}
				onregionchange={handleRegionChange}
				onloaderror={handlePlayerError}
				onplaystatechange={(p) => (playing = p)}
				onfinish={() => (playing = false)}
			/>
		{/key}
		<PracticeControls
			{volume}
			{speed}
			{loop}
			{loopEnabled}
			{preRoll}
			{sections}
			disabled={!playerReady}
			onvolumechange={setVolume}
			onspeedchange={setSpeed}
			onlooptoggle={toggleLoop}
			onloopclear={clearLoop}
			onprerolltoggle={togglePreRoll}
			onsavesection={saveSection}
			onrecallsection={recallSection}
			ondeletesection={deleteSection}
		/>
		{#if sectionNotice}
			<p role="status" class="mt-2 text-sm text-surface-600 dark:text-surface-300">
				{sectionNotice}
			</p>
		{/if}
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
		{@render empty?.()}
	{/if}
</div>
