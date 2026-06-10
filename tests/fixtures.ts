import { test as base, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { createTestUser, deleteTestUser } from './helpers/auth';

export { expect } from '@playwright/test';

type TestUser = { id: string; email: string; password: string };

type WorkerFixtures = {
	testUser: TestUser;
	workerStorageState: string;
};

export const test = base.extend<{}, WorkerFixtures>({
	// Worker-scoped: create one test user per worker via admin API
	testUser: [
		async ({}, use, workerInfo) => {
			const user = await createTestUser(workerInfo.workerIndex);
			await use(user);
			// Teardown: delete bands first (RESTRICT), then user (CASCADE handles rest)
			await deleteTestUser(user.id);
		},
		{ scope: 'worker' }
	],

	// Worker-scoped: authenticate via real UI and save storageState
	workerStorageState: [
		async ({ browser, testUser }, use, workerInfo) => {
			const authDir = path.resolve('tests/.auth');
			fs.mkdirSync(authDir, { recursive: true });
			const fileName = path.resolve(authDir, `worker-${workerInfo.workerIndex}.json`);

			// Open page with no existing auth. Contexts created directly on the
			// raw `browser` fixture don't inherit config `use` options as of
			// Playwright 1.60, so baseURL must be passed explicitly.
			const page = await browser.newPage({
				storageState: undefined,
				baseURL: 'http://localhost:5173'
			});
			await page.goto('/auth');
			// Wait for hydration: the sign-in form relies on a client-side onsubmit
			// handler — clicking before Vite finishes serving modules (cold dev
			// server + parallel workers) falls back to a native GET submit.
			await page.waitForLoadState('networkidle');
			await page.getByLabel('Email').fill(testUser.email);
			await page.getByLabel('Password').fill(testUser.password);
			await page.getByRole('button', { name: /sign in with email/i }).click();
			await page.waitForURL('**/dashboard');

			// Wait for hydration to complete
			await expect(page.locator('body')).toBeVisible();

			// Save authenticated state
			await page.context().storageState({ path: fileName });
			await page.close();

			await use(fileName);
		},
		{ scope: 'worker' }
	],

	// Override built-in storageState so all tests in the worker use the authenticated state
	storageState: ({ workerStorageState }, use) => use(workerStorageState),

	// Make page.goto wait for hydration. Nearly every page relies on JS click/
	// submit handlers; interacting before Vite finishes serving a route's
	// modules (cold dev server compiles on first visit) silently no-ops clicks
	// or falls back to native form submits.
	page: async ({ page }, use) => {
		const originalGoto = page.goto.bind(page);
		page.goto = async (url, options) => {
			const response = await originalGoto(url, options);
			await page.waitForLoadState('networkidle');
			return response;
		};
		await use(page);
	}
});
