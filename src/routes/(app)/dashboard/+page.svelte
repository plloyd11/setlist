<script lang="ts">
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

	let hero = $derived(data.hero);
	let heroDiff = $derived(hero?.target_seconds ? hero.totalSeconds - hero.target_seconds : null);
</script>

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
						{#if hero.venue}{hero.venue}{/if}
						{#if hero.venue && hero.gig_date}&nbsp;&middot;&nbsp;{/if}
						{#if hero.gig_date}{gigDateLabel(hero.gig_date)}{/if}
						{#if !hero.venue && !hero.gig_date}No gig booked — open to set a date{/if}
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
		<!-- First run: the board is the activation moment -->
		<div
			class="board-enter rounded-xl border border-surface-200 bg-surface-50 p-8 text-center md:p-12 dark:border-surface-800 dark:bg-surface-900"
		>
			<p
				class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
			>
				No sets yet
			</p>
			<h1 class="mt-2 font-display text-3xl text-surface-900 md:text-4xl dark:text-surface-50">
				Build your first set
			</h1>
			<p class="mx-auto mt-2 max-w-md text-sm text-surface-500 dark:text-surface-300">
				Add songs, drag them into a set, and share it with the band.
			</p>
			<a
				href={data.songCount > 0 ? '/setlists' : '/songs/new'}
				class="focus-live mt-6 inline-flex items-center gap-2 rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-accent transition-colors hover:bg-accent-600"
			>
				{data.songCount > 0 ? 'New setlist' : 'Add your first song'}
			</a>
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

	<!-- Library pulse + quick actions -->
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
	</section>
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
</style>
