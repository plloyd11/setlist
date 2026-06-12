/**
 * Per-song practice player E2E tests (PRACTICE-01..02).
 *
 * REQUIRES migrations 20260611220000_create_song_audio.sql and
 * 20260612000000_create_song_files.sql to be applied.
 *
 * Audio playback assertions stay shallow (player chrome renders, transport
 * enables) — headless Chromium audio output is not asserted.
 */
import { test, expect } from './fixtures';
import { createBand, createSong, createSongAudio, createSongFile } from './helpers/factories';
import { safeDelete, cleanupSongAudio, cleanupSongFiles } from './helpers/cleanup';
import { createSecondUser } from './helpers/multi-user';
import { adminClient } from './helpers/supabase-admin';

test.describe('Practice player (PRACTICE-01)', () => {
	test('owner reaches practice from the panel; player, mix select, and chart render', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Practice Song' });
		await createSongAudio(song.id, { label: 'Full mix' });
		await createSongAudio(song.id, { label: 'No guitar' });
		await createSongFile(song.id, { label: 'Tab' });

		try {
			await page.getByText('Practice Song').click();
			const panel = page.getByRole('dialog');
			await expect(panel).toBeVisible();

			await panel.getByRole('link', { name: 'Practice' }).click();
			await expect(page).toHaveURL(new RegExp(`/songs/${song.id}/practice`));
			await expect(page.getByRole('heading', { name: 'Practice Song' })).toBeVisible();

			// Two variants -> the mix selector shows both, player becomes playable
			const mixSelect = page.getByLabel('Mix');
			await expect(mixSelect).toBeVisible();
			await expect(mixSelect.locator('option')).toHaveCount(2);
			await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 10_000 });

			// Switching mixes remounts the player without breaking it
			await mixSelect.selectOption({ label: 'No guitar' });
			await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 10_000 });

			// The chart is listed; PDFs open the inline viewer
			await page.getByRole('button', { name: 'Tab', exact: true }).click();
			await expect(page.locator('iframe[title^="Chart:"]')).toBeVisible();
			await expect(page.getByRole('link', { name: 'Open in new tab' })).toBeVisible();

			// Hostile ?from= values fall back to /songs instead of leaving the app
			await page.goto(`/songs/${song.id}/practice?from=//evil.example`);
			await expect(page.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/songs');
			await page.goto(`/songs/${song.id}/practice?from=/\\evil.example`);
			await expect(page.getByRole('link', { name: 'Back' })).toHaveAttribute('href', '/songs');

			// Malformed song ids 404 cleanly
			const resp = await page.goto(`/songs/not-a-uuid/practice`);
			expect(resp?.status()).toBe(404);

			// Back link returns to the songs library (the ?from= entry point)
			await page.goto(`/songs/${song.id}/practice?from=/songs`);
			await page.getByRole('link', { name: 'Back' }).click();
			await expect(page).toHaveURL(/\/songs$/);
		} finally {
			await cleanupSongAudio(song.id);
			await cleanupSongFiles(song.id);
			await safeDelete('songs', song.id);
		}
	});
});

test.describe('Practice player for band members (PRACTICE-02)', () => {
	test('band member practices a band-linked song with a working back link', async ({
		page,
		browser,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);
		const song = await createSong(page, testUser.id, { title: 'Band Practice Song' });
		await createSongAudio(song.id, { label: 'Full mix' });
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
			await userB.page.getByText('Band Practice Song').click();
			await userB.page.getByRole('dialog').getByRole('link', { name: 'Practice' }).click();

			// RLS lets the member load the page; audio signs and plays
			await expect(userB.page).toHaveURL(new RegExp(`/songs/${song.id}/practice`));
			await expect(userB.page.getByRole('heading', { name: 'Band Practice Song' })).toBeVisible();
			await expect(userB.page.getByRole('button', { name: 'Play' })).toBeEnabled({
				timeout: 10_000
			});

			// Back returns to the band songs page it was entered from
			await userB.page.getByRole('link', { name: 'Back' }).click();
			await expect(userB.page).toHaveURL(new RegExp(`/bands/${band.id}/songs`));
		} finally {
			await userB.cleanup();
			await cleanupSongAudio(song.id);
			await safeDelete('songs', song.id);
			await safeDelete('bands', band.id);
		}
	});
});
