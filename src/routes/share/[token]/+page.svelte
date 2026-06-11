<script lang="ts">
	import PrintableSheet from '$lib/components/setlists/PrintableSheet.svelte';
	import { normalizePrintSettings } from '$lib/utils/printSettings';

	let { data } = $props();

	let settings = $derived(normalizePrintSettings(data.printSettings));
</script>

<svelte:head>
	<title>{data.setlist.name} — Setlist</title>
	<!-- Share links are unlisted: keep them out of search indexes -->
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="share-page mx-auto max-w-2xl bg-white p-8 print:max-w-none print:p-0 print:shadow-none">
	<PrintableSheet
		name={data.setlist.name}
		gigDate={data.setlist.gig_date}
		venue={data.setlist.venue}
		songs={data.songs}
		profile={data.profile}
		{settings}
	/>

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
		@page {
			size: letter;
			margin: 0.5in;
		}
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
