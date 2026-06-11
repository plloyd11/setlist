<script lang="ts">
	import { formatDuration } from '$lib/utils/duration';

	let { data } = $props();

	// Number the songs; gap rows are unnumbered breaks
	let entries = $derived.by(() => {
		let n = 0;
		return data.songs.map((s) => ({
			...s,
			number: s.gap_seconds == null ? ++n : null
		}));
	});

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '';
		try {
			const date = new Date(dateStr + 'T00:00:00');
			return date.toLocaleDateString('en-US', {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric'
			});
		} catch {
			return dateStr;
		}
	}

	let dateDisplay = $derived(formatDate(data.setlist.gig_date));
	let subtitle = $derived.by(() => {
		const parts: string[] = [];
		if (data.setlist.venue) parts.push(data.setlist.venue);
		if (dateDisplay) parts.push(dateDisplay);
		return parts.join(' — ');
	});
</script>

<svelte:head>
	<title>{data.setlist.name} — Setlist</title>
	<!-- Share links are unlisted: keep them out of search indexes -->
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="share-page mx-auto max-w-2xl bg-white p-8 print:max-w-none print:p-0 print:shadow-none">
	<!-- Header -->
	<div class="mb-8 text-center">
		{#if data.profile?.logo_url}
			<img
				src={data.profile.logo_url}
				alt={data.profile.display_name ?? ''}
				class="mx-auto mb-4 max-h-24 w-auto print:max-h-20"
			/>
		{:else if data.profile?.display_name}
			<p class="text-lg text-gray-600">
				{data.profile.display_name}
			</p>
		{/if}

		<h1 class="font-display text-3xl text-black">
			{data.setlist.name}
		</h1>

		{#if subtitle}
			<p class="mt-1 text-gray-500">
				{subtitle}
			</p>
		{/if}
	</div>

	<!-- Song list -->
	{#if data.songs.length > 0}
		<ol class="space-y-0">
			{#each entries as entry}
				{#if entry.gap_seconds != null}
					<li class="flex items-baseline gap-3 border-b border-gray-300 py-2">
						<span class="w-8"></span>
						<span class="text-sm font-medium tracking-wider text-gray-400 uppercase">
							{entry.gap_label || 'Gap'} — {formatDuration(entry.gap_seconds)}
						</span>
					</li>
				{:else}
					<li class="flex items-baseline gap-3 border-b border-gray-300 py-2">
						<span class="w-8 text-right text-lg font-medium text-gray-400">
							{entry.number}
						</span>
						<span class="text-lg text-black">
							{entry.title}
						</span>
						{#if entry.notes}
							<span class="min-w-0 truncate text-base text-gray-500">
								{entry.notes}
							</span>
						{/if}
					</li>
				{/if}
			{/each}
		</ol>
	{:else}
		<p class="py-8 text-center text-gray-400">No songs in this setlist</p>
	{/if}

	<!-- Footer -->
	<p class="mt-12 text-center text-xs text-gray-400 print:hidden">Powered by Setlist</p>
</div>

<style>
	/* Force light appearance regardless of dark mode */
	:global(html:has(.share-page)),
	:global(body:has(.share-page)) {
		background: white !important;
	}

	@media print {
		:global(body) {
			background: white !important;
			color: black !important;
		}
		:global(nav),
		:global(aside),
		:global(.no-print) {
			display: none !important;
		}
	}
</style>
