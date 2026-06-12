<script lang="ts">
	// Deterministic peaks for the demos waveform illustration: quiet intro, loud chorus, fade out
	const wavePeaks = Array.from({ length: 104 }, (_, i) => {
		const t = i / 103;
		const envelope = t < 0.65 ? 25 + 75 * (t / 0.65) : 100 - 90 * ((t - 0.65) / 0.35);
		const wiggle = 0.55 + 0.45 * Math.abs(Math.sin(i * 1.7) + 0.4 * Math.sin(i * 0.43));
		return Math.min(95, Math.max(8, envelope * wiggle * 0.85));
	});
	// Illustration state: playhead sits ~41% in, the comment pin lands in the chorus
	const playedBars = 43;
	const commentBar = 74;
	// Practice illustration: the armed loop brackets the solo
	const loopStartBar = 42;
	const loopEndBar = 72;
</script>

<svelte:head>
	<title>Help — Setlist</title>
</svelte:head>

<div class="mx-auto max-w-2xl p-6 md:p-8">
	<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100">Help</h1>
	<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
		Everything you need to get from first song to first gig.
	</p>

	<div class="mt-8 space-y-8">
		<!-- Quick start -->
		<section>
			<h2
				class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-300"
			>
				Quick start
			</h2>
			<div
				class="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
			>
				<ol>
					<li class="flex gap-3">
						<div class="flex flex-col items-center self-stretch">
							<span
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent-300 font-display text-[13px] leading-none text-accent-600 dark:border-accent-700 dark:text-accent-300"
								>1</span
							>
							<span class="w-px flex-1 bg-surface-200 dark:bg-surface-700" aria-hidden="true"
							></span>
						</div>
						<span class="pb-5">
							Add a few <a
								href="/songs"
								class="focus-live rounded font-medium text-accent-600 hover:underline dark:text-accent-300"
								>songs</a
							> — just a name and a length.
						</span>
					</li>
					<li class="flex gap-3">
						<div class="flex flex-col items-center self-stretch">
							<span
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent-300 font-display text-[13px] leading-none text-accent-600 dark:border-accent-700 dark:text-accent-300"
								>2</span
							>
							<span class="w-px flex-1 bg-surface-200 dark:bg-surface-700" aria-hidden="true"
							></span>
						</div>
						<span class="pb-5">
							Build a <a
								href="/setlists"
								class="focus-live rounded font-medium text-accent-600 hover:underline dark:text-accent-300"
								>setlist</a
							> — drag songs in, set a target time, watch the clock.
						</span>
					</li>
					<li class="flex gap-3">
						<div class="flex flex-col items-center self-stretch">
							<span
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent-300 font-display text-[13px] leading-none text-accent-600 dark:border-accent-700 dark:text-accent-300"
								>3</span
							>
							<span class="w-px flex-1 bg-surface-200 dark:bg-surface-700" aria-hidden="true"
							></span>
						</div>
						<span class="pb-5">Share it — one link, no accounts, always current.</span>
					</li>
					<li class="flex gap-3">
						<div class="flex flex-col items-center self-stretch">
							<span
								class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-accent-300 font-display text-[13px] leading-none text-accent-600 dark:border-accent-700 dark:text-accent-300"
								>4</span
							>
						</div>
						<span>Rehearse it — run the set top to bottom before you hit the stage.</span>
					</li>
				</ol>
			</div>
		</section>

		<!-- Songs -->
		<section>
			<h2
				class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-300"
			>
				Songs
			</h2>
			<div
				class="mt-3 space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
			>
				<p>
					A song is a name and a length — that's all a set needs to keep time. Build yours in
					<a
						href="/songs"
						class="focus-live rounded font-medium text-accent-600 hover:underline dark:text-accent-300"
						>your library</a
					>.
				</p>
				<p>
					Attach rehearsal audio as variants — "Full mix", "No guitar" — so everyone plays along
					against the mix they need. Charts and tabs (PDF, Word, Guitar Pro) live on the song too.
				</p>
				<p>
					Open a song and hit <span class="font-medium text-surface-700 dark:text-surface-200"
						>Practice</span
					> to play a recording with the chart on screen.
				</p>
				<figure class="rounded-lg bg-surface-100/70 p-3 dark:bg-surface-950/40">
					<div
						aria-hidden="true"
						class="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 dark:border-surface-700 dark:bg-surface-800"
					>
						<div class="flex items-baseline gap-2">
							<span class="text-xs font-medium text-surface-900 dark:text-surface-100"
								>Midnight Drive</span
							>
							<span class="ml-auto text-[11px] text-surface-500 tabular-nums dark:text-surface-300"
								>3:42</span
							>
						</div>
						<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
							<span
								class="inline-flex items-center gap-1 rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-medium text-accent-700 dark:bg-accent-900/40 dark:text-accent-300"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="10"
									height="10"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M9 18V5l12-2v13" />
									<circle cx="6" cy="18" r="3" />
									<circle cx="18" cy="16" r="3" />
								</svg>
								Full mix
							</span>
							<span
								class="inline-flex items-center gap-1 rounded-full bg-accent-50 px-1.5 py-0.5 text-[10px] font-medium text-accent-700 dark:bg-accent-900/40 dark:text-accent-300"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="10"
									height="10"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M9 18V5l12-2v13" />
									<circle cx="6" cy="18" r="3" />
									<circle cx="18" cy="16" r="3" />
								</svg>
								No guitar
							</span>
							<span
								class="inline-flex items-center gap-1 rounded-full bg-surface-100 px-1.5 py-0.5 text-[10px] font-medium text-surface-600 dark:bg-surface-700/60 dark:text-surface-200"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="10"
									height="10"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
									<path d="M14 2v6h6" />
								</svg>
								chords.pdf
							</span>
							<span class="ml-auto text-[11px] font-medium text-accent-600 dark:text-accent-300"
								>▸ Practice</span
							>
						</div>
					</div>
					<figcaption class="mt-2 text-[11px] text-surface-500 dark:text-surface-300">
						One song, two rehearsal mixes, and the chart along for the ride.
					</figcaption>
				</figure>
			</div>
		</section>

		<!-- Practice -->
		<section>
			<h2
				class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-300"
			>
				Practice
			</h2>
			<div
				class="mt-3 space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
			>
				<p>
					Practice is where you shed: the recording up top, DAW-style controls under it, the chart
					along for the ride.
				</p>
				<p>
					Drag across the waveform to highlight the hard part and hit
					<span class="font-medium text-surface-700 dark:text-surface-200">Loop</span> — it cycles
					until you've got it.
					<span class="font-medium text-surface-700 dark:text-surface-200">Pre-roll 2s</span> backs up
					before every pass, so your hands are ready when the section lands.
				</p>
				<p>
					The <span class="font-medium text-surface-700 dark:text-surface-200">Speed</span> knob slows
					the track to half speed without dropping the pitch. Save the loop as a named section — "solo",
					"bridge" — and it's waiting next session. Knobs, loop, and sections are all remembered per song.
				</p>
				<figure class="rounded-lg bg-surface-100/70 p-3 dark:bg-surface-950/40">
					<div aria-hidden="true">
						<div class="relative">
							<div class="flex h-10 items-center justify-between">
								{#each wavePeaks as peak, i (i)}
									<span
										class="w-[2px] flex-none rounded-full {i >= loopStartBar && i <= loopEndBar
											? 'bg-accent-500 dark:bg-accent-400'
											: 'bg-surface-300 dark:bg-surface-600'}"
										style="height: {peak}%"
									></span>
								{/each}
							</div>
							<span
								class="absolute inset-y-0 rounded border-x border-neon-600/60 bg-neon-600/15 dark:border-neon-400/60 dark:bg-neon-400/15"
								style="left: {(loopStartBar / wavePeaks.length) * 100}%; width: {((loopEndBar -
									loopStartBar +
									1) /
									wavePeaks.length) *
									100}%"
							></span>
						</div>
						<div class="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
							<span class="flex items-center gap-1.5">
								<span
									class="relative h-6 w-6 rounded-full border border-surface-400 bg-surface-800 dark:border-surface-600 dark:bg-surface-900"
								>
									<span class="absolute inset-0" style="transform: rotate(95deg)">
										<span
											class="absolute top-0.5 left-1/2 h-2 w-0.5 -translate-x-1/2 rounded-full bg-accent-400"
										></span>
									</span>
								</span>
								<span
									class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
									>Vol</span
								>
							</span>
							<span class="flex items-center gap-1.5">
								<span
									class="relative h-6 w-6 rounded-full border border-surface-400 bg-surface-800 dark:border-surface-600 dark:bg-surface-900"
								>
									<span class="absolute inset-0" style="transform: rotate(28deg)">
										<span
											class="absolute top-0.5 left-1/2 h-2 w-0.5 -translate-x-1/2 rounded-full bg-accent-400"
										></span>
									</span>
								</span>
								<span
									class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
									>Speed 70%</span
								>
							</span>
							<span
								class="inline-flex items-center gap-1 rounded-md bg-accent-500 px-1.5 py-0.5 text-[10px] font-medium text-white"
							>
								<svg
									width="9"
									height="9"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<path d="m17 2 4 4-4 4" />
									<path d="M3 11v-1a4 4 0 0 1 4-4h14" />
									<path d="m7 22-4-4 4-4" />
									<path d="M21 13v1a4 4 0 0 1-4 4H3" />
								</svg>
								Loop 1:12–1:38
							</span>
							<span
								class="inline-flex items-center rounded-md border border-surface-300 px-1.5 py-0.5 text-[10px] font-medium text-surface-600 dark:border-surface-600 dark:text-surface-300"
							>
								Pre-roll 2s
							</span>
						</div>
					</div>
					<figcaption class="mt-2 text-[11px] text-surface-500 dark:text-surface-300">
						Chartreuse brackets mean the loop is live — playback is trapped inside them.
					</figcaption>
				</figure>
				<p
					class="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-surface-500 dark:text-surface-300"
				>
					<span class="flex items-center gap-1">
						<kbd
							class="rounded border border-surface-300 bg-surface-100 px-1 py-px text-[10px] font-medium text-surface-600 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-300"
							>Space</kbd
						> play
					</span>
					<span class="flex items-center gap-1">
						<kbd
							class="rounded border border-surface-300 bg-surface-100 px-1 py-px text-[10px] font-medium text-surface-600 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-300"
							>L</kbd
						> loop
					</span>
					<span class="flex items-center gap-1">
						<kbd
							class="rounded border border-surface-300 bg-surface-100 px-1 py-px text-[10px] font-medium text-surface-600 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-300"
							>[</kbd
						>
						<kbd
							class="rounded border border-surface-300 bg-surface-100 px-1 py-px text-[10px] font-medium text-surface-600 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-300"
							>]</kbd
						> loop points
					</span>
					<span class="flex items-center gap-1">
						<kbd
							class="rounded border border-surface-300 bg-surface-100 px-1 py-px text-[10px] font-medium text-surface-600 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-300"
							>←</kbd
						>
						<kbd
							class="rounded border border-surface-300 bg-surface-100 px-1 py-px text-[10px] font-medium text-surface-600 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-300"
							>→</kbd
						> skip 5s
					</span>
				</p>
			</div>
		</section>

		<!-- Setlists -->
		<section>
			<h2
				class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-300"
			>
				Setlists
			</h2>
			<div
				class="mt-3 space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
			>
				<p>
					Start a <a
						href="/setlists"
						class="focus-live rounded font-medium text-accent-600 hover:underline dark:text-accent-300"
						>new setlist</a
					> and give it a name, a venue, and a gig date.
				</p>
				<p>
					Drag songs in from the library panel; drag rows to reorder. Add gaps for the in-between —
					tuning, banter, the encore walk-off. Gaps are labeled, timed, and count toward the total.
				</p>
				<p>
					Set a target time and the timing bar keeps score:
					<span class="font-medium text-surface-700 dark:text-surface-200">Total</span>,
					<span class="font-medium text-surface-700 dark:text-surface-200">Target</span>, and the
					<span class="font-medium text-surface-700 dark:text-surface-200">Diff</span> — olive when the
					set fits, red when you're over.
				</p>
				<figure class="rounded-lg bg-surface-100/70 p-3 dark:bg-surface-950/40">
					<div aria-hidden="true">
						<div class="space-y-1.5">
							<div
								class="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 dark:border-surface-700 dark:bg-surface-800"
							>
								<svg
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="text-surface-400 dark:text-surface-300"
								>
									<circle cx="9" cy="5" r="1.5" />
									<circle cx="15" cy="5" r="1.5" />
									<circle cx="9" cy="12" r="1.5" />
									<circle cx="15" cy="12" r="1.5" />
									<circle cx="9" cy="19" r="1.5" />
									<circle cx="15" cy="19" r="1.5" />
								</svg>
								<span class="w-3 text-right text-[10px] text-surface-400 tabular-nums">1</span>
								<span
									class="flex-1 truncate text-xs font-medium text-surface-900 dark:text-surface-100"
									>Midnight Drive</span
								>
								<span class="text-[11px] text-surface-500 tabular-nums dark:text-surface-300"
									>3:42</span
								>
							</div>
							<div
								class="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 dark:border-surface-700 dark:bg-surface-800"
							>
								<svg
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="text-surface-400 dark:text-surface-300"
								>
									<circle cx="9" cy="5" r="1.5" />
									<circle cx="15" cy="5" r="1.5" />
									<circle cx="9" cy="12" r="1.5" />
									<circle cx="15" cy="12" r="1.5" />
									<circle cx="9" cy="19" r="1.5" />
									<circle cx="15" cy="19" r="1.5" />
								</svg>
								<span class="w-3 text-right text-[10px] text-surface-400 tabular-nums">2</span>
								<span
									class="flex-1 truncate text-xs font-medium text-surface-900 dark:text-surface-100"
									>Gasoline Heart</span
								>
								<span class="text-[11px] text-surface-500 tabular-nums dark:text-surface-300"
									>4:05</span
								>
							</div>
							<div
								class="flex items-center gap-2 rounded-lg border border-dashed border-surface-300 bg-surface-100/60 px-2.5 py-1.5 dark:border-surface-600 dark:bg-surface-900/60"
							>
								<span class="w-3"></span>
								<span class="w-3"></span>
								<span class="flex-1 truncate text-xs text-surface-500 italic dark:text-surface-300"
									>Tuning + banter</span
								>
								<span class="text-[11px] text-surface-500 tabular-nums dark:text-surface-300"
									>1:30</span
								>
							</div>
							<div
								class="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 shadow-glow-neon ring-2 ring-neon-600 dark:border-surface-700 dark:bg-surface-800 dark:ring-neon-400"
							>
								<svg
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="currentColor"
									class="text-surface-400 dark:text-surface-300"
								>
									<circle cx="9" cy="5" r="1.5" />
									<circle cx="15" cy="5" r="1.5" />
									<circle cx="9" cy="12" r="1.5" />
									<circle cx="15" cy="12" r="1.5" />
									<circle cx="9" cy="19" r="1.5" />
									<circle cx="15" cy="19" r="1.5" />
								</svg>
								<span class="w-3 text-right text-[10px] text-surface-400 tabular-nums">3</span>
								<span
									class="flex-1 truncate text-xs font-medium text-surface-900 dark:text-surface-100"
									>Last Call</span
								>
								<span class="text-[11px] text-surface-500 tabular-nums dark:text-surface-300"
									>3:58</span
								>
							</div>
						</div>
						<div
							class="mt-3 flex items-center gap-4 border-t border-surface-200 pt-2.5 dark:border-surface-800"
						>
							<div>
								<p
									class="text-[9px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
								>
									Total
								</p>
								<p class="font-display text-sm font-bold text-accent-600 dark:text-accent-hot">
									13:15
								</p>
							</div>
							<div>
								<p
									class="text-[9px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
								>
									Target
								</p>
								<p class="text-xs text-surface-700 tabular-nums dark:text-surface-300">14:00</p>
							</div>
							<div>
								<p
									class="text-[9px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
								>
									Diff
								</p>
								<p class="text-xs font-bold text-success-600 tabular-nums dark:text-success-300">
									-0:45
								</p>
							</div>
							<div class="flex-1">
								<div class="h-1.5 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700">
									<div class="h-full w-[94%] rounded-full bg-success-600 dark:bg-success-400"></div>
								</div>
							</div>
						</div>
					</div>
					<figcaption class="mt-2 text-[11px] text-surface-500 dark:text-surface-300">
						A row mid-drag wears the chartreuse ring; the bar below keeps score. Olive means the set
						fits.
					</figcaption>
				</figure>
			</div>
		</section>

		<!-- Sharing & printing -->
		<section>
			<h2
				class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-300"
			>
				Sharing &amp; printing
			</h2>
			<div
				class="mt-3 space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
			>
				<p>
					Flip sharing on and your setlist gets a public link. Anyone who has it sees the current
					set — always up to date, no account needed.
				</p>
				<p>The shared page prints clean, ready to tape to the stage floor.</p>
				<figure class="rounded-lg bg-surface-100/70 p-3 dark:bg-surface-950/40">
					<div aria-hidden="true" class="flex items-center gap-2.5">
						<span class="h-2 w-2 shrink-0 rounded-full bg-accent-hot shadow-glow-accent"></span>
						<span class="text-xs font-medium text-surface-700 dark:text-surface-200"
							>Sharing on</span
						>
						<span class="truncate text-[11px] text-surface-500 dark:text-surface-300"
							>/share/k2f9x3a1</span
						>
					</div>
					<figcaption class="mt-2 text-[11px] text-surface-500 dark:text-surface-300">
						When the copper lamp is lit, the link is live.
					</figcaption>
				</figure>
			</div>
		</section>

		<!-- Rehearse mode -->
		<section>
			<h2
				class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-300"
			>
				Rehearse mode
			</h2>
			<div
				class="mt-3 space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
			>
				<p>
					From a setlist, hit <span class="font-medium text-surface-700 dark:text-surface-200"
						>Rehearse</span
					> to run the whole set like the gig: each song's audio in order, with a countdown through every
					gap. Pick which variant plays per song — Setlist remembers your choice.
				</p>
				<figure class="rounded-lg bg-surface-100/70 p-3 dark:bg-surface-950/40">
					<div aria-hidden="true" class="space-y-1.5">
						<div
							class="flex items-center gap-2 rounded-lg border border-surface-200 bg-surface-50 px-2.5 py-1.5 dark:border-surface-700 dark:bg-surface-800"
						>
							<span
								class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white"
							>
								<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor">
									<path d="M8 5v14l11-7z" />
								</svg>
							</span>
							<span
								class="flex-1 truncate text-xs font-medium text-surface-900 dark:text-surface-100"
								>Gasoline Heart</span
							>
							<span class="w-20">
								<span
									class="block h-1 overflow-hidden rounded-full bg-surface-200 dark:bg-surface-700"
								>
									<span class="block h-full w-[60%] rounded-full bg-accent-500 dark:bg-accent-400"
									></span>
								</span>
							</span>
							<span class="text-[11px] text-surface-500 tabular-nums dark:text-surface-300"
								>-1:38</span
							>
						</div>
						<div
							class="flex items-center gap-2 rounded-lg border border-dashed border-surface-300 bg-surface-100/60 px-2.5 py-1.5 dark:border-surface-600 dark:bg-surface-900/60"
						>
							<span class="w-5"></span>
							<span class="flex-1 truncate text-xs text-surface-500 italic dark:text-surface-300"
								>Gap · tuning</span
							>
							<span
								class="text-[11px] font-medium text-surface-600 tabular-nums dark:text-surface-200"
								>0:30</span
							>
						</div>
						<div class="flex items-center gap-2 px-2.5 py-1 opacity-60">
							<span class="w-5"></span>
							<span class="flex-1 truncate text-xs text-surface-600 dark:text-surface-300"
								>Up next · Last Call</span
							>
							<span class="text-[11px] text-surface-500 tabular-nums dark:text-surface-300"
								>3:58</span
							>
						</div>
					</div>
					<figcaption class="mt-2 text-[11px] text-surface-500 dark:text-surface-300">
						The set runs itself: audio plays, the gap counts down, the next song is queued.
					</figcaption>
				</figure>
			</div>
		</section>

		<!-- Bands -->
		<section>
			<h2
				class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-300"
			>
				Bands
			</h2>
			<div
				class="mt-3 space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
			>
				<p>
					Create a band from <a
						href="/bands"
						class="focus-live rounded font-medium text-accent-600 hover:underline dark:text-accent-300"
						>Bands</a
					> and send the invite link — anyone who opens it joins.
				</p>
				<p>
					Members share a song library and band setlists, so the whole crew works off the same set.
				</p>
				<div class="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
					<p>
						<span class="font-medium text-surface-700 dark:text-surface-200">Good to know:</span>
						songs you share with a band are referenced, not copied — fix a duration in your library and
						every band set updates with it.
					</p>
				</div>
			</div>
		</section>

		<!-- Demos -->
		<section>
			<h2
				class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-300"
			>
				Demos
			</h2>
			<div
				class="mt-3 space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
			>
				<p>
					Every band gets a Demos workspace for works in progress. Upload a take, stack new versions
					on the same demo as it evolves, and keep it all sorted in folders.
				</p>
				<p>
					Click anywhere on the waveform to leave a comment pinned to that exact moment — "chorus
					drags here" lands at 1:42, not in a text thread.
				</p>
				<figure class="rounded-lg bg-surface-100/70 p-3 dark:bg-surface-950/40">
					<div aria-hidden="true">
						<div class="relative pb-2">
							<div class="flex h-10 items-center justify-between">
								{#each wavePeaks as peak, i (i)}
									<span
										class="w-[2px] flex-none rounded-full {i < playedBars
											? 'bg-accent-500 dark:bg-accent-400'
											: 'bg-surface-300 dark:bg-surface-600'}"
										style="height: {peak}%"
									></span>
								{/each}
							</div>
							<span
								class="absolute top-0 bottom-2 w-px bg-neon-600 dark:bg-neon-400"
								style="left: {(playedBars / wavePeaks.length) * 100}%"
							></span>
							<span
								class="absolute bottom-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-accent-500 ring-2 ring-surface-100 dark:bg-accent-400 dark:ring-surface-900"
								style="left: {((commentBar + 0.5) / wavePeaks.length) * 100}%"
							></span>
						</div>
						<div class="mt-2 flex items-baseline gap-1.5">
							<span
								class="text-[11px] font-medium text-accent-600 tabular-nums dark:text-accent-300"
								>1:42</span
							>
							<span class="text-[11px] text-surface-600 dark:text-surface-300"
								>"chorus drags here"</span
							>
						</div>
					</div>
					<figcaption class="mt-2 text-[11px] text-surface-500 dark:text-surface-300">
						Comments pin to the waveform at the exact moment they're about.
					</figcaption>
				</figure>
			</div>
		</section>

		<!-- Settings -->
		<section>
			<h2
				class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-300"
			>
				Settings
			</h2>
			<div
				class="mt-3 space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
			>
				<p>
					Set a display name (it appears on your shared setlists), upload a logo, and flip dark mode
					in
					<a
						href="/settings"
						class="focus-live rounded font-medium text-accent-600 hover:underline dark:text-accent-300"
						>Settings</a
					>.
				</p>
			</div>
		</section>
	</div>
</div>
