import { test, expect } from './fixtures';
import { createSecondUser } from './helpers/multi-user';
import { createBand, createSong } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';
import { adminClient } from './helpers/supabase-admin';
import { faker } from '@faker-js/faker';

test.describe('Band creation (BAND-01)', () => {
	test('should create a band via UI and redirect to band page', async ({ page }) => {
		const bandName = `${faker.music.genre()} ${faker.animal.type()}s`;

		await page.goto('/bands');
		await page.getByLabel('Create band').click();
		await page.getByPlaceholder('Band name...').fill(bandName);
		await page.getByRole('button', { name: 'Create' }).click();

		// Redirects to /bands/[id]
		await expect(page).toHaveURL(/\/bands\/.+/);

		// Band dashboard shows member stats
		await expect(page.getByText('Members')).toBeVisible();

		// Cleanup: extract band ID from URL
		const bandId = page.url().split('/bands/')[1].split('/')[0].split('?')[0];
		await safeDelete('bands', bandId);
	});
});

test.describe('Band invite flow (BAND-02, BAND-03)', () => {
	test('should invite a second user and they can join via invite link', async ({
		page,
		browser,
		testUser
	}) => {
		// User A creates band via factory (faster setup)
		const band = await createBand(page, testUser.id);

		// User A generates invite link
		await page.goto(`/bands/${band.id}/members`);
		await page.getByRole('button', { name: /generate invite link/i }).click();

		const inviteInput = page.locator('#invite-url-input');
		await expect(inviteInput).toBeVisible();
		const inviteUrl = await inviteInput.inputValue();

		// User B joins via invite link
		const userB = await createSecondUser(browser);
		try {
			await userB.page.goto(inviteUrl);

			// Invite page shows band name
			await expect(userB.page.getByText(band.name)).toBeVisible();

			// Accept invite
			await userB.page.getByRole('button', { name: 'Join Band' }).click();

			// Redirected to band dashboard
			await expect(userB.page).toHaveURL(new RegExp(`/bands/${band.id}`));
		} finally {
			await userB.cleanup();
			await safeDelete('bands', band.id);
		}
	});
});

test.describe('Shared band songs (BAND-04)', () => {
	test('should show shared songs to both band members', async ({ page, browser, testUser }) => {
		// Create band and add User B as member via admin API
		const band = await createBand(page, testUser.id);
		const userB = await createSecondUser(browser);

		try {
			// Add User B as band member directly via admin API
			await adminClient
				.from('band_members')
				.insert({ band_id: band.id, user_id: userB.user.id, role: 'member' });

			// Create a song for User A
			const songTitle = `Shared Song ${faker.string.alphanumeric(6)}`;
			const song = await createSong(page, testUser.id, { title: songTitle });

			// Share song to band via admin API
			await adminClient
				.from('band_songs')
				.insert({ band_id: band.id, song_id: song.id, added_by: testUser.id });

			// User A sees shared song on band songs page
			await page.goto(`/bands/${band.id}/songs`);
			await expect(page.getByText(songTitle)).toBeVisible();

			// User B also sees shared song on band songs page
			await userB.page.goto(`/bands/${band.id}/songs`);
			await expect(userB.page.getByText(songTitle)).toBeVisible();
		} finally {
			await userB.cleanup();
			await safeDelete('bands', band.id);
		}
	});
});

test.describe('Band setlist collaboration (BAND-05)', () => {
	test('should allow both members to see band setlists', async ({ page, browser, testUser }) => {
		// Create band and add User B as member via admin API
		const band = await createBand(page, testUser.id);
		const userB = await createSecondUser(browser);

		try {
			// Add User B as band member directly via admin API
			await adminClient
				.from('band_members')
				.insert({ band_id: band.id, user_id: userB.user.id, role: 'member' });

			// User A creates a setlist via UI
			const setlistName = `Set ${faker.string.alphanumeric(6)}`;
			await page.goto(`/bands/${band.id}/setlists`);
			await page.getByLabel('New setlist').click();
			await page.getByPlaceholder('Setlist name...').fill(setlistName);
			await page.getByRole('button', { name: 'Create' }).click();

			// Wait for the post-submit redirect to the setlist detail page before
			// navigating away -- an immediate goto() can cancel the form POST
			await expect(page).toHaveURL(new RegExp(`/bands/${band.id}/setlists/.+`));

			// Navigate back to setlists list to verify
			await page.goto(`/bands/${band.id}/setlists`);
			await expect(page.getByText(setlistName)).toBeVisible();

			// User B navigates to band setlists and sees the same setlist
			await userB.page.goto(`/bands/${band.id}/setlists`);
			await expect(userB.page.getByText(setlistName)).toBeVisible();
		} finally {
			await userB.cleanup();
			await safeDelete('bands', band.id);
		}
	});
});
