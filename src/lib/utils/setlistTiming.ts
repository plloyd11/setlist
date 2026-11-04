/**
 * The transition rule, shared by the builder's TimingBar and the rehearse
 * timeline so their totals always agree: transitions apply between
 * consecutive songs; an explicit gap IS the break, so pairs touching a gap
 * don't get extra transition time.
 */
export function isTransitionPair(
	a: { gap_seconds?: number | null },
	b: { gap_seconds?: number | null }
): boolean {
	return a.gap_seconds == null && b.gap_seconds == null;
}

export function countTransitionPairs(items: Array<{ gap_seconds?: number | null }>): number {
	let pairs = 0;
	for (let i = 0; i < items.length - 1; i++) {
		if (isTransitionPair(items[i], items[i + 1])) pairs++;
	}
	return pairs;
}

export interface SetlistStats {
	songCount: number;
	totalSeconds: number;
}

/**
 * Song counts and totals for setlist summaries (dashboards, setlist lists),
 * by the same rule as the TimingBar so every screen shows one number for a set.
 * Rows must be ordered by position: transitions depend on what sits next to what.
 */
export function summarizeSetlistRows(
	rows: Array<{ setlist_id: string; gap_seconds: number | null; songs: unknown }>,
	setlists: Array<{ id: string; transition_seconds: number }>
): Record<string, SetlistStats> {
	const stats: Record<string, SetlistStats> = {};
	for (const { id, transition_seconds } of setlists) {
		const items = rows.filter((row) => row.setlist_id === id);
		let songCount = 0;
		let seconds = 0;
		for (const row of items) {
			const song = row.songs as { duration_seconds: number } | null;
			if (song) {
				songCount += 1;
				seconds += song.duration_seconds;
			} else if (row.gap_seconds) {
				// Gap rows have no song: they add time but don't count as songs
				seconds += row.gap_seconds;
			}
		}
		stats[id] = {
			songCount,
			totalSeconds: seconds + countTransitionPairs(items) * transition_seconds
		};
	}
	return stats;
}
