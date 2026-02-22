<script lang="ts">
	let { data } = $props();

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
</svelte:head>

<div class="mx-auto max-w-2xl p-8 print:max-w-none print:p-0 print:shadow-none">
	<!-- Header -->
	<div class="mb-8 text-center">
		{#if data.profile?.logo_url}
			<img
				src={data.profile.logo_url}
				alt=""
				class="mx-auto mb-4 max-h-24 w-auto print:max-h-20"
			/>
		{/if}

		{#if data.profile?.display_name}
			<p class="text-lg text-surface-600 dark:text-surface-400 print:text-surface-600">
				{data.profile.display_name}
			</p>
		{/if}

		<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100 print:text-black">
			{data.setlist.name}
		</h1>

		{#if subtitle}
			<p class="mt-1 text-surface-500 dark:text-surface-400 print:text-surface-500">
				{subtitle}
			</p>
		{/if}
	</div>

	<!-- Song list -->
	{#if data.songs.length > 0}
		<ol class="space-y-0">
			{#each data.songs as song, i}
				<li class="flex items-baseline gap-3 border-b border-surface-200 py-2 dark:border-surface-700 print:border-surface-300">
					<span class="w-8 text-right text-lg font-medium text-surface-400 dark:text-surface-500 print:text-surface-400">
						{i + 1}
					</span>
					<span class="text-lg text-surface-900 dark:text-surface-100 print:text-black">
						{song.title}
					</span>
				</li>
			{/each}
		</ol>
	{:else}
		<p class="py-8 text-center text-surface-400 dark:text-surface-500">No songs in this setlist</p>
	{/if}

	<!-- Footer -->
	<p class="mt-12 text-center text-xs text-surface-400 dark:text-surface-500 print:hidden">
		Powered by Setlist
	</p>
</div>

<style>
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
