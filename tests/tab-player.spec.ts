import { test, expect } from './fixtures';
import { createSong, createSongFile, createSongTabFile } from './helpers/factories';
import { cleanupSongFiles, safeDelete } from './helpers/cleanup';

test.describe('Tab player', () => {
	test('opens a Guitar Pro file on the shed screen and renders its tab', async ({
		page,
		testUser
	}) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		const song = await createSong(page, testUser.id, { title: 'Tab Song' });
		try {
			await createSongTabFile(song.id, { label: 'Lead tab' });
			await page.goto(`/songs/${song.id}/practice`);

			const player = page.getByRole('region', { name: 'Tab player' });
			await expect(player).toBeVisible();
			await expect(player.locator('.at-surface svg').first()).toBeVisible({ timeout: 20_000 });
			await expect(player.getByRole('button', { name: 'Play tab' })).toBeEnabled({
				timeout: 20_000
			});

			await expect(player.getByLabel('Track').locator('option')).toHaveText([
				'Lead Guitar',
				'Bass'
			]);
			expect(errors).toEqual([]);
		} finally {
			await cleanupSongFiles(song.id);
			await safeDelete('songs', song.id);
		}
	});

	test('plays, and its controls answer', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Controls Song' });
		try {
			await createSongTabFile(song.id);
			await page.goto(`/songs/${song.id}/practice`);
			const player = page.getByRole('region', { name: 'Tab player' });
			const play = player.getByRole('button', { name: 'Play tab' });
			await expect(play).toBeEnabled({ timeout: 20_000 });

			await play.click();
			await expect(player.getByRole('button', { name: 'Pause tab' })).toBeVisible();
			await expect
				.poll(async () => player.getByTestId('tab-time').innerText(), { timeout: 15_000 })
				.not.toMatch(/^0:00 \/ 0:00/);
			await player.getByRole('button', { name: 'Pause tab' }).click();
			await expect(play).toBeVisible();

			for (const name of ['Solo', 'Mute', 'Loop', 'Count-in', 'Click']) {
				const toggle = player.getByRole('button', { name, exact: true });
				await toggle.click();
				await expect(toggle).toHaveAttribute('aria-pressed', 'true');
				await toggle.click();
				await expect(toggle).toHaveAttribute('aria-pressed', 'false');
			}
			await player.getByLabel('Tab speed').selectOption('0.5');
			await expect(player.getByLabel('Tab speed')).toHaveValue('0.5');

			// Switching track redraws the sheet without breaking it
			await player.getByLabel('Track').selectOption({ label: 'Bass' });
			await expect(player.locator('.at-surface svg').first()).toBeVisible();

			// With no audio mix on this song, Space drives the tab
			await page.getByRole('heading', { name: 'Controls Song' }).click();
			await page.keyboard.press(' ');
			await expect(player.getByRole('button', { name: 'Pause tab' })).toBeVisible();
			await page.keyboard.press(' ');
			await expect(play).toBeVisible();
		} finally {
			await cleanupSongFiles(song.id);
			await safeDelete('songs', song.id);
		}
	});

	test('a damaged file says so and offers the download', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Broken Tab' });
		try {
			await createSongTabFile(song.id, { contents: Buffer.from('this is not a guitar pro file') });
			await page.goto(`/songs/${song.id}/practice`);
			const player = page.getByRole('region', { name: 'Tab player' });
			await expect(player.getByRole('alert')).toContainText("Couldn't open this file", {
				timeout: 20_000
			});
			await expect(player.getByRole('link', { name: 'Download it instead' })).toBeVisible();
		} finally {
			await cleanupSongFiles(song.id);
			await safeDelete('songs', song.id);
		}
	});

	test('PDFs still use the document viewer', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Both Kinds' });
		try {
			await createSongFile(song.id, { label: 'Chords' });
			await createSongTabFile(song.id, { label: 'Tab' });
			await page.goto(`/songs/${song.id}/practice`);

			await expect(page.locator('iframe[title^="Chart:"]')).toBeVisible();
			await page.getByRole('button', { name: 'Tab', exact: true }).click();
			await expect(page.getByRole('region', { name: 'Tab player' })).toBeVisible();
			await expect(page.locator('iframe[title^="Chart:"]')).toHaveCount(0);
		} finally {
			await cleanupSongFiles(song.id);
			await safeDelete('songs', song.id);
		}
	});
});
