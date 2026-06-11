import type { PrintSettings } from '$lib/types/database';

/**
 * Defaults reproduce the pre-customization share page exactly:
 * text-lg titles (18px), py-2 rows, max-h-24 logo.
 */
export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
	font_family: 'sans',
	font_size: 18,
	line_spacing: 1,
	text_align: 'center',
	show_title: true,
	show_venue_date: true,
	show_notes: true,
	show_numbers: true,
	show_logo: true,
	show_dividers: true,
	logo_size: 'md'
};

// 72px ≈ 54pt: a stage sheet wants to be readable from the floor
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 72;
export const LINE_SPACING_MIN = 0.75;
export const LINE_SPACING_MAX = 2.5;

/**
 * Serif/mono are a deliberate exception to the two-family rule in DESIGN.md:
 * they appear only on the user's printed artifact, never in app chrome.
 * 'sans' maps to today's sheet (Cartridge heading + Klima body) so existing
 * shared setlists render unchanged when print_settings is null.
 */
export const PRINT_FONT_FAMILIES: Record<
	PrintSettings['font_family'],
	{ label: string; title: string; body: string }
> = {
	sans: {
		label: 'Klima',
		title: "'Cartridge', sans-serif",
		body: "'Klima', sans-serif"
	},
	display: {
		label: 'Cartridge',
		title: "'Cartridge', sans-serif",
		body: "'Cartridge', sans-serif"
	},
	serif: {
		label: 'Serif',
		title: "Georgia, 'Times New Roman', serif",
		body: "Georgia, 'Times New Roman', serif"
	},
	mono: {
		label: 'Mono',
		title: "'Courier New', Courier, monospace",
		body: "'Courier New', Courier, monospace"
	}
};

/** Max logo height on the printed sheet; md = the pre-customization max-h-24. */
export const LOGO_SIZES: Record<PrintSettings['logo_size'], string> = {
	sm: '4rem',
	md: '6rem',
	lg: '9rem'
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function bool(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

/**
 * Coerce untrusted input (a null column, a legacy shape, or a tampered
 * request body) into a valid PrintSettings. Any invalid key falls back to
 * its default. Used by the server action before writing and by both
 * renderers when reading.
 */
export function normalizePrintSettings(input: unknown): PrintSettings {
	const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;

	const fontFamily = raw.font_family;
	const logoSize = raw.logo_size;
	const fontSize = Number(raw.font_size);
	const lineSpacing = Number(raw.line_spacing);

	return {
		font_family:
			typeof fontFamily === 'string' && fontFamily in PRINT_FONT_FAMILIES
				? (fontFamily as PrintSettings['font_family'])
				: DEFAULT_PRINT_SETTINGS.font_family,
		font_size: Number.isFinite(fontSize)
			? Math.round(clamp(fontSize, FONT_SIZE_MIN, FONT_SIZE_MAX))
			: DEFAULT_PRINT_SETTINGS.font_size,
		line_spacing: Number.isFinite(lineSpacing)
			? Math.round(clamp(lineSpacing, LINE_SPACING_MIN, LINE_SPACING_MAX) * 20) / 20
			: DEFAULT_PRINT_SETTINGS.line_spacing,
		text_align:
			raw.text_align === 'left' || raw.text_align === 'center'
				? raw.text_align
				: DEFAULT_PRINT_SETTINGS.text_align,
		show_title: bool(raw.show_title, DEFAULT_PRINT_SETTINGS.show_title),
		show_venue_date: bool(raw.show_venue_date, DEFAULT_PRINT_SETTINGS.show_venue_date),
		show_notes: bool(raw.show_notes, DEFAULT_PRINT_SETTINGS.show_notes),
		show_numbers: bool(raw.show_numbers, DEFAULT_PRINT_SETTINGS.show_numbers),
		show_logo: bool(raw.show_logo, DEFAULT_PRINT_SETTINGS.show_logo),
		show_dividers: bool(raw.show_dividers, DEFAULT_PRINT_SETTINGS.show_dividers),
		logo_size:
			typeof logoSize === 'string' && logoSize in LOGO_SIZES
				? (logoSize as PrintSettings['logo_size'])
				: DEFAULT_PRINT_SETTINGS.logo_size
	};
}
