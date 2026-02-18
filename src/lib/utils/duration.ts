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
 * Format total seconds to a "m:ss" display string.
 * Example: 225 -> "3:45"
 */
export function formatDuration(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
