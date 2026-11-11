/**
 * Onboarding tour state (Svelte 5 runes module).
 *
 * One tour for the whole app: the replay buttons start it, TourOverlay in the app
 * layout draws it. `origin` is where the musician was, so the tour can put them back.
 */
import { browser } from '$app/env';
import { TOUR_STEPS } from '#lib/utils/tour.js';

export const tour = $state({ active: false, index: 0, origin: '/dashboard' });

// user_metadata on the page goes stale once the tour marks itself seen, so the layout
// remounting mid-visit must not start it a second time
let autoStarted = false;

/** True the first time it's asked, per page load */
export function claimAutoStart(): boolean {
	if (autoStarted) return false;
	autoStarted = true;
	return true;
}

export function startTour() {
	if (!browser || tour.active) return;
	tour.origin = window.location.pathname + window.location.search;
	tour.index = 0;
	tour.active = true;
}

export function nextStep() {
	if (tour.index < TOUR_STEPS.length - 1) tour.index += 1;
}

export function prevStep() {
	if (tour.index > 0) tour.index -= 1;
}

export function endTour() {
	tour.active = false;
}
