<script lang="ts">
	import { onMount } from 'svelte';
	import type { AlphaTabApi, model } from '@coderline/alphatab';
	import { formatDuration } from '#lib/utils/duration.js';
	import { practiceShortcut } from '#lib/utils/practiceKeys.js';
	import { alignVisualsWithSound } from '#lib/utils/tabSoundSync.js';

	let {
		url,
		downloadHref,
		keyboard = false
	}: {
		url: string;
		downloadHref: string | null;
		/** Answer to Space and L: for when no audio mix on the page is using them */
		keyboard?: boolean;
	} = $props();

	const SPEEDS = [0.25, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 1];

	let sheet = $state<HTMLDivElement>();
	let viewport = $state<HTMLDivElement>();
	let api: AlphaTabApi | null = null;
	let score: model.Score | null = null;

	let status = $state<'loading' | 'ready' | 'failed'>('loading');
	let playerReady = $state(false);
	let playing = $state(false);
	let currentMs = $state(0);
	let endMs = $state(0);
	let trackNames = $state<string[]>([]);
	let activeTrack = $state(0);
	let muted = $state<number[]>([]);
	let soloed = $state<number[]>([]);
	let speed = $state(1);
	let looping = $state(false);
	let countIn = $state(false);
	let clickOn = $state(false);
	let showNotation = $state(false);
	let moreOpen = $state(false);

	// Tokens, so the tab reads as part of the screen in either theme
	function themeColors() {
		const style = getComputedStyle(document.documentElement);
		const token = (name: string, fallback: string) =>
			style.getPropertyValue(name).trim() || fallback;
		const dark = document.documentElement.classList.contains('dark');
		const ink = dark
			? token('--color-surface-100', '#e8eff5')
			: token('--color-surface-900', '#131b28');
		const line = token('--color-surface-400', '#5a7190');
		return {
			mainGlyphColor: ink,
			secondaryGlyphColor: line,
			scoreInfoColor: ink,
			staffLineColor: line,
			barSeparatorColor: line,
			barNumberColor: line
		};
	}

	/** Tab alone by default, as you'd read it to learn a part. Only stringed parts have tab. */
	function applyStaffVisibility() {
		for (const track of score?.tracks ?? []) {
			for (const staff of track.staves) {
				if (staff.tuning.length > 0) {
					staff.showTablature = true;
					staff.showStandardNotation = showNotation;
				}
			}
		}
	}

	onMount(() => {
		let cancelled = false;
		let stopAligning: (() => void) | undefined;

		(async () => {
			try {
				// Loaded here so nobody pays for the library until they open a tab
				const alphaTab = await import('@coderline/alphatab');
				const response = await fetch(url);
				if (!response.ok) throw new Error(`HTTP ${response.status}`);
				const data = await response.arrayBuffer();
				if (cancelled || !sheet) return;

				api = new alphaTab.AlphaTabApi(sheet, {
					core: { fontDirectory: '/font/', engine: 'svg' },
					display: { resources: themeColors() },
					// The page already says what this is, and a phone needs the height
					notation: {
						elements: new Map(
							[
								alphaTab.NotationElement.ScoreTitle,
								alphaTab.NotationElement.ScoreSubTitle,
								alphaTab.NotationElement.ScoreArtist,
								alphaTab.NotationElement.ScoreAlbum,
								alphaTab.NotationElement.ScoreWords,
								alphaTab.NotationElement.ScoreMusic,
								alphaTab.NotationElement.ScoreWordsAndMusic,
								alphaTab.NotationElement.ScoreCopyright
							].map((element) => [element, false])
						)
					},
					player: {
						playerMode: alphaTab.PlayerMode.EnabledSynthesizer,
						soundFont: '/soundfont/sonivox.sf2',
						scrollElement: viewport,
						enableCursor: true,
						enableUserInteraction: true
					}
				});
				stopAligning = alignVisualsWithSound(api, alphaTab);
				api.metronomeVolume = 0;
				api.countInVolume = 0;

				api.scoreLoaded.on((loaded) => {
					score = loaded;
					trackNames = loaded.tracks.map((t, i) => t.name || `Track ${i + 1}`);
					applyStaffVisibility();
				});
				api.renderFinished.on(() => (status = 'ready'));
				api.playerReady.on(() => (playerReady = true));
				api.playerStateChanged.on((e) => {
					playing = e.state === alphaTab.synth.PlayerState.Playing;
				});
				api.playerPositionChanged.on((e) => {
					currentMs = e.currentTime;
					endMs = e.endTime;
				});
				api.error.on(() => (status = 'failed'));

				api.load(data);
			} catch {
				if (!cancelled) status = 'failed';
			}
		})();

		return () => {
			cancelled = true;
			stopAligning?.();
			api?.destroy();
			api = null;
		};
	});

	function togglePlay() {
		api?.playPause();
	}

	function selectTrack(e: Event) {
		activeTrack = Number((e.currentTarget as HTMLSelectElement).value);
		const track = score?.tracks[activeTrack];
		if (track) api?.renderTracks([track]);
	}

	function toggleIn(list: number[], index: number): number[] {
		return list.includes(index) ? list.filter((i) => i !== index) : [...list, index];
	}

	function toggleMute() {
		const track = score?.tracks[activeTrack];
		if (!track) return;
		muted = toggleIn(muted, activeTrack);
		api?.changeTrackMute([track], muted.includes(activeTrack));
	}

	function toggleSolo() {
		const track = score?.tracks[activeTrack];
		if (!track) return;
		soloed = toggleIn(soloed, activeTrack);
		api?.changeTrackSolo([track], soloed.includes(activeTrack));
	}

	function setSpeed(e: Event) {
		speed = Number((e.currentTarget as HTMLSelectElement).value);
		if (api) api.playbackSpeed = speed;
	}

	function toggleLoop() {
		looping = !looping;
		if (api) api.isLooping = looping;
	}

	function toggleCountIn() {
		countIn = !countIn;
		if (api) api.countInVolume = countIn ? 1 : 0;
	}

	function toggleClick() {
		clickOn = !clickOn;
		if (api) api.metronomeVolume = clickOn ? 1 : 0;
	}

	function toggleNotation() {
		showNotation = !showNotation;
		applyStaffVisibility();
		api?.render();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!keyboard || status !== 'ready') return;
		const action = practiceShortcut(e);
		if (action === 'playPause' && playerReady) {
			e.preventDefault();
			togglePlay();
		} else if (action === 'toggleLoop') {
			e.preventDefault();
			toggleLoop();
		}
	}

	const toggleClass = (on: boolean) =>
		`focus-live min-h-11 rounded-lg border px-3 text-sm font-medium ${
			on
				? 'border-accent-500 bg-accent-500 text-white'
				: 'border-surface-300 text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800'
		}`;
	const selectClass =
		'focus-live min-h-11 max-w-44 rounded-lg border border-surface-300 bg-surface-50 px-2 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100';
</script>

<svelte:window onkeydown={handleKeydown} />

<section aria-label="Tab player" class="tab-player">
	{#if status === 'failed'}
		<div
			role="alert"
			class="rounded-xl border border-surface-200 bg-surface-50 p-6 text-center dark:border-surface-700 dark:bg-surface-900"
		>
			<p class="text-sm text-surface-700 dark:text-surface-300">
				Couldn't open this file. It may be damaged, or saved in a format the player doesn't read.
			</p>
			{#if downloadHref}
				<a
					href={downloadHref}
					class="focus-live mt-4 inline-block rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-600"
				>
					Download it instead
				</a>
			{/if}
		</div>
	{:else}
		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={togglePlay}
				disabled={!playerReady}
				aria-label={playing ? 'Pause tab' : 'Play tab'}
				class="focus-live flex h-11 w-11 items-center justify-center rounded-full bg-accent-500 text-white shadow-sm hover:bg-accent-600 disabled:opacity-50"
			>
				{#if playing}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<rect x="6" y="4" width="4" height="16" rx="1" />
						<rect x="14" y="4" width="4" height="16" rx="1" />
					</svg>
				{:else}
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path
							d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"
						/>
					</svg>
				{/if}
			</button>
			<span
				data-testid="tab-time"
				class="text-sm text-surface-600 tabular-nums dark:text-surface-300"
			>
				{formatDuration(Math.floor(currentMs / 1000))} / {formatDuration(Math.floor(endMs / 1000))}
			</span>

			<label class="sr-only" for="tab-speed">Tab speed</label>
			<select id="tab-speed" value={speed} onchange={setSpeed} class={selectClass}>
				{#each SPEEDS as option (option)}
					<option value={option}>{Math.round(option * 100)}%</option>
				{/each}
			</select>
			<button
				type="button"
				onclick={toggleLoop}
				aria-pressed={looping}
				class={toggleClass(looping)}
			>
				Loop
			</button>
			<button
				type="button"
				onclick={() => (moreOpen = !moreOpen)}
				aria-expanded={moreOpen}
				class="{toggleClass(moreOpen)} md:hidden"
			>
				More
			</button>
			<div
				class="{moreOpen ? 'flex' : 'hidden'} w-full flex-wrap items-center gap-2 md:flex md:w-auto"
			>
				{#if trackNames.length > 1}
					<label class="sr-only" for="tab-track">Track</label>
					<select id="tab-track" value={activeTrack} onchange={selectTrack} class={selectClass}>
						{#each trackNames as name, i (i)}
							<option value={i}>{name}</option>
						{/each}
					</select>
					<button
						type="button"
						onclick={toggleSolo}
						aria-pressed={soloed.includes(activeTrack)}
						class={toggleClass(soloed.includes(activeTrack))}
					>
						Solo
					</button>
					<button
						type="button"
						onclick={toggleMute}
						aria-pressed={muted.includes(activeTrack)}
						class={toggleClass(muted.includes(activeTrack))}
					>
						Mute
					</button>
				{/if}

				<button
					type="button"
					onclick={toggleCountIn}
					aria-pressed={countIn}
					class={toggleClass(countIn)}
				>
					Count-in
				</button>
				<button
					type="button"
					onclick={toggleClick}
					aria-pressed={clickOn}
					class={toggleClass(clickOn)}
				>
					Click
				</button>
				<button
					type="button"
					onclick={toggleNotation}
					aria-pressed={showNotation}
					class={toggleClass(showNotation)}
				>
					Notation
				</button>
			</div>
		</div>
		<p class="mt-1 hidden text-xs text-surface-500 md:block dark:text-surface-300">
			Drag across the tab to choose a section, then Loop to repeat it.
		</p>

		<div
			bind:this={viewport}
			class="tab-viewport relative mt-2 h-[58dvh] overflow-auto rounded-xl border border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-900"
		>
			{#if status === 'loading'}
				<div
					class="absolute inset-3 animate-pulse rounded bg-surface-100 motion-reduce:animate-none dark:bg-surface-800"
					aria-hidden="true"
				></div>
			{/if}
			<div bind:this={sheet}></div>
		</div>
	{/if}
</section>

<style>
	/* alphaTab's own elements. The beat cursor and the notes it's playing are live, so
	   they get the Limelight; a selection is just something you chose, so it's copper. */
	.tab-player {
		--tab-live: var(--color-neon-600);
	}
	:global(.dark) .tab-player {
		--tab-live: var(--color-neon-400);
	}
	.tab-player :global(.at-cursor-bar) {
		background: color-mix(in srgb, var(--tab-live) 10%, transparent);
	}
	.tab-player :global(.at-cursor-beat) {
		background: var(--tab-live);
		width: 3px;
	}
	.tab-player :global(.at-selection div) {
		background: color-mix(in srgb, var(--color-accent-hot) 25%, transparent);
	}
	.tab-player :global(.at-highlight *) {
		fill: var(--tab-live);
		stroke: var(--tab-live);
	}
</style>
