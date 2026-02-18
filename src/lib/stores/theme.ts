/**
 * Theme utilities for dark/light mode toggling.
 * The actual FOUC prevention is handled by an inline script in app.html
 * that runs before any rendering occurs.
 */

export function getTheme(): 'dark' | 'light' {
	return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function toggleTheme(): 'dark' | 'light' {
	const isDark = document.documentElement.classList.toggle('dark');
	localStorage.setItem('theme', isDark ? 'dark' : 'light');
	return isDark ? 'dark' : 'light';
}
