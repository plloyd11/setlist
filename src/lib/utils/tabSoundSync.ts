import type { AlphaTabApi } from '@coderline/alphatab';

/** AirPlay can reach a couple of seconds. Anything past this is a bad estimate. */
const MAX_DELAY_MS = 3000;

/** The audio context is alphaTab's, and it isn't part of the output's public type */
function outputDelayMs(api: AlphaTabApi): number {
	const output = api.player?.output as unknown as { context?: AudioContext | null } | undefined;
	const context = output?.context;
	const seconds = (context?.outputLatency ?? 0) + (context?.baseLatency ?? 0);
	return Math.min(Math.max(seconds, 0) * 1000, MAX_DELAY_MS);
}

/**
 * alphaTab reports a position when samples leave its buffer, but a speaker plays them
 * later: about a quarter of a second over Bluetooth. So the cursor runs ahead of what
 * you hear. This holds the cursor and note highlights back by what the browser says
 * that gap is, read fresh each time so changing headphones mid-song stays right.
 *
 * Only while playing. Stopped, a click on the tab has to move the cursor at once, and
 * anything still waiting is dropped so it can't move the cursor again afterwards.
 * Browsers that don't report a latency get no delay, which is how alphaTab behaves anyway.
 */
export function alignVisualsWithSound(
	api: AlphaTabApi,
	alphaTab: typeof import('@coderline/alphatab')
): () => void {
	const timers = new Set<number>();
	let lastDue = 0;

	function cancelPending() {
		for (const timer of timers) clearTimeout(timer);
		timers.clear();
		lastDue = 0;
	}

	function afterSound(action: () => void) {
		if (api.playerState !== alphaTab.synth.PlayerState.Playing) {
			cancelPending();
			action();
			return;
		}
		const now = performance.now();
		// The reading wobbles. Never let a later update overtake an earlier one.
		const due = Math.max(now + outputDelayMs(api), lastDue);
		lastDue = due;
		const timer = window.setTimeout(() => {
			timers.delete(timer);
			action();
		}, due - now);
		timers.add(timer);
	}

	const cursor = new alphaTab.ToNextBeatAnimatingCursorHandler();
	api.customCursorHandler = {
		onAttach: (cursors) => cursor.onAttach(cursors),
		onDetach: (cursors) => cursor.onDetach(cursors),
		placeBarCursor: (...args) => afterSound(() => cursor.placeBarCursor(...args)),
		placeBeatCursor: (...args) => afterSound(() => cursor.placeBeatCursor(...args)),
		transitionBeatCursor: (...args) => afterSound(() => cursor.transitionBeatCursor(...args))
	};

	// alphaTab has no hook for highlights, and they'd light up ahead of the sound
	const facade = api.uiFacade;
	const highlightElements = facade.highlightElements.bind(facade);
	const removeHighlights = facade.removeHighlights.bind(facade);
	facade.highlightElements = (...args) => afterSound(() => highlightElements(...args));
	facade.removeHighlights = () => afterSound(() => removeHighlights());

	return cancelPending;
}
