import { test, expect } from './fixtures';
import { createSong } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';

test('smoke: app loads and user is authenticated', async ({ page }) => {
	await page.goto('/dashboard');
	await expect(page).toHaveURL(/dashboard/);
	// If we reach here: webServer started, auth worked, storageState injected
});

test('smoke: factory creates a song visible in the UI', async ({ page, testUser }) => {
	const song = await createSong(page, testUser.id, { title: 'Smoke Test Song' });
	await expect(page.getByText('Smoke Test Song')).toBeVisible();
	// Per-test cleanup (per user decision)
	await safeDelete('songs', song.id);
});
