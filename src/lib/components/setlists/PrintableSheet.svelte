<script lang="ts">
	import { formatDuration } from '#lib/utils/duration.js';
	import { LOGO_SIZES, PRINT_FONT_FAMILIES } from '#lib/utils/printSettings.js';
	import type { PrintSettings } from '#lib/types/database.js';

	// Matches the get_shared_setlist RPC entry shape: song rows carry
	// title + notes, gap rows carry gap_seconds + gap_label.
	interface SheetEntry {
		title?: string;
		notes?: string | null;
		gap_seconds?: number | null;
		gap_label?: string | null;
	}

	let {
		name,
		gigDate = null,
		venue = null,
		songs,
		profile = null,
		settings
	}: {
		name: string;
		gigDate?: string | null;
		venue?: string | null;
		songs: SheetEntry[];
		profile?: { display_name: string | null; logo_url: string | null } | null;
		settings: PrintSettings;
	} = $props();

	// Number the songs; gap rows are unnumbered breaks
	let entries = $derived.by(() => {
		let n = 0;
		return songs.map((s) => ({
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

	let dateDisplay = $derived(formatDate(gigDate));
	let subtitle = $derived.by(() => {
		const parts: string[] = [];
		if (venue) parts.push(venue);
		if (dateDisplay) parts.push(dateDisplay);
		return parts.join(' · ');
	});

	let fonts = $derived(PRINT_FONT_FAMILIES[settings.font_family]);
</script>

<!-- The sheet is light-locked (literal gray/black/white, no dark: variants):
     it renders on white paper regardless of app theme. -->
<div
	class="printable-sheet"
	style="--sheet-title-font: {fonts.title}; --sheet-body-font: {fonts.body}; --sheet-size: {settings.font_size}px; --sheet-gap: calc(0.5rem * {settings.line_spacing}); --sheet-logo-h: {LOGO_SIZES[
		settings.logo_size
	]}"
>
	<!-- Header -->
	{#if settings.show_logo || settings.show_title || (settings.show_venue_date && subtitle)}
		<div class="mb-8 text-center">
			{#if settings.show_logo}
				{#if profile?.logo_url}
					<img
						src={profile.logo_url}
						alt={profile.display_name ?? ''}
						class="sheet-logo mx-auto mb-4 w-auto"
					/>
				{:else if profile?.display_name}
					<p class="text-gray-600">
						{profile.display_name}
					</p>
				{/if}
			{/if}

			{#if settings.show_title}
				<h1 class="sheet-title font-normal text-black">
					{name}
				</h1>
			{/if}

			{#if settings.show_venue_date && subtitle}
				<p class="sheet-small mt-1 text-gray-500">
					{subtitle}
				</p>
			{/if}
		</div>
	{/if}

	<!-- Song list -->
	{#if songs.length > 0}
		<ol class="space-y-0">
			{#each entries as entry}
				{#if entry.gap_seconds != null}
					<li
						class="sheet-row flex items-baseline gap-3 {settings.text_align === 'center'
							? 'justify-center'
							: ''} {settings.show_dividers ? 'border-b border-gray-300' : ''}"
					>
						{#if settings.show_numbers && settings.text_align === 'left'}
							<span class="w-8"></span>
						{/if}
						<span class="sheet-gap-text font-medium tracking-wider text-gray-500 uppercase">
							{entry.gap_label || 'Gap'} · {formatDuration(entry.gap_seconds)}
						</span>
					</li>
				{:else}
					<li
						class="sheet-row flex items-baseline gap-3 {settings.text_align === 'center'
							? 'justify-center'
							: ''} {settings.show_dividers ? 'border-b border-gray-300' : ''}"
					>
						{#if settings.show_numbers}
							<!-- Left-aligned sheets keep a fixed number column so titles line
							     up; centered sheets let the number sit inline with the title -->
							<span
								class="font-medium text-gray-500 {settings.text_align === 'left'
									? 'w-8 text-right'
									: ''}"
							>
								{entry.number}
							</span>
						{/if}
						<span
							class="sheet-song text-black {settings.text_align === 'center' ? 'text-center' : ''}"
						>
							{entry.title}
						</span>
						{#if settings.show_notes && entry.notes}
							<span
								class="sheet-small sheet-note min-w-0 truncate text-gray-500 {settings.show_numbers &&
								settings.text_align === 'left'
									? 'sheet-note-indent'
									: ''}"
							>
								{entry.notes}
							</span>
						{/if}
					</li>
				{/if}
			{/each}
		</ol>
	{:else}
		<p class="sheet-small py-8 text-center text-gray-500">No songs in this setlist</p>
	{/if}
</div>

<style>
	/* Typography flows from the settings vars: the root carries the song-title
	   size (default 18px = the old text-lg), everything else is sized in em
	   so the whole sheet scales together. Defaults reproduce the original
	   share page: h1 text-3xl (30/18em), notes/subtitle text-base (16/18em),
	   gap text text-sm (14/18em), rows py-2, logo max-h-24. */
	.printable-sheet {
		font-family: var(--sheet-body-font);
		font-size: var(--sheet-size);
	}
	.sheet-title {
		font-family: var(--sheet-title-font);
		font-size: 1.667em;
	}
	.sheet-small {
		font-size: 0.889em;
	}
	.sheet-gap-text {
		font-size: 0.778em;
	}
	.sheet-row {
		padding-block: var(--sheet-gap);
	}
	/* A phone can't fit a title and its note side by side: the note would truncate
	   and squeeze the title. Screen only, so the printed sheet keeps its layout. */
	@media screen and (max-width: 639px) {
		.sheet-row {
			flex-wrap: wrap;
			row-gap: 0;
		}
		/* Clamped so a long title wraps within its line instead of leaving the number behind */
		.sheet-song {
			max-width: calc(100% - 3em);
		}
		.sheet-note {
			flex-basis: 100%;
			white-space: normal;
		}
		.sheet-note-indent {
			padding-left: calc(2rem + 0.75rem);
		}
	}
	.sheet-logo {
		max-height: var(--sheet-logo-h);
	}
</style>
