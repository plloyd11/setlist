<script lang="ts">
	import { invalidate } from '$app/navigation';
	import SessionStrip from '#lib/components/practice/SessionStrip.svelte';
	import Toast from '#lib/components/ui/Toast.svelte';
	import {
		microLabel,
		panel,
		panelFooter,
		primaryButton,
		secondaryButton
	} from '#lib/components/practice/practiceStyles.js';
	import { formatDuration } from '#lib/utils/duration.js';
	import { formatGigDate, gigCountdown } from '#lib/utils/gigDate.js';
	import { DASHBOARD_DATA, joinDetails, setlistHref, type DashboardSet } from './shared.js';

	let {
		set,
		isUpcoming,
		bandName,
		today
	}: {
		set: DashboardSet;
		/** False when no gig is booked and this is just the latest set */
		isUpcoming: boolean;
		bandName: string | null;
		today: string;
	} = $props();

	/** Slack bigger than this could take another song, so it's worth saying */
	const ROOM_FOR_A_SONG = 240;

	let toast: Toast;
	let sharing = $state(false);
	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	let href = $derived(setlistHref(set));
	let hasSongs = $derived(set.songCount > 0);
	let diff = $derived(set.target_seconds ? set.totalSeconds - set.target_seconds : null);
	let meta = $derived(
		joinDetails([set.venue, set.gig_date && formatGigDate(set.gig_date), bandName])
	);

	const FITS = 'bg-success-600 dark:bg-success-400';
	const OVER = 'bg-danger-600 dark:bg-danger-400';
	const ROOM = 'bg-surface-200 dark:bg-surface-600';

	/** Drawn to scale, so 53 seconds over looks like 53 seconds, not a solid red bar */
	let fit = $derived.by(() => {
		if (!set.target_seconds || !hasSongs) return [];
		const over = set.totalSeconds - set.target_seconds;
		return over > 0
			? [
					{ key: 'target', label: 'Target', seconds: set.target_seconds, tone: FITS },
					{ key: 'over', label: 'Over by', seconds: over, tone: OVER }
				]
			: [
					{ key: 'total', label: 'Total', seconds: set.totalSeconds, tone: FITS },
					{ key: 'room', label: 'Room left', seconds: -over, tone: ROOM }
				].filter((part) => part.seconds > 0);
	});

	/** The reading, in a sentence: what the numbers above mean for this gig */
	let verdict = $derived.by(() => {
		if (!hasSongs) return 'Nothing in this set yet.';
		if (diff === null) return 'No target time yet, so nothing to fit it against.';
		if (diff === 0) return 'Right on the target.';
		const amount = formatDuration(Math.abs(diff));
		if (diff > 0) return `${amount} over. Something has to go.`;
		return -diff > ROOM_FOR_A_SONG
			? `${amount} short. There's room for more.`
			: `Fits, with ${amount} to spare.`;
	});

	async function turnOnSharing() {
		sharing = true;
		try {
			const body = new FormData();
			body.set('share_token', crypto.randomUUID());
			const response = await fetch(`${href}?/toggleShare`, { method: 'POST', body });
			if (!response.ok) throw new Error(String(response.status));
			await invalidate(DASHBOARD_DATA);
		} catch {
			toast.show("Couldn't turn sharing on", { variant: 'error' });
		} finally {
			sharing = false;
		}
	}

	async function copyShareLink() {
		try {
			await navigator.clipboard.writeText(`${location.origin}/share/${set.share_token}`);
			copied = true;
			clearTimeout(copiedTimer);
			copiedTimer = setTimeout(() => (copied = false), 2000);
		} catch {
			toast.show("Couldn't copy the link", { variant: 'error' });
		}
	}

	const button = 'inline-flex items-center justify-center gap-2 text-sm';
</script>

{#snippet readingCell(label: string, value: string, tone: string)}
	<div class="lg:text-center">
		<p class={microLabel}>{label}</p>
		<p class="font-display text-2xl font-bold whitespace-nowrap md:text-3xl {tone}">{value}</p>
	</div>
{/snippet}

<!-- The Next Gig Board: the page's one chromatic peak -->
<section aria-label={isUpcoming ? 'Next gig' : 'Latest set'} class="{panel} overflow-hidden">
	<a
		{href}
		class="focus-inset block p-5 transition-[background-color] duration-150 hover:bg-surface-100/60 md:p-6 dark:hover:bg-surface-700/30"
	>
		<div class="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
			<div class="min-w-0">
				<p class={microLabel}>{isUpcoming ? 'Next gig' : 'Latest set'}</p>
				<h1
					class="mt-1 line-clamp-2 font-display text-3xl text-balance text-surface-900 md:text-4xl dark:text-surface-50"
				>
					{set.name}
				</h1>
				<p
					class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-surface-500 dark:text-surface-300"
				>
					<span>{meta || 'No gig booked yet. Open the set to pick a date.'}</span>
					{#if set.share_token}
						<span
							class="rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-accent-800 shadow-glow-accent dark:bg-accent-900/40 dark:text-accent-300"
						>
							Sharing on
						</span>
					{/if}
				</p>
			</div>

			<!-- Wrap as whole cells on narrow screens, so no reading runs off the viewport -->
			<div class="flex shrink-0 flex-wrap items-end gap-x-5 gap-y-4 lg:items-center lg:gap-x-7">
				{#if isUpcoming && set.gig_date}
					<div class="basis-full lg:basis-auto">
						{@render readingCell(
							'Countdown',
							gigCountdown(set.gig_date, today),
							'text-accent-600 dark:text-accent-hot'
						)}
					</div>
				{/if}
				{@render readingCell(
					'Total',
					formatDuration(set.totalSeconds),
					isUpcoming
						? 'text-surface-900 dark:text-surface-100'
						: 'text-accent-600 dark:text-accent-hot'
				)}
				{#if set.target_seconds}
					{@render readingCell(
						'Target',
						formatDuration(set.target_seconds),
						'text-surface-900 dark:text-surface-100'
					)}
					{#if diff}
						<div class="lg:text-center">
							<p class={microLabel}>Diff</p>
							<p
								class="text-lg leading-8 font-bold whitespace-nowrap md:leading-9 {diff > 0
									? 'text-danger-600 dark:text-danger-300'
									: 'text-success-600 dark:text-success-300'}"
							>
								{diff > 0 ? '+' : '-'}{formatDuration(Math.abs(diff))}
							</p>
						</div>
					{/if}
				{/if}
				{@render readingCell(
					'Songs',
					String(set.songCount),
					'text-surface-900 dark:text-surface-100'
				)}
			</div>
		</div>

		{#if fit.length > 0}
			<div class="mt-5">
				<SessionStrip
					segments={fit}
					label="Set length against the target"
					format={formatDuration}
				/>
			</div>
		{/if}
	</a>

	<div
		class="{panelFooter} flex flex-col gap-3 px-5 py-3 md:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-6"
	>
		<p class="text-sm font-medium text-surface-700 dark:text-surface-200">{verdict}</p>

		{#if hasSongs}
			<div class="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap">
				<a href="/setlists/{set.id}/rehearse" class="{primaryButton} {button}">
					<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path
							d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86a1 1 0 00-1.5.86z"
						/>
					</svg>
					Rehearse
				</a>
				<a {href} class="{secondaryButton} {button}">Edit set</a>
				<a href="/setlists/{set.id}/print" class="{secondaryButton} {button}">Print</a>
				{#if set.share_token}
					<button type="button" onclick={copyShareLink} class="{secondaryButton} {button}">
						{copied ? 'Copied' : 'Copy share link'}
					</button>
				{:else}
					<button
						type="button"
						onclick={turnOnSharing}
						disabled={sharing}
						class="{secondaryButton} {button} disabled:opacity-50"
					>
						{sharing ? 'Sharing...' : 'Share'}
					</button>
				{/if}
			</div>
		{:else}
			<a {href} class="{primaryButton} {button} shrink-0 self-start lg:self-auto">Add songs</a>
		{/if}
	</div>
</section>

<Toast bind:this={toast} />
