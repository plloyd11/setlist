import type { Browser } from '@playwright/test';
import { createTestUser, deleteTestUser } from './auth';

/**
 * Create a second authenticated user in a fresh browser context.
 * Uses Date.now() as workerIndex to avoid email collisions with worker-scoped users.
 * Returns { page, user, cleanup } where cleanup closes the context and deletes the user.
 */
export async function createSecondUser(browser: Browser) {
	const user = await createTestUser(Date.now());

	// Open fresh browser context with no existing auth state
	const context = await browser.newContext({ storageState: undefined });
	const page = await context.newPage();

	// Authenticate via real login UI
	await page.goto('/auth');
	await page.getByLabel('Email').fill(user.email);
	await page.getByLabel('Password').fill(user.password);
	await page.getByRole('button', { name: /sign in with email/i }).click();
	await page.waitForURL('**/dashboard');

	const cleanup = async () => {
		await context.close();
		await deleteTestUser(user.id);
	};

	return { page, user, cleanup };
}
