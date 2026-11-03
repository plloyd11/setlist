export type PracticeAction =
	| 'playPause'
	| 'toggleLoop'
	| 'pinLoopStart'
	| 'pinLoopEnd'
	| 'back'
	| 'forward'
	| 'nextSong'
	| 'previousSong'
	| 'toggleMetronome';

/**
 * Which practice shortcut, if any, a window-level keydown means. Focus usually
 * sits on the last thing clicked (the waveform, a knob, a button), so controls
 * only keep the keys they actually use: sliders claim theirs with
 * preventDefault, and buttons and links own Space and Enter. Everything else
 * still works, so clicking the waveform and then pressing `[` pins the loop.
 */
export function practiceShortcut(e: KeyboardEvent): PracticeAction | null {
	// The modifier bail keeps Cmd+[ (browser Back) and friends out of our hands
	if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return null;
	const target = e.target as Element | null;
	if (target?.closest('input, textarea, select, [contenteditable], dialog')) return null;

	switch (e.key) {
		case ' ':
			return target?.closest('button, a') ? null : 'playPause';
		case 'l':
		case 'L':
			return 'toggleLoop';
		case '[':
			return 'pinLoopStart';
		case ']':
			return 'pinLoopEnd';
		case 'ArrowLeft':
			return 'back';
		case 'ArrowRight':
			return 'forward';
		case 'n':
		case 'N':
			return 'nextSong';
		case 'p':
		case 'P':
			return 'previousSong';
		case 'm':
		case 'M':
			return 'toggleMetronome';
		default:
			return null;
	}
}
