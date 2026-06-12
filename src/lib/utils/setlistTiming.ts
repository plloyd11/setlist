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
