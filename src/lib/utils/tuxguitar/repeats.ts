import type { TgHeader } from './readTg.js';

// TuxGuitar and alphaTab read the same repeat signs differently once a repeat has
// alternate endings. In TuxGuitar a close sign inside an ending always goes back,
// whatever its count says, and the repeat is over when a pass matches no closed
// ending. alphaTab stops at a close once its count is used up. So a riff with
// endings "1.3.5.7.", "2.6.", "4." and "8.", each close counting one repeat, plays
// eight times in TuxGuitar and twice in alphaTab. This walks the song as TuxGuitar
// would, then writes the signs alphaTab needs to take the same road.

export interface RepeatMarks {
	/** alphaTab's count of plays on a close sign, 0 for none */
	repeatCount: number;
	/** Bit n set: played on pass n + 1 */
	alternateEndings: number;
}

/** alphaTab keeps the pass in the bits of a 32-bit number */
const MAX_PASSES = 30;

const asWritten = (headers: TgHeader[]): RepeatMarks[] =>
	headers.map((h) => ({
		// alphaTab counts plays, TuxGuitar counts repeats
		repeatCount: h.repeatClose > 0 ? h.repeatClose + 1 : 0,
		alternateEndings: h.alternatives
	}));

/**
 * Which passes of its repeat each bar is played on, going through the song the way
 * TuxGuitar's player does (its MidiRepeatController). Null if it never gets out.
 */
function walk(headers: TgHeader[]): number[] | null {
	const played = headers.map(() => 0);
	let index = 0;
	let lastIndex = -1;
	let open = false;
	let startIndex = 0;
	let repeatNumber = 0;
	let alternative = 0;
	// Passes of the repeat we're in. TuxGuitar's own counter goes back to zero when
	// a repeat ends, but the bars after it still belong to its last pass.
	let pass = 0;
	const inEnding = (n: number) => n < 31 && (alternative & (1 << n)) !== 0;

	for (let steps = 0; index < headers.length; steps++) {
		if (steps > headers.length * (MAX_PASSES + 2)) return null;
		const header = headers[index];
		// The top of the song is always somewhere a close sign can go back to
		if (index === 0) {
			startIndex = 0;
			open = true;
		}
		if (header.repeatOpen) {
			startIndex = index;
			open = true;
			if (index > lastIndex) {
				repeatNumber = 0;
				alternative = 0;
				pass = 0;
			}
		} else {
			// An ending runs on from the bar that names it until a close sign
			if (alternative === 0) alternative = header.alternatives;
			if (open && alternative > 0 && !inEnding(repeatNumber)) {
				if (header.repeatClose > 0) alternative = 0;
				index++;
				continue;
			}
		}

		if (pass > MAX_PASSES) return null;
		played[index] |= 1 << pass;
		lastIndex = Math.max(lastIndex, index);

		if (open && header.repeatClose > 0) {
			if (repeatNumber < header.repeatClose || alternative > 0) {
				index = startIndex - 1;
				repeatNumber++;
				pass++;
			} else {
				repeatNumber = 0;
				open = false;
			}
			alternative = 0;
		}
		index++;
	}
	return played;
}

/**
 * The repeat signs for alphaTab, one per bar. Repeats without alternate endings
 * are left as written: the two players agree on those.
 */
export function repeatMarks(headers: TgHeader[]): RepeatMarks[] {
	const marks = asWritten(headers);
	const played = walk(headers);
	if (!played) return marks;

	// A repeat runs from its open sign (or the top) to the bar before the next one
	const starts = headers.flatMap((h, i) => (i === 0 || h.repeatOpen ? [i] : []));
	starts.forEach((start, n) => {
		const end = starts[n + 1] ?? headers.length;
		let hasEndings = false;
		let seen = 0;
		for (let i = start; i < end; i++) {
			// TuxGuitar ignores an ending written on the bar that opens the repeat
			if (i > start || !headers[i].repeatOpen) hasEndings ||= headers[i].alternatives !== 0;
			seen |= played[i];
		}
		if (!hasEndings) return;

		const passes = 32 - Math.clz32(seen);
		if (passes === 0 || passes > MAX_PASSES) return;
		const every = 2 ** passes - 1;
		// alphaTab also runs an ending on over the bars after it, but not past a
		// close sign's jump. `running` is the ending it would carry into this bar.
		let running = 0;
		for (let i = start; i < end; i++) {
			const want = played[i];
			const written = marks[i].alternateEndings;
			const carried = running === 0 ? every : running & every;
			if (written !== 0 && (written & every) === want) {
				running = written;
			} else if (carried === want) {
				marks[i].alternateEndings = 0;
			} else {
				// Spell it out. A bar no pass reaches gets a pass that never comes.
				marks[i].alternateEndings = running = want || 1 << passes;
			}
			// With endings, alphaTab's closes share one count: the passes in all
			if (headers[i].repeatClose > 0) marks[i].repeatCount = passes;
		}
	});
	return marks;
}
