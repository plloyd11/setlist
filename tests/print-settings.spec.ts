import { test, expect } from './fixtures';
import { createSong, createSetlist } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';
import { adminClient } from './helpers/supabase-admin';

test.describe('Print settings - Editor (PRNT-01)', () => {
	test('content toggles update the preview live', async ({ page, testUser }) => {
		const setlist = await createSetlist(page, testUser.id, { name: 'Print Toggle Set' });
		const song = await createSong(page, testUser.id, {
			title: 'Print Me',
			notes: 'capo 3'
		});
		await adminClient
			.from('setlist_songs')
			.insert({ setlist_id: setlist.id, song_id: song.id, position: 0 });

		await page.goto(`/setlists/${setlist.id}/print`);

		// Defaults show numbering and notes on the sheet
		const sheet = page.locator('.printable-sheet');
		await expect(sheet.getByText('Print Me')).toBeVisible();
		await expect(sheet.getByText('capo 3')).toBeVisible();
		await expect(sheet.getByText('1', { exact: true })).toBeVisible();

		await page.getByLabel('Song notes').uncheck();
		await expect(sheet.getByText('capo 3')).not.toBeVisible();

		await page.getByLabel('Song numbers').uncheck();
		await expect(sheet.getByText('1', { exact: true })).not.toBeVisible();

		await page.getByLabel('Setlist name').uncheck();
		await expect(sheet.getByText('Print Toggle Set')).not.toBeVisible();

		await page.getByLabel('Venue & date').uncheck();
		await expect(sheet.getByText(setlist.venue)).not.toBeVisible();

		await page.getByLabel('Divider lines').uncheck();
		await expect(sheet.locator('li').first()).toHaveCSS('border-bottom-style', 'none');

		await safeDelete('setlists', setlist.id);
		await safeDelete('songs', song.id);
	});

	test('settings persist after reload', async ({ page, testUser }) => {
		const setlist = await createSetlist(page, testUser.id, { name: 'Print Persist Set' });

		await page.goto(`/setlists/${setlist.id}/print`);

		// Auto-save is debounced -- wait for the POST to land before reloading
		const saved = page.waitForResponse(
			(r) => r.request().method() === 'POST' && r.url().includes('updatePrintSettings')
		);
		await page.getByLabel('Song notes').uncheck();
		await page.getByRole('radio', { name: 'Mono' }).click();
		await page.getByRole('radio', { name: 'Left' }).click();
		await saved;

		await page.reload();
		await expect(page.getByLabel('Song notes')).not.toBeChecked();
		await expect(page.getByRole('radio', { name: 'Mono' })).toHaveAttribute('aria-checked', 'true');
		await expect(page.getByRole('radio', { name: 'Left' })).toHaveAttribute('aria-checked', 'true');

		await safeDelete('setlists', setlist.id);
	});
});

test.describe('Print settings - Share page (PRNT-02)', () => {
	test('public share page renders with saved print settings', async ({
		page,
		testUser,
		browser
	}) => {
		const setlist = await createSetlist(page, testUser.id, { name: 'Print Share Set' });
		const song = await createSong(page, testUser.id, {
			title: 'Styled Song',
			notes: 'quiet intro'
		});
		await adminClient
			.from('setlist_songs')
			.insert({ setlist_id: setlist.id, song_id: song.id, position: 0 });
		// Write settings directly: the editor auto-save is debounced and this
		// test exercises the share rendering, not the editor
		await adminClient
			.from('setlists')
			.update({
				print_settings: {
					font_family: 'mono',
					font_size: 24,
					line_spacing: 1.5,
					show_notes: false,
					show_numbers: true,
					show_logo: true,
					logo_size: 'md'
				}
			})
			.eq('id', setlist.id);

		// Enable sharing and grab the public URL (same flow as SETL-08)
		await page.goto(`/setlists/${setlist.id}`);
		await page.getByRole('button', { name: 'Share', exact: true }).click();
		const shareUrl = await page.locator('span.truncate', { hasText: '/share/' }).innerText();

		const publicContext = await browser.newContext({ storageState: undefined });
		const publicPage = await publicContext.newPage();
		await publicPage.goto(shareUrl);

		const sheet = publicPage.locator('.printable-sheet');
		await expect(sheet.getByText('Styled Song')).toBeVisible();
		await expect(sheet.getByText('quiet intro')).not.toBeVisible();
		await expect(sheet.getByText('Styled Song')).toHaveCSS('font-family', /Courier/);

		await publicContext.close();
		await safeDelete('setlists', setlist.id);
		await safeDelete('songs', song.id);
	});
});
