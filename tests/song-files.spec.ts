/**
 * Song charts & tabs E2E tests (FILE-01..02).
 *
 * REQUIRES migration 20260612000000_create_song_files.sql to be applied
 * (song_files table + the private 'song-files' storage bucket).
 *
 * Uploads go through the real dropzone (signed-URL PUT direct to storage,
 * then the uploadFile action records the row) — same flow as production.
 */
import { test, expect } from './fixtures';
import { createBand, createSong, createSongFile } from './helpers/factories';
import { safeDelete, cleanupSongFiles } from './helpers/cleanup';
import { createSecondUser } from './helpers/multi-user';
import { adminClient } from './helpers/supabase-admin';

const PDF_FIXTURE = 'tests/fixtures/sample.pdf';

test.describe('Song charts upload and manage (FILE-01)', () => {
	test('owner uploads a chart via the panel, renames its label, and deletes it', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Chart Song' });

		try {
			await page.getByText('Chart Song').click();
			const panel = page.getByRole('dialog');
			await expect(panel).toBeVisible();
			await expect(panel.getByText('No charts yet')).toBeVisible();

			// The panel has two hidden file inputs — the chart one accepts .pdf
			await panel.locator('input[type="file"][accept*=".pdf"]').setInputFiles(PDF_FIXTURE);
			await panel.getByRole('button', { name: 'Upload chart' }).click();

			// Row appears after the storage PUT + metadata save round-trip
			await expect(panel.getByText('sample.pdf')).toBeVisible({ timeout: 15_000 });
			await expect(panel.getByText('1 chart')).toBeVisible();

			// Rename the label (the only mutable field)
			await panel.getByLabel('Rename sample.pdf').click();
			await panel.getByPlaceholder('Label — e.g. "Rhythm tab"').fill('Chorus chart');
			await panel.getByLabel('Save label').click();
			await expect(panel.getByText('Chorus chart')).toBeVisible();

			// Delete through the confirm dialog
			await panel.getByLabel('Delete Chorus chart').click();
			await page.locator('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(panel.getByText('No charts yet')).toBeVisible();
		} finally {
			await cleanupSongFiles(song.id);
			await safeDelete('songs', song.id);
		}
	});
});

test.describe('Song charts band visibility (FILE-02)', () => {
	test('band member sees charts read-only and can open them', async ({
		page,
		browser,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);
		const song = await createSong(page, testUser.id, { title: 'Shared Chart Song' });
		const file = await createSongFile(song.id, { label: 'Lead sheet' });
		const userB = await createSecondUser(browser);

		try {
			const { error: linkError } = await adminClient
				.from('band_songs')
				.insert({ band_id: band.id, song_id: song.id, added_by: testUser.id });
			if (linkError) throw new Error(`Setup band_songs failed: ${linkError.message}`);
			const { error: memberError } = await adminClient
				.from('band_members')
				.insert({ band_id: band.id, user_id: userB.user.id, role: 'member' });
			if (memberError) throw new Error(`Setup band_members failed: ${memberError.message}`);

			await userB.page.goto(`/bands/${band.id}/songs`);
			await userB.page.getByText('Shared Chart Song').click();
			const panel = userB.page.getByRole('dialog');
			await expect(panel).toBeVisible();

			// Chart is listed, but a non-owner gets no manage controls or upload zone
			await expect(panel.getByText('Lead sheet')).toBeVisible();
			await expect(panel.getByLabel('Rename Lead sheet')).not.toBeVisible();
			await expect(panel.getByLabel('Delete Lead sheet')).not.toBeVisible();
			await expect(panel.getByRole('button', { name: 'Upload chart' })).not.toBeVisible();

			// Open mints a signed URL through the member's RLS-scoped client
			const popupPromise = userB.page.waitForEvent('popup');
			await panel.getByLabel('Open Lead sheet').click();
			const popup = await popupPromise;
			await popup.waitForURL(/\/storage\/v1\/object\/sign\//);
		} finally {
			await userB.cleanup();
			await safeDelete('song_files', file.id);
			await cleanupSongFiles(song.id);
			await safeDelete('songs', song.id);
			await safeDelete('bands', band.id);
		}
	});
});
