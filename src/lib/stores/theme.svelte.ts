/**
 * Shared theme state (Svelte 5 runes module).
 *
 * FOUC prevention is handled by an inline script in app.html that sets the
 * `dark` class before any rendering occurs — `initTheme` reads that result so
 * every ThemeToggle instance shares one source of truth.
 */
import { browser } from '$app/environment';

export const theme = $state({ dark: false });

let initialized = false;

/** Read the current theme from the document on the client (idempotent). */
export function initTheme() {
	if (!browser || initialized) return;
	initialized = true;
	const stored = localStorage.getItem('theme');
	theme.dark = stored ? stored === 'dark' : document.documentElement.classList.contains('dark');
	document.documentElement.classList.toggle('dark', theme.dark);
}

/** Toggle dark mode: updates the document class, localStorage, and shared state. */
export function toggleTheme() {
	theme.dark = !theme.dark;
	document.documentElement.classList.toggle('dark', theme.dark);
	localStorage.setItem('theme', theme.dark ? 'dark' : 'light');
}
