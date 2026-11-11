/** Puts the cursor in a field the moment it appears, for renaming in place */
export function focusAndSelect(node: HTMLInputElement) {
	node.focus();
	node.select();
}

export const iconButton =
	'focus-live flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-surface-500 transition-colors duration-150 hover:bg-surface-100 hover:text-surface-800 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100';

/** The small copper button on a row: Use, Add */
export const rowAction =
	'focus-live min-h-9 shrink-0 rounded-md border border-accent-300 bg-accent-100 px-3 text-xs font-semibold text-accent-800 transition-colors duration-150 hover:bg-accent-200 disabled:opacity-50 dark:border-accent-600 dark:bg-accent-800/50 dark:text-accent-200 dark:hover:bg-accent-800';
