/**
 * Parse a "mm:ss" duration string to total seconds.
 * Returns null for invalid input.
 * Valid range: "0:01" to "999:59" (duration_seconds must be > 0)
 */
export function parseDuration(input: string): number | null {
	const match = input.trim().match(/^(\d{1,3}):([0-5]\d)$/);
	if (!match) return null;
	const minutes = parseInt(match[1], 10);
	const seconds = parseInt(match[2], 10);
	const total = minutes * 60 + seconds;
	return total > 0 ? total : null;
}

/**
 * Lenient duration parser for set-length style inputs.
 * Accepts "45" (bare minutes), "45:00" (mm:ss), "1:30:00" (h:mm:ss),
 * "1h", "1h30", and "90m". Returns total seconds, or null for invalid input.
 */
export function parseDurationLenient(input: string): number | null {
	const t = input.trim().toLowerCase();
	if (!t) return null;

	const hms = t.match(/^(\d{1,2}):([0-5]?\d):([0-5]\d)$/);
	if (hms) {
		const total = parseInt(hms[1], 10) * 3600 + parseInt(hms[2], 10) * 60 + parseInt(hms[3], 10);
		return total > 0 ? total : null;
	}

	const strict = parseDuration(t);
	if (strict !== null) return strict;

	// "1h", "1h30", "1h30m", "90m", "90 min"
	const hm = t.match(/^(?:(\d{1,2})\s*h)?\s*(?:(\d{1,3})\s*(?:m|min|mins)?)?$/);
	if (hm && (hm[1] || hm[2])) {
		const total = (parseInt(hm[1] ?? '0', 10) || 0) * 3600 + (parseInt(hm[2] ?? '0', 10) || 0) * 60;
		return total > 0 ? total : null;
	}

	return null;
}

/**
 * Format total seconds to a "m:ss" display string.
 * Example: 225 -> "3:45"
 */
export function formatDuration(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
