import {
	MAX_SECTIONS,
	MIN_LOOP_SECONDS,
	fitLoop,
	type LoopRange,
	type SavedSection
} from './practicePrefs.js';

// A song's section map. Sections are saved ranges with a name. Marking makes them
// tile, like an arranger track; saving a loop can lay one over the others (the
// tricky bar inside the verse), so the lane stacks those in a second row.

/** How close two times are before they count as the same point */
const SAME = 0.05;
/** The lane never grows past this many rows; anything deeper shares the last */
const MAX_ROWS = 3;

export interface LaidSection extends SavedSection {
	row: number;
}

/** One draggable edge in the lane. A shared edge moves both of its sections. */
export interface Boundary {
	time: number;
	row: number;
	endOf: string | null;
	startOf: string | null;
	/** How far it can go, worked out against its row's neighbours */
	min: number;
	max: number;
}

export type MarkResult =
	{ ok: true; sections: SavedSection[] } | { ok: false; reason: 'limit' | 'edge' };

/** Time order. On a tie the longer one leads, so the song's structure keeps the top row. */
export function sortSections(sections: SavedSection[]): SavedSection[] {
	return [...sections].sort((a, b) => a.start - b.start || b.end - a.end);
}

export function sameRange(a: LoopRange, b: LoopRange): boolean {
	return Math.abs(a.start - b.start) < SAME && Math.abs(a.end - b.end) < SAME;
}

/**
 * The sections as this mix can show them: mixes of a song differ in length, so
 * one that starts past the end is left out and one that overruns is trimmed.
 */
export function fitSections(sections: SavedSection[], duration: number): SavedSection[] {
	if (!duration) return [];
	const fitted: SavedSection[] = [];
	for (const section of sections) {
		const range = fitLoop(section, duration);
		if (range) fitted.push({ ...section, ...range });
	}
	return fitted;
}

/** Give each section a row: the first one where nothing is in its way. */
export function layoutRows(sections: SavedSection[]): LaidSection[] {
	const rowEnds: number[] = [];
	return sortSections(sections).map((section) => {
		let row = rowEnds.findIndex((end) => end <= section.start + SAME);
		if (row === -1) row = rowEnds.length < MAX_ROWS ? rowEnds.length : MAX_ROWS - 1;
		rowEnds[row] = Math.max(rowEnds[row] ?? 0, section.end);
		return { ...section, row };
	});
}

/** The edges of a laid-out lane, with touching neighbours sharing one. */
export function boundaries(laid: LaidSection[], duration: number): Boundary[] {
	const result: Boundary[] = [];
	const rows = Math.max(0, ...laid.map((s) => s.row + 1));
	for (let row = 0; row < rows; row++) {
		const inRow = laid.filter((s) => s.row === row);
		inRow.forEach((section, i) => {
			const before = inRow[i - 1];
			const after = inRow[i + 1];
			const touchesBefore = before && Math.abs(before.end - section.start) < SAME;
			const touchesAfter = after && Math.abs(after.start - section.end) < SAME;
			if (!touchesBefore) {
				result.push({
					time: section.start,
					row,
					endOf: null,
					startOf: section.id,
					min: before ? Math.min(before.end, section.start) : 0,
					max: section.end - MIN_LOOP_SECONDS
				});
			}
			result.push({
				time: section.end,
				row,
				endOf: section.id,
				startOf: touchesAfter ? after.id : null,
				min: section.start + MIN_LOOP_SECONDS,
				max: touchesAfter
					? after.end - MIN_LOOP_SECONDS
					: after
						? Math.max(after.start, section.end)
						: duration
			});
		});
	}
	return result;
}

/** Move an edge, taking a neighbour that shares it along. */
export function moveBoundary(
	sections: SavedSection[],
	boundary: Pick<Boundary, 'endOf' | 'startOf' | 'min' | 'max'>,
	time: number
): SavedSection[] {
	if (boundary.max < boundary.min) return sections;
	const t = Math.round(Math.min(boundary.max, Math.max(boundary.min, time)) * 100) / 100;
	return sortSections(
		sections.map((section) => {
			if (section.id === boundary.endOf) return { ...section, end: t };
			if (section.id === boundary.startOf) return { ...section, start: t };
			return section;
		})
	);
}

/** The section the playhead is in. Where they overlap, the one that started last. */
export function sectionAt(sections: SavedSection[], time: number): SavedSection | null {
	let found: SavedSection | null = null;
	for (const section of sections) {
		if (time < section.start || time >= section.end) continue;
		if (!found || section.start >= found.start) found = section;
	}
	return found;
}

/** The first unused "Section N" */
function nextLabel(sections: SavedSection[]): string {
	const taken = new Set(sections.map((s) => s.label.trim().toLowerCase()));
	let n = sections.length + 1;
	while (taken.has(`section ${n}`)) n++;
	return `Section ${n}`;
}

function addSection(sections: SavedSection[], range: LoopRange): SavedSection[] {
	return [...sections, { id: crypto.randomUUID(), label: nextLabel(sections), ...range }];
}

/**
 * Drop a boundary at the playhead. Inside a section it splits it, and the first
 * half keeps the name. In open space, the space on either side becomes a section,
 * so marking each change from the top maps the whole song, intro included.
 */
export function markAt(sections: SavedSection[], time: number, duration: number): MarkResult {
	if (sections.length >= MAX_SECTIONS) return { ok: false, reason: 'limit' };
	const t = Math.round(time * 100) / 100;

	const inside = sectionAt(sections, t);
	if (inside) {
		if (t - inside.start < MIN_LOOP_SECONDS || inside.end - t < MIN_LOOP_SECONDS) {
			return { ok: false, reason: 'edge' };
		}
		const split = sections.map((s) => (s.id === inside.id ? { ...s, end: t } : s));
		return { ok: true, sections: sortSections(addSection(split, { start: t, end: inside.end })) };
	}

	const spaceStart = Math.max(0, ...sections.filter((s) => s.end <= t).map((s) => s.end));
	const spaceEnd = Math.min(duration, ...sections.filter((s) => s.start >= t).map((s) => s.start));
	let pieces: LoopRange[] = [
		{ start: spaceStart, end: t },
		{ start: t, end: spaceEnd }
	].filter((piece) => piece.end - piece.start >= MIN_LOOP_SECONDS);
	if (pieces.length === 0) return { ok: false, reason: 'edge' };
	// One slot left: keep the part that starts here
	if (sections.length + pieces.length > MAX_SECTIONS) pieces = pieces.slice(-1);

	let next = sections;
	for (const piece of pieces) next = addSection(next, piece);
	return { ok: true, sections: sortSections(next) };
}

/** Seconds into a section before "previous" means its own start, like a CD player */
const RESTART_AFTER = 2;

/**
 * Where "previous" lands from here: the start of the section you're in, or the one
 * before it if you've only just entered. Null means the top of the song.
 */
export function previousSection(sections: SavedSection[], time: number): SavedSection | null {
	const sorted = sortSections(sections);
	for (let i = sorted.length - 1; i >= 0; i--) {
		if (sorted[i].start <= time - RESTART_AFTER) return sorted[i];
	}
	return null;
}

export function nextSection(sections: SavedSection[], time: number): SavedSection | null {
	return sortSections(sections).find((s) => s.start > time + SAME) ?? null;
}
