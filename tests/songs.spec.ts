import { test, expect } from './fixtures';
import { createSong } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';
import { createSecondUser } from './helpers/multi-user';

test.describe('Song Library - Empty State', () => {
	// Uses a dedicated fresh user: other tests in this worker create songs for
	// the shared worker user (some intentionally leave them behind), so the
	// shared user's library is not reliably empty regardless of test order.
	test('should show empty state when no songs exist', async ({ browser }) => {
		const freshUser = await createSecondUser(browser);
		try {
			await freshUser.page.goto('/songs');
			await expect(freshUser.page.getByText('Your song library is empty')).toBeVisible();
		} finally {
			await freshUser.cleanup();
		}
	});
});

test.describe('Song Library - Add Song (SONG-01)', () => {
	test('should add a song with title and duration', async ({ page }) => {
		await page.goto('/songs/new');

		await page.getByLabel('Title').fill('Test Song Alpha');
		await page.getByLabel('Duration').fill('3:45');
		await page.getByRole('button', { name: 'Add Song' }).click();

		// Form clears on success
		await expect(page.getByLabel('Title')).toHaveValue('');

		// Verify song appears in library
		await page.goto('/songs');
		await expect(page.getByText('Test Song Alpha')).toBeVisible();
	});
});

test.describe('Song Library - Form Validation (SONG-01 negative)', () => {
	test('should prevent submission when title is empty', async ({ page }) => {
		await page.goto('/songs/new');

		// Leave title empty, fill duration
		await page.getByLabel('Duration').fill('3:45');
		await page.getByRole('button', { name: 'Add Song' }).click();

		// HTML5 required attribute prevents submission -- still on /songs/new
		await expect(page).toHaveURL(/\/songs\/new/);
	});

	test('should prevent submission with invalid duration format', async ({ page }) => {
		await page.goto('/songs/new');

		await page.getByLabel('Title').fill('Valid Title');
		await page.getByLabel('Duration').fill('abc');
		await page.getByRole('button', { name: 'Add Song' }).click();

		// HTML5 pattern validation prevents submission -- still on /songs/new
		await expect(page).toHaveURL(/\/songs\/new/);
	});
});

test.describe('Song Library - Edit Song (SONG-02)', () => {
	test('should edit song title and duration via inline edit', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, {
			title: 'Before Edit',
			duration_seconds: 225
		});

		// Click song text to enter edit mode
		await page.getByText('Before Edit').click();

		// Fill updated values
		await page.locator('input[placeholder="Song title"]').fill('After Edit');
		await page.locator('input[placeholder="3:45"]').fill('5:00');

		// Save
		await page.getByLabel('Save').click();

		// Verify updated values
		await expect(page.getByText('After Edit')).toBeVisible();
		await expect(page.getByText('5:00')).toBeVisible();

		await safeDelete('songs', song.id);
	});
});

test.describe('Song Library - Delete Song (SONG-03)', () => {
	test('should show confirm dialog and cancel preserves song', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Song To Keep' });

		// Right-click to open context menu
		await page.getByText('Song To Keep').click({ button: 'right' });
		await page.getByText('Delete').click();

		// Confirm dialog appears
		await expect(page.locator('dialog')).toBeVisible();

		// Cancel deletion
		await page.locator('dialog').getByRole('button', { name: 'Cancel' }).click();

		// Song is still visible
		await expect(page.getByText('Song To Keep')).toBeVisible();

		await safeDelete('songs', song.id);
	});

	test('should delete song after confirming dialog', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Song To Delete' });

		// Right-click to open context menu
		await page.getByText('Song To Delete').click({ button: 'right' });
		await page.getByText('Delete').click();

		// Confirm dialog appears
		await expect(page.locator('dialog')).toBeVisible();

		// Confirm deletion
		await page.locator('dialog').getByRole('button', { name: 'Delete' }).click();

		// Song is gone
		await expect(page.getByText('Song To Delete')).not.toBeVisible();
	});

	test('should persist deletion after page reload', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Song Persists Gone' });

		// Delete via full flow
		await page.getByText('Song Persists Gone').click({ button: 'right' });
		await page.getByText('Delete').click();
		await page.locator('dialog').getByRole('button', { name: 'Delete' }).click();
		await expect(page.getByText('Song Persists Gone')).not.toBeVisible();

		// Reload and verify still gone
		await page.reload();
		await expect(page.getByText('Song Persists Gone')).not.toBeVisible();
	});
});

test.describe('Song Library - Search (SONG-04)', () => {
	test('should filter songs by title when searching', async ({ page, testUser }) => {
		const song1 = await createSong(page, testUser.id, { title: 'Alpha Tune' });
		const song2 = await createSong(page, testUser.id, { title: 'Beta Melody' });

		// Expand search
		await page.getByLabel('Toggle search').click();
		await page.getByPlaceholder('Search songs...').fill('Alpha');

		// Verify filter
		await expect(page.getByText('Alpha Tune')).toBeVisible();
		await expect(page.getByText('Beta Melody')).not.toBeVisible();

		// Clear search and verify both visible
		await page.getByPlaceholder('Search songs...').clear();
		await expect(page.getByText('Alpha Tune')).toBeVisible();
		await expect(page.getByText('Beta Melody')).toBeVisible();

		await safeDelete('songs', song1.id);
		await safeDelete('songs', song2.id);
	});
});

test.describe('Song Library - Batch Entry (SONG-05)', () => {
	test('should add multiple songs via sequential form submissions', async ({ page }) => {
		await page.goto('/songs/new');

		// Add first song
		await page.getByLabel('Title').fill('Batch One');
		await page.getByLabel('Duration').fill('2:30');
		await page.getByRole('button', { name: 'Add Song' }).click();
		await expect(page.getByLabel('Title')).toHaveValue('');

		// Add second song
		await page.getByLabel('Title').fill('Batch Two');
		await page.getByLabel('Duration').fill('4:15');
		await page.getByRole('button', { name: 'Add Song' }).click();
		await expect(page.getByLabel('Title')).toHaveValue('');

		// Verify both in library
		await page.goto('/songs');
		await expect(page.getByText('Batch One')).toBeVisible();
		await expect(page.getByText('Batch Two')).toBeVisible();
	});
});
