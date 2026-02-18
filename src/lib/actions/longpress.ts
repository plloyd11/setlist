/**
 * Svelte action that dispatches a 'longpress' CustomEvent after 500ms touch hold.
 * Cancels if touch moves more than 10px (prevents triggering during scroll).
 * Event detail includes { x, y } coordinates for context menu positioning.
 */
export function longpress(node: HTMLElement, duration = 500) {
	let timer: ReturnType<typeof setTimeout>;
	let startX: number;
	let startY: number;

	function handleTouchStart(e: TouchEvent) {
		const touch = e.touches[0];
		startX = touch.clientX;
		startY = touch.clientY;

		timer = setTimeout(() => {
			node.dispatchEvent(
				new CustomEvent('longpress', {
					detail: { x: touch.clientX, y: touch.clientY }
				})
			);
		}, duration);
	}

	function handleTouchMove(e: TouchEvent) {
		const touch = e.touches[0];
		const dx = Math.abs(touch.clientX - startX);
		const dy = Math.abs(touch.clientY - startY);
		if (dx > 10 || dy > 10) {
			clearTimeout(timer);
		}
	}

	function handleTouchEnd() {
		clearTimeout(timer);
	}

	node.addEventListener('touchstart', handleTouchStart, { passive: true });
	node.addEventListener('touchmove', handleTouchMove, { passive: true });
	node.addEventListener('touchend', handleTouchEnd);
	node.addEventListener('touchcancel', handleTouchEnd);

	return {
		update(newDuration: number) {
			duration = newDuration;
		},
		destroy() {
			clearTimeout(timer);
			node.removeEventListener('touchstart', handleTouchStart);
			node.removeEventListener('touchmove', handleTouchMove);
			node.removeEventListener('touchend', handleTouchEnd);
			node.removeEventListener('touchcancel', handleTouchEnd);
		}
	};
}
