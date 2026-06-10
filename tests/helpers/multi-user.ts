import type { Browser } from '@playwright/test';
import { createTestUser, deleteTestUser } from './auth';

/**
 * Create a second authenticated user in a fresh browser context.
 * Uses Date.now() as workerIndex to avoid email collisions with worker-scoped users.
 * Returns { page, user, cleanup } where cleanup closes the context and deletes the user.
 */
export async function createSecondUser(browser: Browser) {
	const user = await createTestUser(Date.now());

	// Open fresh browser context with no existing auth state. Contexts created
	// directly on the raw `browser` fixture don't inherit config `use` options
	// as of Playwright 1.60, so baseURL must be passed explicitly.
	const context = await browser.newContext({
		storageState: undefined,
		baseURL: 'http://localhost:5173'
	});
	const page = await context.newPage();

	// Authenticate via real login UI. Wait for hydration first: the sign-in
	// form relies on a client-side onsubmit handler — clicking early falls
	// back to a native GET submit.
	await page.goto('/auth');
	await page.waitForLoadState('networkidle');
	await page.getByLabel('Email').fill(user.email);
	await page.getByLabel('Password').fill(user.password);
	await page.getByRole('button', { name: /sign in with email/i }).click();
	await page.waitForURL('**/dashboard');

	// Match the main fixture's goto behavior: wait for hydration so JS click/
	// submit handlers are attached before tests interact (see fixtures.ts)
	const originalGoto = page.goto.bind(page);
	page.goto = async (url, options) => {
		const response = await originalGoto(url, options);
		await page.waitForLoadState('networkidle');
		return response;
	};

	const cleanup = async () => {
		await context.close();
		await deleteTestUser(user.id);
	};

	return { page, user, cleanup };
}
