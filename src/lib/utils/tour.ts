/**
 * The onboarding tour: what it says, where it points, and who gets it unasked.
 *
 * "Seen" lives in Supabase user_metadata (`tour_seen`), so it's once per account and
 * needs no table. Accounts older than the tour never get it automatically; they have
 * the replay button.
 */

/** Accounts created before this never auto-start the tour */
export const TOUR_LAUNCHED_AT = Date.parse('2026-11-11T00:00:00Z');

/** Where a fresh account lands, and the only page the tour starts itself on */
export const TOUR_HOME = '/dashboard';

export interface TourUser {
	created_at?: string;
	user_metadata?: Record<string, unknown>;
}

export function shouldAutoStartTour(user: TourUser | null | undefined): boolean {
	if (!user || user.user_metadata?.tour_seen) return false;
	const created = Date.parse(user.created_at ?? '');
	return Number.isFinite(created) && created >= TOUR_LAUNCHED_AT;
}

export interface TourStep {
	id: string;
	/** Page the step lives on; null stays wherever the last step left the musician */
	route: string | null;
	/** `data-tour` value of the control to light up */
	anchor: string;
	title: string;
	body: string;
	/** Said instead when the anchor isn't on screen (the rail doesn't exist on a phone) */
	fallbackBody?: string;
	/** Side of the anchor to try first */
	placement?: 'bottom' | 'right';
}

export const TOUR_STEPS: TourStep[] = [
	{
		id: 'home',
		route: '/dashboard',
		anchor: 'home-board',
		title: 'Your next gig lives here',
		body: 'The set, its running total and the countdown. Until there’s a set, this board tells you the next move.'
	},
	{
		id: 'songs',
		route: '/songs',
		anchor: 'add-song',
		title: 'Start with songs',
		body: 'A name and a length is all each one needs. Audio and charts can come later.'
	},
	{
		id: 'setlists',
		route: '/setlists',
		anchor: 'new-setlist',
		title: 'Build the set',
		body: 'Drag songs in, set a target time, watch the total. Share it with one link, then rehearse it top to bottom.'
	},
	{
		id: 'practice',
		route: '/practice',
		anchor: 'practice-tabs',
		title: 'Shed on your own',
		body: 'Today fits a session to the time you have. Loop the hard part, slow it down, play along.'
	},
	{
		id: 'rig',
		route: '/rig',
		anchor: 'rig-board',
		title: 'Bring your amp',
		body: 'Your amp, or a guitar straight into an amp model, in the same headphones as the track. No DAW needed.',
		placement: 'right'
	},
	{
		id: 'bands',
		route: '/bands',
		anchor: 'new-band',
		title: 'Play with other people',
		body: 'Share songs and sets with a band, and trade demos with comments pinned to the waveform.'
	},
	{
		id: 'replay',
		route: null,
		anchor: 'replay-tour',
		title: 'That’s the tour',
		body: 'Run it again any time from here.',
		fallbackBody: 'Run it again any time from Settings.',
		placement: 'right'
	}
];

export interface TourBox {
	top: number;
	left: number;
	width: number;
	height: number;
}

/** Breathing room between the card and the anchor, and between the card and the screen edge */
const GAP = 12;
const EDGE = 12;
/** Below md the card docks; at the bottom it clears the tab bar */
const DOCK_BREAKPOINT = 768;
const DOCK_BOTTOM = 76;

/**
 * Where the card goes for a given hole. On a phone it docks to whichever end of the
 * screen the anchor isn't in. Otherwise it takes the first side of the anchor with room,
 * and sits over the bottom of the anchor when no side has any.
 */
export function placeTourCard(
	hole: TourBox | null,
	card: { width: number; height: number },
	viewport: { width: number; height: number },
	placement: TourStep['placement'] = 'bottom'
): { x: number; y: number } {
	const { width: vw, height: vh } = viewport;
	const { width: cw, height: ch } = card;
	const centerX = Math.round((vw - cw) / 2);

	if (vw < DOCK_BREAKPOINT) {
		// Judged on the part that's on screen: a board taller than the phone fills it, and
		// the card should then cover its bottom, not its top
		const shownTop = hole ? Math.max(hole.top, 0) : 0;
		const shownBottom = hole ? Math.min(hole.top + hole.height, vh) : 0;
		const anchorIsLow = (shownTop + shownBottom) / 2 > vh / 2;
		return { x: centerX, y: anchorIsLow ? EDGE : Math.max(EDGE, vh - ch - DOCK_BOTTOM) };
	}
	if (!hole) return { x: centerX, y: Math.round((vh - ch) / 2) };

	const clampX = (x: number) => Math.max(EDGE, Math.min(x, vw - cw - EDGE));
	const clampY = (y: number) => Math.max(EDGE, Math.min(y, vh - ch - EDGE));
	const midX = hole.left + hole.width / 2;
	const midY = hole.top + hole.height / 2;

	const sides = {
		bottom: { x: clampX(midX - cw / 2), y: hole.top + hole.height + GAP },
		top: { x: clampX(midX - cw / 2), y: hole.top - GAP - ch },
		right: { x: hole.left + hole.width + GAP, y: clampY(midY - ch / 2) },
		left: { x: hole.left - GAP - cw, y: clampY(midY - ch / 2) }
	};
	const order =
		placement === 'right'
			? (['right', 'bottom', 'top', 'left'] as const)
			: (['bottom', 'top', 'right', 'left'] as const);

	for (const side of order) {
		const { x, y } = sides[side];
		if (x >= EDGE && y >= EDGE && x + cw <= vw - EDGE && y + ch <= vh - EDGE) {
			return { x: Math.round(x), y: Math.round(y) };
		}
	}
	return { x: Math.round(clampX(midX - cw / 2)), y: Math.round(vh - ch - EDGE) };
}
