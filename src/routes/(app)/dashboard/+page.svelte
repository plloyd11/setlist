<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import DemoRow from '#lib/components/dashboard/DemoRow.svelte';
	import FirstRunBoard from '#lib/components/dashboard/FirstRunBoard.svelte';
	import GigPrepPanel from '#lib/components/dashboard/GigPrepPanel.svelte';
	import NextGigBoard from '#lib/components/dashboard/NextGigBoard.svelte';
	import SetRow from '#lib/components/dashboard/SetRow.svelte';
	import { DASHBOARD_DATA, joinDetails } from '#lib/components/dashboard/shared.js';
	import WeekStrip from '#lib/components/practice/WeekStrip.svelte';
	import {
		panel,
		panelRows,
		rowLink,
		secondaryButton,
		sectionHeading
	} from '#lib/components/practice/practiceStyles.js';
	import { formatRunTime } from '#lib/utils/duration.js';
	import { TIME_ZONE_COOKIE, formatGigDate } from '#lib/utils/gigDate.js';

	let { data } = $props();

	onMount(() => {
		// Tell the server which day it is here. Without this, tonight's gig drops off the
		// board once UTC reaches tomorrow, which on a US evening is before the first song.
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (zone && zone !== data.timeZone) {
			document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)};path=/;max-age=31536000;SameSite=Lax`;
			invalidate(DASHBOARD_DATA);
		}
	});

	let bandNames = $derived(new Map(data.bands.map((band) => [band.id, band.name])));
	const bandNameOf = (set: { band_id: string | null }) =>
		set.band_id ? (bandNames.get(set.band_id) ?? null) : null;

	// During first run the activation board owns the page: nothing competes with it
	let firstRun = $derived(!data.hero);
	let showPractice = $derived(!firstRun || data.week.length > 0 || data.prep.songs.length > 0);
	let hasOtherSets = $derived(data.comingUp.length > 0 || data.recent.length > 0);

	const textLink =
		'hit-44 focus-live rounded text-sm font-medium text-accent-600 hover:underline dark:text-accent-300';
	const rowList =
		'mt-2 divide-y divide-surface-200 border-y border-surface-200 dark:divide-surface-800 dark:border-surface-800';
</script>

<svelte:head>
	<title>Home · Setlist</title>
</svelte:head>

{#snippet setsHead(title: string, withActions: boolean)}
	<div class="flex items-baseline justify-between gap-4">
		<h2 class={sectionHeading}>{title}</h2>
		{#if withActions}
			<div class="flex shrink-0 items-baseline gap-4">
				<a href="/setlists?new" class={textLink}>New setlist</a>
				<a href="/setlists" class={textLink}>All setlists</a>
			</div>
		{/if}
	</div>
{/snippet}

<!-- Practice's skeleton: the work on the left, a 20rem rail on the right, one column on a
     phone. Getting ready comes straight after the board there, so it's first in the source
     and placed into the rail from lg up. -->
<div class="page-frame">
	{#if data.hero}
		<NextGigBoard
			set={data.hero}
			isUpcoming={data.heroIsUpcoming}
			bandName={bandNameOf(data.hero)}
			today={data.today}
		/>
	{:else}
		<FirstRunBoard songCount={data.songCount} librarySeconds={data.librarySeconds} />
	{/if}

	<div
		class="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:items-start"
	>
		{#if showPractice}
			<div class="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1">
				<GigPrepPanel prep={data.prep} />
				<WeekStrip sessions={data.week} quiet />
			</div>
		{/if}

		<div class="flex min-w-0 flex-col gap-8 lg:col-start-1 lg:row-span-2 lg:row-start-1">
			{#if data.comingUp.length > 0}
				<section>
					{@render setsHead('Coming up', true)}
					<ul class={rowList}>
						{#each data.comingUp as set (set.id)}
							<li>
								<SetRow {set} bandName={bandNameOf(set)} today={data.today} dateFirst />
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if data.recent.length > 0}
				<section>
					{@render setsHead('Recent setlists', data.comingUp.length === 0)}
					<ul class={rowList}>
						{#each data.recent as set (set.id)}
							<li><SetRow {set} bandName={bandNameOf(set)} today={data.today} /></li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if data.hero && !hasOtherSets}
				<section>
					{@render setsHead('Setlists', true)}
					<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
						That's your only set so far. Got another gig coming up?
					</p>
				</section>
			{/if}

			{#if data.demos.length > 0}
				<section>
					<div class="flex items-baseline justify-between gap-4">
						<h2 class={sectionHeading}>Demos</h2>
						{#if data.bands.length === 1}
							<a href="/bands/{data.bands[0].id}/demos" class={textLink}>All demos</a>
						{/if}
					</div>
					<ul class={rowList}>
						{#each data.demos as demo (demo.key)}
							<li><DemoRow {demo} showBand={data.bands.length > 1} /></li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>

		{#if data.hero || data.bands.length > 0}
			<div class="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-2">
				{#if data.bands.length > 0}
					<section>
						<h2 class={sectionHeading}>Bands</h2>
						<ul class="mt-2 {panel} {panelRows} overflow-hidden">
							{#each data.bands as band (band.id)}
								<li>
									<a href="/bands/{band.id}" class={rowLink}>
										<span class="min-w-0 flex-1">
											<span
												class="block truncate text-sm font-medium text-surface-900 dark:text-surface-100"
											>
												{band.name}
											</span>
											<span class="block truncate text-xs text-surface-500 dark:text-surface-300">
												{joinDetails([
													`${band.memberCount} ${band.memberCount === 1 ? 'member' : 'members'}`,
													band.nextGigDate
														? `Next gig ${formatGigDate(band.nextGigDate)}`
														: 'No gig booked'
												])}
											</span>
										</span>
									</a>
								</li>
							{/each}
						</ul>
					</section>
				{:else}
					<section class="{panel} p-4">
						<h2 class={sectionHeading}>Play with other people?</h2>
						<p class="mt-1 text-sm text-surface-500 dark:text-surface-300">
							Start a band and everyone works from the same songs, sets and demos.
						</p>
						<a href="/bands" class="{secondaryButton} mt-3 inline-flex items-center">
							Start a band
						</a>
					</section>
				{/if}

				{#if data.hero}
					<!-- Library pulse: one quiet reading, and the way to add to it -->
					<section aria-label="Your library" class="flex items-center justify-between gap-3">
						<a
							href="/songs"
							class="hit-44 focus-live min-w-0 rounded text-sm text-surface-500 hover:underline dark:text-surface-300"
						>
							<span class="font-display font-semibold text-surface-900 dark:text-surface-100">
								{data.songCount}
								{data.songCount === 1 ? 'song' : 'songs'}
							</span>
							{#if data.songCount > 0}· {formatRunTime(data.librarySeconds)}{/if}
						</a>
						<a href="/songs/new" class="{secondaryButton} inline-flex shrink-0 items-center">
							Add song
						</a>
					</section>
				{/if}
			</div>
		{/if}
	</div>
</div>
