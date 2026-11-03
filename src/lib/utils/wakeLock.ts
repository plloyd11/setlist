/**
 * Keeps the screen on while practicing: a phone on a music stand must not sleep
 * mid-song. The browser drops the lock whenever the page is hidden, so it's
 * re-requested on return. Unsupported or refused requests are ignored, since the
 * screen sleeping is an annoyance and not a failure.
 */
export function createWakeLock() {
	let sentinel: WakeLockSentinel | null = null;
	let wanted = false;

	async function acquire() {
		try {
			sentinel = (await navigator.wakeLock?.request('screen')) ?? null;
		} catch {
			sentinel = null;
		}
	}

	function handleVisibility() {
		if (wanted && document.visibilityState === 'visible') void acquire();
	}

	return {
		start() {
			if (wanted) return;
			wanted = true;
			document.addEventListener('visibilitychange', handleVisibility);
			void acquire();
		},
		stop() {
			wanted = false;
			document.removeEventListener('visibilitychange', handleVisibility);
			void sentinel?.release().catch(() => {});
			sentinel = null;
		}
	};
}
