/**
 * Reduce an attacker-influenced redirect target to a same-origin path, or the
 * fallback if it would leave this origin.
 *
 * Prefix checks ("starts with / but not //") aren't enough: URL parsers strip
 * tabs and newlines and treat "\" as "/", so "/\t/evil.com" passes them and still
 * navigates to evil.com. Parsing the value the way the browser will closes off
 * the whole class.
 *
 * Pass the real `origin` to also accept absolute URLs on it; without one, only
 * relative paths can pass.
 */
export function safeInternalPath(
	value: string | null | undefined,
	fallback = '/dashboard',
	origin = 'https://internal.invalid'
): string {
	if (!value) return fallback;
	try {
		const parsed = new URL(value, origin);
		return parsed.origin === origin ? parsed.pathname + parsed.search + parsed.hash : fallback;
	} catch {
		return fallback;
	}
}
