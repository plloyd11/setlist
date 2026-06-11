<script lang="ts">
	import TrackCard from '$lib/components/tracks/TrackCard.svelte';
	import { formatDuration } from '$lib/utils/duration';

	let { data } = $props();

	function parseGigDate(d: string): Date {
		const [y, m, day] = d.split('-').map(Number);
		return new Date(y, m - 1, day);
	}

	function daysUntil(gigDate: string): number {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		return Math.round((parseGigDate(gigDate).getTime() - today.getTime()) / 86_400_000);
	}

	function countdownLabel(gigDate: string): string {
		const days = daysUntil(gigDate);
		if (days <= 0) return 'Tonight';
		if (days === 1) return 'Tomorrow';
		return `In ${days} days`;
	}

	function gigDateLabel(gigDate: string): string {
		return parseGigDate(gigDate).toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	function formatLibrary(seconds: number): string {
		const h = Math.floor(seconds / 3600);
		const m = Math.round((seconds % 3600) / 60);
		return h > 0 ? `${h}h ${m}m` : `${m}m`;
	}

	function setlistHref(s: { id: string; band_id: string | null }): string {
		return s.band_id ? `/bands/${s.band_id}/setlists/${s.id}` : `/setlists/${s.id}`;
	}

	let bandNames = $derived(new Map(data.bands.map((b) => [b.id, b.name])));
	let hero = $derived(data.hero);
	let heroDiff = $derived(hero?.target_seconds ? hero.totalSeconds - hero.target_seconds : null);
</script>

<!-- One step in the first-run signal chain: a lamp reports its state -->
{#snippet chainStep(state: 'done' | 'live' | 'next', label: string, sub: string)}
	<li class="flex items-start gap-2.5">
		{#if state === 'done'}
			<span class="mt-[3px] h-2 w-2 shrink-0 rounded-full bg-accent-500 dark:bg-accent-400"></span>
		{:else if state === 'live'}
			<span class="lamp-live mt-[3px] h-2 w-2 shrink-0 rounded-full bg-neon-600 dark:bg-neon-400"
			></span>
		{:else}
			<span
				class="mt-[3px] h-2 w-2 shrink-0 rounded-full border border-surface-300 dark:border-surface-600"
			></span>
		{/if}
		<div class="min-w-0">
			<p
				class="text-[10px] font-medium tracking-wider uppercase {state === 'next'
					? 'text-surface-500 dark:text-surface-300'
					: 'text-surface-900 dark:text-surface-100'}"
			>
				<span class="sr-only">
					{state === 'done' ? 'Done: ' : state === 'live' ? 'Current step: ' : 'Coming up: '}
				</span>
				{label}
			</p>
			<p class="mt-0.5 text-xs text-surface-500 dark:text-surface-300">{sub}</p>
		</div>
	</li>
{/snippet}

<div class="p-6 md:p-8">
	{#if hero}
		<!-- The Next Gig Board: the page's one chromatic peak -->
		<a
			href={setlistHref(hero)}
			class="board-enter focus-live block rounded-xl border border-surface-200 bg-surface-50 p-6 transition-colors hover:border-surface-300 md:p-8 dark:border-surface-800 dark:bg-surface-900 dark:hover:border-surface-700"
		>
			<div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
				<!-- Gig identity -->
				<div class="min-w-0">
					<p
						class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
					>
						{data.heroIsUpcoming ? 'Next gig' : 'Latest set'}
					</p>
					<h1
						class="mt-1 truncate font-display text-3xl text-surface-900 md:text-4xl dark:text-surface-50"
					>
						{hero.name}
					</h1>
					<p class="mt-1 text-sm text-surface-500 dark:text-surface-300">
						{#if hero.venue || hero.gig_date}
							{#if hero.venue}{hero.venue}{/if}
							{#if hero.venue && hero.gig_date}&nbsp;&middot;&nbsp;{/if}
							{#if hero.gig_date}{gigDateLabel(hero.gig_date)}{/if}
						{:else if hero.songCount === 0}
							Empty set. Open it and drag songs in.
						{:else}
							No gig booked yet. Open the set to pick a date.
						{/if}
					</p>
					{#if hero.share_token}
						<span
							class="mt-3 inline-block rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-medium text-accent-800 shadow-glow-accent dark:bg-accent-900/40 dark:text-accent-300"
						>
							Sharing on
						</span>
					{/if}
				</div>

				<!-- Instrument readings -->
				<div class="flex shrink-0 items-center gap-6 md:gap-8">
					{#if data.heroIsUpcoming && hero.gig_date}
						<div class="text-center">
							<p
								class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
							>
								Countdown
							</p>
							<p
								class="font-display text-2xl font-bold text-accent-600 md:text-3xl dark:text-accent-hot"
							>
								{countdownLabel(hero.gig_date)}
							</p>
						</div>
					{/if}
					<div class="text-center">
						<p
							class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
						>
							Total
						</p>
						<p
							class="font-display text-2xl font-bold md:text-3xl {data.heroIsUpcoming
								? 'text-surface-900 dark:text-surface-100'
								: 'text-accent-600 dark:text-accent-hot'}"
						>
							{formatDuration(hero.totalSeconds)}
						</p>
					</div>
					{#if hero.target_seconds}
						<div class="text-center">
							<p
								class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
							>
								Target
							</p>
							<p
								class="font-display text-2xl font-bold text-surface-900 md:text-3xl dark:text-surface-100"
							>
								{formatDuration(hero.target_seconds)}
							</p>
						</div>
						{#if heroDiff !== null && heroDiff !== 0}
							<div class="text-center">
								<p
									class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
								>
									Diff
								</p>
								<p
									class="text-lg font-bold {heroDiff > 0
										? 'text-danger-600 dark:text-danger-300'
										: 'text-success-600 dark:text-success-300'}"
								>
									{heroDiff > 0 ? '+' : '-'}{formatDuration(Math.abs(heroDiff))}
								</p>
							</div>
						{/if}
					{/if}
					<div class="text-center">
						<p
							class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
						>
							Songs
						</p>
						<p
							class="font-display text-2xl font-bold text-surface-900 md:text-3xl dark:text-surface-100"
						>
							{hero.songCount}
						</p>
					</div>
				</div>
			</div>
		</a>
	{:else}
		<!-- First run: the activation moment. Same silhouette as the gig board, not yet powered on -->
		{@const hasSongs = data.songCount > 0}
		<div
			class="board-enter rounded-xl border border-surface-200 bg-surface-50 p-6 md:p-8 dark:border-surface-800 dark:bg-surface-900"
		>
			<div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
				<div class="min-w-0">
					<p
						class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
					>
						Nothing on the board yet
					</p>
					<h1 class="mt-1 font-display text-3xl text-surface-900 md:text-4xl dark:text-surface-50">
						Build your first set
					</h1>
					<p class="mt-1 max-w-md text-sm text-surface-500 dark:text-surface-300">
						{hasSongs
							? 'Your songs are in. Drag them into a set and watch the total close on your gig time.'
							: 'Your next gig will live up here: the set, its running total, the countdown. It starts with songs.'}
					</p>
				</div>

				<!-- Unpowered readings: what the board shows once a set exists -->
				<div class="flex shrink-0 items-center gap-6 md:gap-8" aria-hidden="true">
					<div class="text-center">
						<p
							class="text-[10px] font-medium tracking-wider text-surface-400 uppercase dark:text-surface-500"
						>
							Total
						</p>
						<p
							class="font-display text-2xl font-bold text-surface-300 md:text-3xl dark:text-surface-600"
						>
							--:--
						</p>
					</div>
					<div class="text-center">
						<p
							class="text-[10px] font-medium tracking-wider text-surface-400 uppercase dark:text-surface-500"
						>
							Target
						</p>
						<p
							class="font-display text-2xl font-bold text-surface-300 md:text-3xl dark:text-surface-600"
						>
							--:--
						</p>
					</div>
					<div class="text-center">
						<p
							class="text-[10px] font-medium tracking-wider uppercase {hasSongs
								? 'text-surface-500 dark:text-surface-300'
								: 'text-surface-400 dark:text-surface-500'}"
						>
							Songs
						</p>
						<p
							class="font-display text-2xl font-bold md:text-3xl {hasSongs
								? 'text-surface-900 dark:text-surface-100'
								: 'text-surface-300 dark:text-surface-600'}"
						>
							{data.songCount}
						</p>
					</div>
				</div>
			</div>

			<!-- The signal chain: three moves between here and showtime -->
			<div
				class="mt-6 flex flex-col gap-5 border-t border-surface-200 pt-5 lg:flex-row lg:items-center lg:justify-between dark:border-surface-800"
			>
				<ol class="grid gap-4 sm:grid-cols-3 lg:flex lg:gap-8">
					{@render chainStep(
						hasSongs ? 'done' : 'live',
						'Songs',
						hasSongs
							? `${data.songCount} ${data.songCount === 1 ? 'song' : 'songs'} · ${formatLibrary(data.librarySeconds)} ready`
							: 'A name and a length is all each one needs'
					)}
					{@render chainStep(hasSongs ? 'live' : 'next', 'The set', 'Drag songs in, fit the time')}
					{@render chainStep('next', 'Share', 'One link the whole band can open')}
				</ol>
				<a
					href={hasSongs ? '/setlists?new' : '/songs/new'}
					class="focus-live inline-flex shrink-0 items-center justify-center self-start rounded-lg bg-accent-500 px-5 py-3 text-sm font-semibold text-white shadow-glow-accent transition-colors hover:bg-accent-600 lg:self-auto"
				>
					{hasSongs ? 'Start the set' : 'Add your first song'}
				</a>
			</div>
		</div>
	{/if}

	{#if data.recent.length > 0}
		<section class="mt-10">
			<div class="flex items-baseline justify-between">
				<h2 class="font-display text-lg text-surface-900 dark:text-surface-100">Recent setlists</h2>
				<a
					href="/setlists"
					class="focus-live rounded text-sm font-medium text-accent-600 hover:underline dark:text-accent-300"
				>
					All setlists
				</a>
			</div>
			<ul
				class="mt-3 divide-y divide-surface-200 border-y border-surface-200 dark:divide-surface-800 dark:border-surface-800"
			>
				{#each data.recent as s (s.id)}
					<li>
						<a
							href={setlistHref(s)}
							class="focus-live -mx-2 flex items-center justify-between gap-4 rounded-lg px-2 py-3 transition-colors hover:bg-surface-100 dark:hover:bg-surface-900"
						>
							<div class="min-w-0">
								<p
									class="truncate font-display font-semibold text-surface-900 dark:text-surface-100"
								>
									{s.name}
								</p>
								{#if s.venue || s.gig_date}
									<p class="truncate text-xs text-surface-500 dark:text-surface-300">
										{#if s.venue}{s.venue}{/if}
										{#if s.venue && s.gig_date}&nbsp;&middot;&nbsp;{/if}
										{#if s.gig_date}{gigDateLabel(s.gig_date)}{/if}
									</p>
								{/if}
							</div>
							<div class="flex shrink-0 items-center gap-5 text-right">
								<span class="text-xs text-surface-500 dark:text-surface-300">
									{s.songCount}
									{s.songCount === 1 ? 'song' : 'songs'}
								</span>
								<span
									class="w-14 font-display text-sm font-semibold text-surface-900 dark:text-surface-100"
								>
									{formatDuration(s.totalSeconds)}
								</span>
							</div>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.tracks.length > 0}
		<section class="mt-10">
			<div class="flex items-baseline gap-3">
				<h2 class="font-display text-lg text-surface-900 dark:text-surface-100">Tracks</h2>
				<span class="text-sm text-surface-500 dark:text-surface-300">
					{data.tracks.length}
					{data.tracks.length === 1 ? 'track' : 'tracks'}
				</span>
			</div>
			<div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.tracks as track (track.id)}
					<TrackCard
						{track}
						basePath="/bands/{track.band_id}/tracks"
						bandName={bandNames.get(track.band_id)}
					/>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Library pulse + quick actions. During first run the activation board owns the actions -->
	{#if hero || data.bands.length > 0}
		<section class="mt-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
			<p class="text-sm text-surface-500 dark:text-surface-300">
				<span class="font-display font-semibold text-surface-900 dark:text-surface-100">
					{data.songCount}
					{data.songCount === 1 ? 'song' : 'songs'}
				</span>
				{#if data.songCount > 0}
					&middot; {formatLibrary(data.librarySeconds)} in your library
				{:else}
					in your library
				{/if}
				{#each data.bands as band (band.id)}
					&middot;
					<a
						href="/bands/{band.id}"
						class="focus-live rounded font-medium text-accent-600 hover:underline dark:text-accent-300"
					>
						{band.name}
					</a>
				{/each}
			</p>
			{#if hero}
				<div class="flex gap-3">
					<a
						href="/setlists"
						class="focus-live rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-600"
					>
						New setlist
					</a>
					<a
						href="/songs/new"
						class="focus-live rounded-lg px-4 py-2 text-sm font-medium text-surface-600 transition-colors hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
					>
						Add song
					</a>
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.board-enter {
		animation: board-rise 400ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
	}
	@keyframes board-rise {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.board-enter {
			animation: none;
		}
	}

	/* Powered-On Rule: the current step is live, so its lamp glows */
	.lamp-live {
		box-shadow:
			0 0 6px rgba(187, 201, 42, 0.5),
			0 0 14px rgba(187, 201, 42, 0.2);
		animation: lamp-pulse 2.4s ease-in-out infinite;
	}
	@keyframes lamp-pulse {
		50% {
			box-shadow:
				0 0 3px rgba(187, 201, 42, 0.3),
				0 0 8px rgba(187, 201, 42, 0.1);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.lamp-live {
			animation: none;
		}
	}
</style>
