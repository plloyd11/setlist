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

			// Open page with no existing auth
			const page = await browser.newPage({ storageState: undefined });
			await page.goto('/auth');
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
	storageState: ({ workerStorageState }, use) => use(workerStorageState)
});
