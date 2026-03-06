import { test, expect } from './fixtures';

test.describe('Unauthenticated redirect (AUTH-01)', () => {
	test('should redirect to login when unauthenticated user visits protected route', async ({
		browser
	}) => {
		const context = await browser.newContext({ storageState: undefined });
		try {
			const page = await context.newPage();
			await page.goto('/dashboard');
			await expect(page).toHaveURL(/\/auth/);
			const url = new URL(page.url());
			expect(url.searchParams.get('redirect')).toBe('/dashboard');
		} finally {
			await context.close();
		}
	});

	test('should preserve return URL in redirect', async ({ browser }) => {
		const context = await browser.newContext({ storageState: undefined });
		try {
			const page = await context.newPage();
			await page.goto('/songs');
			await expect(page).toHaveURL(/\/auth/);
			const url = new URL(page.url());
			expect(url.searchParams.get('redirect')).toBe('/songs');
		} finally {
			await context.close();
		}
	});
});

test.describe('Authenticated access (AUTH-02)', () => {
	test('should access dashboard without redirect when authenticated', async ({ page }) => {
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.locator('body')).toBeVisible();
	});

	test('should maintain session after page reload', async ({ page }) => {
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/dashboard/);
		await page.reload();
		await expect(page).toHaveURL(/\/dashboard/);
		await expect(page.locator('body')).toBeVisible();
	});
});

test.describe('Sign-out (AUTH-03)', () => {
	test('should redirect to auth page after signing out', async ({ page }) => {
		await page.goto('/settings');
		await page.getByRole('button', { name: /sign out/i }).click();
		await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });
	});

	test('should block access to protected routes after signing out', async ({ page }) => {
		await page.goto('/settings');
		await page.getByRole('button', { name: /sign out/i }).click();
		await expect(page).toHaveURL(/\/auth/, { timeout: 10000 });
		await page.goto('/dashboard');
		await expect(page).toHaveURL(/\/auth/);
	});
});
