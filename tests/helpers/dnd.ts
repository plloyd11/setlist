import type { Page, Locator } from '@playwright/test';

interface DragOptions {
	/** Intermediate mouse.move steps (default: 10) */
	steps?: number;
	/** Hold time in ms after mousedown before move (default: 150) */
	holdMs?: number;
	/** Pause in ms after move before mouseup (default: 300) */
	pauseMs?: number;
	/**
	 * Vertical offset from the target's center for the drop point. For
	 * reorders, dropping exactly on another item's center is the swap
	 * boundary — pass e.g. -20 to land clearly above it.
	 */
	offsetY?: number;
}

/**
 * Drag-and-drop helper using raw pointer events.
 *
 * Playwright's built-in `locator.dragTo()` fails silently with svelte-dnd-action
 * because the library uses custom pointer event handling. This helper dispatches
 * mouse.down/move/up with configurable timing so svelte-dnd-action transitions
 * through idle -> consider -> finalize.
 *
 * @param page - Playwright Page instance
 * @param source - Locator for the element to drag
 * @param target - Locator for the drop target
 * @param options - Timing/step overrides
 */
export async function dragAndDrop(
	page: Page,
	source: Locator,
	target: Locator,
	options: DragOptions = {}
): Promise<void> {
	const { steps = 10, holdMs = 150, pauseMs = 300, offsetY = 0 } = options;

	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();
	if (!sourceBox || !targetBox) {
		throw new Error('Could not get bounding box for source or target');
	}

	const sx = sourceBox.x + sourceBox.width / 2;
	const sy = sourceBox.y + sourceBox.height / 2;
	const tx = targetBox.x + targetBox.width / 2;
	const ty = targetBox.y + targetBox.height / 2 + offsetY;

	await page.mouse.move(sx, sy);
	await page.mouse.down();
	await page.waitForTimeout(holdMs);
	// Nudge past svelte-dnd-action's 3px drag-start threshold
	await page.mouse.move(sx + 6, sy + 6, { steps: 3 });
	await page.waitForTimeout(100);
	// Travel in two chunks with pauses so the library's ~100ms zone observer
	// ticks while the pointer is en route
	await page.mouse.move((sx + tx) / 2, (sy + ty) / 2, { steps });
	await page.waitForTimeout(100);
	await page.mouse.move(tx, ty, { steps });
	await page.waitForTimeout(100);
	// Wiggle inside the zone so the consider state registers before drop
	await page.mouse.move(tx + 4, ty + 4, { steps: 2 });
	await page.waitForTimeout(pauseMs);
	await page.mouse.up();
	// Let svelte-dnd-action finalize and the app persist the change
	await page.waitForTimeout(200);
}
