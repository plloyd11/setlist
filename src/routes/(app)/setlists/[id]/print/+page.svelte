<script lang="ts">
	import { beforeNavigate } from '$app/navigation';
	import PrintableSheet from '$lib/components/setlists/PrintableSheet.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import {
		FONT_SIZE_MAX,
		FONT_SIZE_MIN,
		LINE_SPACING_MAX,
		LINE_SPACING_MIN,
		normalizePrintSettings,
		PRINT_FONT_FAMILIES
	} from '$lib/utils/printSettings';
	import type { PrintSettings } from '$lib/types/database';

	let { data } = $props();

	let toast: Toast;

	// Local state is the source of truth on this page; saves sync it back
	// without invalidateAll() so slider drags never fight a stale reload.
	// svelte-ignore state_referenced_locally
	let settings = $state(normalizePrintSettings(data.setlist.print_settings));

	let saveState = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let saveTimer: ReturnType<typeof setTimeout> | undefined;

	const fontOptions = Object.entries(PRINT_FONT_FAMILIES) as Array<
		[PrintSettings['font_family'], (typeof PRINT_FONT_FAMILIES)[PrintSettings['font_family']]]
	>;
	const logoSizes: Array<{ value: PrintSettings['logo_size']; label: string }> = [
		{ value: 'sm', label: 'S' },
		{ value: 'md', label: 'M' },
		{ value: 'lg', label: 'L' }
	];
	const alignOptions: Array<{ value: PrintSettings['text_align']; label: string }> = [
		{ value: 'left', label: 'Left' },
		{ value: 'center', label: 'Center' }
	];

	// US-letter width (8.5in) at CSS 96dpi: the preview renders the page at
	// true scale and zooms down to fit narrower screens, so the print output
	// matches the preview exactly.
	const PAPER_WIDTH_PX = 816;
	let previewWidth = $state(0);
	let previewZoom = $derived(previewWidth > 0 ? Math.min(1, previewWidth / PAPER_WIDTH_PX) : 1);

	function queueSave() {
		clearTimeout(saveTimer);
		saveTimer = setTimeout(persist, 500);
	}

	async function persist() {
		clearTimeout(saveTimer);
		saveTimer = undefined;
		saveState = 'saving';

		const formData = new FormData();
		formData.set('print_settings', JSON.stringify(settings));

		try {
			const response = await fetch('?/updatePrintSettings', {
				method: 'POST',
				body: formData
			});
			if (!response.ok) throw new Error('Save failed');
			saveState = 'saved';
		} catch {
			saveState = 'error';
			toast?.show('Failed to save print settings', { variant: 'error' });
		}
	}

	// Don't lose an edit made inside the debounce window (closing the tab
	// outright can still drop one -- accepted for a styling preference)
	beforeNavigate(() => {
		if (saveTimer) persist();
	});

	function selectFont(value: PrintSettings['font_family']) {
		settings.font_family = value;
		queueSave();
	}

	function selectLogoSize(value: PrintSettings['logo_size']) {
		settings.logo_size = value;
		queueSave();
	}

	function selectAlign(value: PrintSettings['text_align']) {
		settings.text_align = value;
		queueSave();
	}
</script>

<svelte:head>
	<!-- The document title doubles as the suggested print-to-PDF filename -->
	<title>{data.setlist.name} — Print</title>
</svelte:head>

<div class="print-editor md:grid md:h-full md:grid-cols-[280px_1fr]">
	<!-- Style sidebar -->
	<div
		class="no-print border-b border-surface-200 bg-surface-50 p-4 md:overflow-y-auto md:border-r md:border-b-0 md:p-6 dark:border-surface-700 dark:bg-surface-900/50"
	>
		<a
			href={data.backHref}
			class="focus-live inline-flex min-h-11 items-center gap-1.5 rounded text-sm font-medium text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100"
		>
			<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
				<path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
			</svg>
			Back to setlist
		</a>

		<div class="mt-4 space-y-6">
			<!-- Font family -->
			<div>
				<p
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
				>
					Font
				</p>
				<div class="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Font family">
					{#each fontOptions as [value, font] (value)}
						<button
							role="radio"
							aria-checked={settings.font_family === value}
							onclick={() => selectFont(value)}
							class="focus-live min-h-11 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {settings.font_family ===
							value
								? 'border-accent-500 bg-accent-100 text-accent-800 dark:border-accent-hot dark:bg-accent-900/40 dark:text-accent-300'
								: 'border-surface-300 text-surface-600 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800'}"
							style="font-family: {font.body}"
						>
							{font.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Font size -->
			<div>
				<div class="flex items-baseline justify-between">
					<label
						for="print-font-size"
						class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
					>
						Size
					</label>
					<span class="text-sm font-medium text-surface-700 dark:text-surface-300">
						{settings.font_size}px
					</span>
				</div>
				<input
					id="print-font-size"
					type="range"
					min={FONT_SIZE_MIN}
					max={FONT_SIZE_MAX}
					step="1"
					bind:value={settings.font_size}
					oninput={queueSave}
					class="focus-live mt-2 h-11 w-full accent-accent-600 dark:accent-accent-hot"
				/>
			</div>

			<!-- Line spacing -->
			<div>
				<div class="flex items-baseline justify-between">
					<label
						for="print-line-spacing"
						class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
					>
						Spacing
					</label>
					<span class="text-sm font-medium text-surface-700 dark:text-surface-300">
						{settings.line_spacing}&times;
					</span>
				</div>
				<input
					id="print-line-spacing"
					type="range"
					min={LINE_SPACING_MIN}
					max={LINE_SPACING_MAX}
					step="0.25"
					bind:value={settings.line_spacing}
					oninput={queueSave}
					class="focus-live mt-2 h-11 w-full accent-accent-600 dark:accent-accent-hot"
				/>
			</div>

			<!-- Alignment -->
			<div>
				<p
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
				>
					Align
				</p>
				<div class="mt-2 flex gap-2" role="radiogroup" aria-label="Text alignment">
					{#each alignOptions as opt (opt.value)}
						<button
							role="radio"
							aria-checked={settings.text_align === opt.value}
							onclick={() => selectAlign(opt.value)}
							class="focus-live min-h-11 flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors {settings.text_align ===
							opt.value
								? 'border-accent-500 bg-accent-100 text-accent-800 dark:border-accent-hot dark:bg-accent-900/40 dark:text-accent-300'
								: 'border-surface-300 text-surface-600 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800'}"
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>

			<!-- Content toggles -->
			<div>
				<p
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
				>
					Show
				</p>
				<div class="mt-1">
					<label
						class="flex min-h-11 items-center gap-3 text-sm text-surface-700 dark:text-surface-300"
					>
						<input
							type="checkbox"
							bind:checked={settings.show_title}
							onchange={queueSave}
							class="focus-live h-4 w-4 rounded border-surface-300 text-accent-600 dark:border-surface-600 dark:bg-surface-800"
						/>
						Setlist name
					</label>
					<label
						class="flex min-h-11 items-center gap-3 text-sm text-surface-700 dark:text-surface-300"
					>
						<input
							type="checkbox"
							bind:checked={settings.show_venue_date}
							onchange={queueSave}
							class="focus-live h-4 w-4 rounded border-surface-300 text-accent-600 dark:border-surface-600 dark:bg-surface-800"
						/>
						Venue &amp; date
					</label>
					<label
						class="flex min-h-11 items-center gap-3 text-sm text-surface-700 dark:text-surface-300"
					>
						<input
							type="checkbox"
							bind:checked={settings.show_logo}
							onchange={queueSave}
							class="focus-live h-4 w-4 rounded border-surface-300 text-accent-600 dark:border-surface-600 dark:bg-surface-800"
						/>
						Logo / band name
					</label>
					<label
						class="flex min-h-11 items-center gap-3 text-sm text-surface-700 dark:text-surface-300"
					>
						<input
							type="checkbox"
							bind:checked={settings.show_numbers}
							onchange={queueSave}
							class="focus-live h-4 w-4 rounded border-surface-300 text-accent-600 dark:border-surface-600 dark:bg-surface-800"
						/>
						Song numbers
					</label>
					<label
						class="flex min-h-11 items-center gap-3 text-sm text-surface-700 dark:text-surface-300"
					>
						<input
							type="checkbox"
							bind:checked={settings.show_notes}
							onchange={queueSave}
							class="focus-live h-4 w-4 rounded border-surface-300 text-accent-600 dark:border-surface-600 dark:bg-surface-800"
						/>
						Song notes
					</label>
					<label
						class="flex min-h-11 items-center gap-3 text-sm text-surface-700 dark:text-surface-300"
					>
						<input
							type="checkbox"
							bind:checked={settings.show_dividers}
							onchange={queueSave}
							class="focus-live h-4 w-4 rounded border-surface-300 text-accent-600 dark:border-surface-600 dark:bg-surface-800"
						/>
						Divider lines
					</label>
				</div>
			</div>

			<!-- Logo size -->
			<div>
				<p
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
				>
					Logo size
				</p>
				<div class="mt-2 flex gap-2" role="radiogroup" aria-label="Logo size">
					{#each logoSizes as opt (opt.value)}
						<button
							role="radio"
							aria-checked={settings.logo_size === opt.value}
							disabled={!settings.show_logo}
							onclick={() => selectLogoSize(opt.value)}
							class="focus-live min-h-11 flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 {settings.logo_size ===
							opt.value
								? 'border-accent-500 bg-accent-100 text-accent-800 dark:border-accent-hot dark:bg-accent-900/40 dark:text-accent-300'
								: 'border-surface-300 text-surface-600 hover:bg-surface-100 disabled:hover:bg-transparent dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800'}"
						>
							{opt.label}
						</button>
					{/each}
				</div>
			</div>
		</div>

		<div class="mt-8 flex items-center gap-3">
			<button
				onclick={() => window.print()}
				class="focus-live rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
			>
				Print / PDF
			</button>
			<span class="text-xs text-surface-500 dark:text-surface-300" aria-live="polite">
				{#if saveState === 'saving'}
					Saving…
				{:else if saveState === 'saved'}
					Saved
				{:else if saveState === 'error'}
					Not saved
				{/if}
			</span>
		</div>
	</div>

	<!-- Paper preview: a true-scale US-letter page, shrunk to fit on screen -->
	<div class="print-preview bg-surface-100 p-4 md:overflow-y-auto md:p-8 dark:bg-surface-900">
		<div bind:clientWidth={previewWidth}>
			<div class="paper mx-auto bg-white shadow-lg" style="zoom: {previewZoom}">
				<PrintableSheet
					name={data.setlist.name}
					gigDate={data.setlist.gig_date}
					venue={data.setlist.venue}
					songs={data.entries}
					profile={data.profile}
					{settings}
				/>
			</div>
		</div>
	</div>
</div>

<Toast bind:this={toast} />

<style>
	/* True-scale US-letter sheet (the 0.5in padding mirrors the @page print
	   margins); the inline zoom shrinks it to fit on screen. */
	.paper {
		width: 8.5in;
		min-height: 11in;
		padding: 0.5in;
	}

	@media print {
		@page {
			size: letter;
			margin: 0.5in;
		}
		:global(html),
		:global(body) {
			height: auto !important;
			overflow: visible !important;
			background: white !important;
		}
		/* The (app) shell is a fixed-height flex with a scrolling <main>;
		   printing inside it clips to one page without these overrides. */
		:global(.app-shell) {
			display: block !important;
			height: auto !important;
			background: white !important;
		}
		:global(main) {
			height: auto !important;
			overflow: visible !important;
			padding: 0 !important;
		}
		:global(nav),
		:global(aside),
		:global(.no-print) {
			display: none !important;
		}
		/* Collapse the editor grid so the sheet doesn't print inside the
		   (hidden) sidebar's 280px column */
		.print-editor,
		.print-preview {
			display: block !important;
			height: auto !important;
			overflow: visible !important;
			background: white !important;
			padding: 0 !important;
		}
		/* The @page margins take over from the on-screen paper chrome */
		.paper {
			width: auto;
			min-height: 0;
			margin: 0;
			padding: 0 !important;
			box-shadow: none;
			zoom: 1 !important;
		}
	}
</style>
