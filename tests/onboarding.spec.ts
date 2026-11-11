import { test, expect } from './fixtures';
import { createSecondUser } from './helpers/multi-user';

/**
 * Every other test user is created with the tour already seen (see createTestUser),
 * so only the accounts made here with `tourSeen: false` get a real first visit.
 */
test.describe('Onboarding tour', () => {
	test('walks a new account through the main pages, once', async ({ browser }) => {
		const { page, cleanup } = await createSecondUser(browser, { tourSeen: false });
		try {
			const tour = page.getByRole('dialog');
			const next = tour.getByRole('button', { name: 'Next' });

			await expect(tour.getByRole('heading', { name: 'Your next gig lives here' })).toBeVisible();
			await expect(tour.getByRole('button', { name: 'Back' })).toBeHidden();

			await next.click();
			await expect(page).toHaveURL(/\/songs$/);
			await expect(tour.getByRole('heading', { name: 'Start with songs' })).toBeVisible();

			await next.click();
			await expect(page).toHaveURL(/\/setlists$/);
			await expect(tour.getByRole('heading', { name: 'Build the set' })).toBeVisible();

			// Back returns to the page before, not just the card before
			await tour.getByRole('button', { name: 'Back' }).click();
			await expect(page).toHaveURL(/\/songs$/);
			await next.click();

			await next.click();
			await expect(page).toHaveURL(/\/practice$/);
			await expect(tour.getByRole('heading', { name: 'Shed on your own' })).toBeVisible();

			await next.click();
			await expect(page).toHaveURL(/\/rig$/);
			await expect(tour.getByRole('heading', { name: 'Bring your amp' })).toBeVisible();

			await next.click();
			await expect(page).toHaveURL(/\/bands$/);
			await expect(tour.getByRole('heading', { name: 'Play with other people' })).toBeVisible();

			await next.click();
			await expect(tour.getByRole('heading', { name: 'That’s the tour' })).toBeVisible();
			await expect(tour.getByText('Run it again any time from here.')).toBeVisible();
			await expect(tour.getByRole('button', { name: 'Skip tour' })).toBeHidden();

			await tour.getByRole('button', { name: 'Done' }).click();
			await expect(tour).toBeHidden();
			await expect(page).toHaveURL(/\/dashboard$/);

			// Seen is on the account, so it doesn't come back
			await page.reload();
			await page.waitForLoadState('networkidle');
			await expect(page.getByRole('heading', { name: 'Build your first set' })).toBeVisible();
			await expect(tour).toBeHidden();
		} finally {
			await cleanup();
		}
	});

	test('skipping counts as seen', async ({ browser }) => {
		const { page, cleanup } = await createSecondUser(browser, { tourSeen: false });
		try {
			const tour = page.getByRole('dialog');
			await expect(tour).toBeVisible();

			await tour.getByRole('button', { name: 'Skip tour' }).click();
			await expect(tour).toBeHidden();
			await expect(page).toHaveURL(/\/dashboard$/);

			// Let the write that marks it seen land before reloading
			await page.waitForLoadState('networkidle');
			await page.reload();
			await page.waitForLoadState('networkidle');
			await expect(page.getByRole('heading', { name: 'Build your first set' })).toBeVisible();
			await expect(tour).toBeHidden();
		} finally {
			await cleanup();
		}
	});

	test('replays from the rail and puts you back where you were', async ({ page }) => {
		await page.goto('/songs');
		const tour = page.getByRole('dialog');
		await expect(tour).toBeHidden();

		await page.getByRole('button', { name: 'Take the tour' }).click();
		await expect(tour.getByRole('heading', { name: 'Your next gig lives here' })).toBeVisible();
		await expect(page).toHaveURL(/\/dashboard$/);

		await page.keyboard.press('ArrowRight');
		await expect(tour.getByRole('heading', { name: 'Start with songs' })).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(tour).toBeHidden();
		await expect(page).toHaveURL(/\/songs$/);
		await expect(page.getByRole('button', { name: 'Take the tour' })).toBeFocused();
	});

	test('replays from Settings on a phone, where there is no rail', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto('/settings');
		// Only the Settings button is left: the rail's copy is hidden with the rail
		await expect(page.getByRole('button', { name: 'Take the tour' })).toHaveCount(1);

		await page.getByRole('button', { name: 'Take the tour' }).click();
		const tour = page.getByRole('dialog');
		await expect(tour.getByRole('heading', { name: 'Your next gig lives here' })).toBeVisible();

		const next = tour.getByRole('button', { name: 'Next' });
		for (let i = 0; i < 6; i++) await next.click();
		await expect(tour.getByText('Run it again any time from Settings.')).toBeVisible();

		// The card stays on screen at phone width
		const card = await tour.getByRole('heading', { name: 'That’s the tour' }).boundingBox();
		expect(card).not.toBeNull();
		expect(card!.x).toBeGreaterThanOrEqual(0);
		expect(card!.x + card!.width).toBeLessThanOrEqual(390);

		await tour.getByRole('button', { name: 'Done' }).click();
		await expect(tour).toBeHidden();
		await expect(page).toHaveURL(/\/settings$/);
	});
});
