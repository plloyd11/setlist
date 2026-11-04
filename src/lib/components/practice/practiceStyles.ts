/** Shared class strings, so every Practice tab draws its panels and readings the same way */

export const panel =
	'rounded-xl border border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-800';
export const panelRows = 'divide-y divide-surface-200 dark:divide-surface-700';
/** Sits under a panel's rows: adding to the list happens at the end of the list */
export const panelFooter =
	'border-t border-surface-200 bg-surface-100/60 dark:border-surface-700 dark:bg-surface-900/40';
export const rowLink =
	'focus-inset flex min-h-12 items-center gap-3 px-4 py-2 transition-[background-color] duration-150 hover:bg-surface-100 dark:hover:bg-surface-700/50';

export const microLabel = 'text-label text-surface-500 uppercase dark:text-surface-300';
export const sectionHeading =
	'font-display text-lg font-semibold text-surface-900 dark:text-surface-100';
export const reading = 'font-display leading-none font-bold text-accent-600 dark:text-accent-hot';
export const fieldLabel = 'text-sm font-medium text-surface-700 dark:text-surface-300';
export const field =
	'focus-live block min-h-11 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100 dark:placeholder-surface-300';

export const heroButton =
	'focus-live rounded-lg bg-accent-hot px-6 py-3 font-display font-bold text-surface-950 shadow-glow-accent transition-[filter] duration-150 hover:brightness-105';
export const primaryButton =
	'focus-live min-h-11 rounded-lg bg-accent-500 px-4 font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-accent-600';
export const secondaryButton =
	'focus-live min-h-11 rounded-lg border border-surface-300 px-4 text-sm font-medium text-surface-700 transition-colors duration-150 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-200 dark:hover:bg-surface-700';

/**
 * A session heats up as it goes: cold steel, working copper, hot filament. Checked with
 * the dataviz validator against each theme's panel surface. Three coppers failed: hot
 * and mid can't be told apart. Status colors stay out of this, and Limelight means live.
 */
export const KIND_TONES = {
	'warm-up': 'bg-surface-500 text-white dark:bg-surface-300 dark:text-surface-950',
	technique: 'bg-accent-400 text-surface-950 dark:bg-accent-500 dark:text-white',
	song: 'bg-accent-600 text-white dark:bg-accent-hot dark:text-surface-950'
} as const;

/** A song's status as a solid color, so a strip of them reads like the chips beside it */
export const STATUS_TONES = {
	needs_work: 'bg-danger-500 dark:bg-danger-300',
	learning: 'bg-accent-500 dark:bg-accent-300',
	solid: 'bg-success-500 dark:bg-success-300',
	unmarked: 'bg-surface-200 dark:bg-surface-600'
} as const;
