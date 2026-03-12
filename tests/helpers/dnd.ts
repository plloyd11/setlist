import type { Page, Locator } from '@playwright/test';

interface DragOptions {
	/** Intermediate mouse.move steps (default: 10) */
	steps?: number;
	/** Hold time in ms after mousedown before move (default: 100) */
	holdMs?: number;
	/** Pause in ms after move before mouseup (default: 100) */
	pauseMs?: number;
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
	const { steps = 10, holdMs = 100, pauseMs = 100 } = options;

	const sourceBox = await source.boundingBox();
	const targetBox = await target.boundingBox();
	if (!sourceBox || !targetBox) {
		throw new Error('Could not get bounding box for source or target');
	}

	const sx = sourceBox.x + sourceBox.width / 2;
	const sy = sourceBox.y + sourceBox.height / 2;
	const tx = targetBox.x + targetBox.width / 2;
	const ty = targetBox.y + targetBox.height / 2;

	await page.mouse.move(sx, sy);
	await page.mouse.down();
	await page.waitForTimeout(holdMs);
	await page.mouse.move(tx, ty, { steps });
	await page.waitForTimeout(pauseMs);
	await page.mouse.up();
}
