<script lang="ts">
	import { slide } from 'svelte/transition';
	import type { SongFile } from '#lib/types/database.js';
	import TabPlayer from '#lib/components/practice/TabPlayer.svelte';

	type Chart = Omit<SongFile, 'song_id'> & { signedUrl: string | null };

	let {
		charts,
		autoOpen = false,
		compact = false,
		tabKeyboard = false
	}: {
		charts: Chart[];
		/** Open the first PDF straight away, for when reading it is the point */
		autoOpen?: boolean;
		/** Drop the heading where the surrounding screen already says what this is */
		compact?: boolean;
		/** Let the tab player answer to Space and L: nothing else on the page is using them */
		tabKeyboard?: boolean;
	} = $props();

	const isPdf = (c: Chart) => c.mime_type === 'application/pdf';
	const isTuxGuitar = (c: Chart) => /\.tg$/i.test(c.file_name);
	const isTab = (c: Chart) => /\.(gp|gp3|gp4|gp5|gpx|tg)$/i.test(c.file_name);
	const opensInline = (c: Chart) => (isPdf(c) || isTab(c)) && !!c.signedUrl;

	const reduceMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// PDFs and tabs toggle an inline viewer; one open at a time
	// svelte-ignore state_referenced_locally
	let viewingChartId = $state<string | null>(
		autoOpen ? (charts.find(opensInline)?.id ?? null) : null
	);
	let viewingChart = $derived(
		viewingChartId ? (charts.find((c) => c.id === viewingChartId) ?? null) : null
	);

	function downloadHref(c: Chart): string | null {
		if (!c.signedUrl) return null;
		try {
			const u = new URL(c.signedUrl);
			u.searchParams.set('download', c.file_name);
			return u.toString();
		} catch {
			return c.signedUrl;
		}
	}
</script>

<!-- Charts & tabs -->
{#if charts.length > 0}
	<div class={compact ? '' : 'mt-6'}>
		{#if !compact}
			<h2 class="font-display text-lg font-semibold text-surface-900 dark:text-surface-100">
				Charts & tabs
			</h2>
		{/if}
		<ul class="flex flex-wrap gap-2 {compact ? '' : 'mt-3'}">
			{#each charts as chart (chart.id)}
				<li class="flex max-w-full items-center gap-1">
					{#if opensInline(chart)}
						<button
							type="button"
							onclick={() => (viewingChartId = viewingChartId === chart.id ? null : chart.id)}
							aria-pressed={viewingChartId === chart.id}
							class="focus-live max-w-full truncate rounded-lg border px-3 py-1.5 text-sm font-medium {viewingChartId ===
							chart.id
								? 'border-accent-500 bg-accent-500 text-white shadow-sm'
								: 'border-surface-300 text-surface-700 hover:border-accent-400 hover:text-accent-600 dark:border-surface-600 dark:text-surface-300 dark:hover:border-accent-600 dark:hover:text-accent-400'}"
						>
							{chart.label ?? chart.file_name}
						</button>
					{:else if chart.signedUrl}
						<a
							href={downloadHref(chart)}
							class="focus-live inline-block max-w-full truncate rounded-lg border border-surface-300 px-3 py-1.5 text-sm font-medium text-surface-700 hover:border-accent-400 hover:text-accent-600 dark:border-surface-600 dark:text-surface-300 dark:hover:border-accent-600 dark:hover:text-accent-400"
						>
							{chart.label ?? chart.file_name}
							<span class="text-xs text-surface-400 dark:text-surface-500">↓</span>
						</a>
					{:else}
						<span
							class="inline-block max-w-full truncate rounded-lg border border-surface-200 px-3 py-1.5 text-sm text-surface-400 dark:border-surface-700 dark:text-surface-500"
						>
							{chart.label ?? chart.file_name} (unavailable)
						</span>
					{/if}
				</li>
			{/each}
		</ul>

		{#if viewingChart?.signedUrl && isTab(viewingChart)}
			<div class="mt-4">
				{#key viewingChart.id}
					<TabPlayer
						url={viewingChart.signedUrl}
						tuxGuitar={isTuxGuitar(viewingChart)}
						downloadHref={downloadHref(viewingChart)}
						keyboard={tabKeyboard}
					/>
				{/key}
			</div>
		{:else if viewingChart?.signedUrl}
			<div class="mt-4" transition:slide={{ duration: reduceMotion ? 0 : 200 }}>
				<div class="flex items-center justify-between">
					<!-- The chip already shows the label (or, unlabeled, the file name) —
					     only repeat the file name when it adds information -->
					{#if viewingChart.label}
						<p class="truncate text-xs text-surface-500 dark:text-surface-300">
							{viewingChart.file_name}
						</p>
					{/if}
					<a
						href={viewingChart.signedUrl}
						target="_blank"
						rel="noopener"
						class="focus-live ml-auto shrink-0 rounded px-2 py-1 text-xs font-medium text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100"
					>
						Open in new tab
					</a>
				</div>
				<iframe
					src={viewingChart.signedUrl}
					title="Chart: {viewingChart.label ?? viewingChart.file_name}"
					class="mt-2 h-[70vh] w-full rounded-xl border border-surface-200 bg-white dark:border-surface-700"
				></iframe>
			</div>
		{/if}
	</div>
{/if}
