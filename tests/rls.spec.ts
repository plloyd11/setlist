import { test, expect } from './fixtures';
import { createSecondUser } from './helpers/multi-user';
import { createSong, createSetlist, createBand } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';
import { adminClient } from './helpers/supabase-admin';
import crypto from 'node:crypto';

test.describe('Song data isolation (RLS-01)', () => {
	test('should not show another user\'s songs in the song library', async ({
		page,
		browser,
		testUser
	}) => {
		// User A creates a song
		const song = await createSong(page, testUser.id, { title: 'User A Private Song' });

		// User B logs in via a separate browser context
		const userB = await createSecondUser(browser);
		try {
			// User B navigates to their own song library
			await userB.page.goto('/songs');
			// Wait for the page to load
			await userB.page.waitForLoadState('networkidle');

			// User A's song should NOT appear in User B's library
			await expect(userB.page.getByText('User A Private Song')).not.toBeVisible();
		} finally {
			await userB.cleanup();
			await safeDelete('songs', song.id);
		}
	});
});

test.describe('Setlist data isolation (RLS-02)', () => {
	test('should block access to another user\'s setlist via direct URL', async ({
		page,
		browser,
		testUser
	}) => {
		// User A creates a setlist
		const setlist = await createSetlist(page, testUser.id, { name: 'Private Setlist' });

		// User B logs in via a separate browser context
		const userB = await createSecondUser(browser);
		try {
			// User B navigates directly to User A's setlist
			await userB.page.goto(`/setlists/${setlist.id}`);

			// The server load filters by user_id -- RLS blocks, throws 404
			// User B should NOT see the setlist name
			await expect(userB.page.locator('body')).not.toContainText('Private Setlist');

			// Should show a not-found error page
			await expect(userB.page.getByText(/not found/i)).toBeVisible();
		} finally {
			await userB.cleanup();
			await safeDelete('setlists', setlist.id);
		}
	});
});

test.describe('Unauthenticated shared access (RLS-03)', () => {
	test('should allow unauthenticated user to view a shared setlist', async ({
		page,
		browser,
		testUser
	}) => {
		// User A creates a setlist and enables sharing via admin API
		const setlist = await createSetlist(page, testUser.id, { name: 'Shared Gig Setlist' });
		const shareToken = crypto.randomUUID();

		const { error: updateError } = await adminClient
			.from('setlists')
			.update({ share_token: shareToken })
			.eq('id', setlist.id);

		if (updateError) throw new Error(`Failed to set share_token: ${updateError.message}`);

		// Open an unauthenticated browser context (no stored auth)
		const unauthContext = await browser.newContext({ storageState: undefined });
		try {
			const unauthPage = await unauthContext.newPage();

			// Navigate to the shared setlist link
			await unauthPage.goto(`/share/${shareToken}`);

			// Setlist name should be visible without authentication
			await expect(unauthPage.getByText('Shared Gig Setlist')).toBeVisible();
		} finally {
			await unauthContext.close();
			await safeDelete('setlists', setlist.id);
		}
	});

	test('should block unauthenticated user from accessing protected routes', async ({
		browser
	}) => {
		// Open an unauthenticated browser context
		const unauthContext = await browser.newContext({ storageState: undefined });
		try {
			const unauthPage = await unauthContext.newPage();

			// Navigate to /dashboard -- should redirect to /auth
			await unauthPage.goto('/dashboard');
			await expect(unauthPage).toHaveURL(/\/auth/);

			// Navigate to /songs -- should redirect to /auth
			await unauthPage.goto('/songs');
			await expect(unauthPage).toHaveURL(/\/auth/);
		} finally {
			await unauthContext.close();
		}
	});
});

test.describe('Band membership enforcement (RLS-04)', () => {
	test('should block non-member from accessing band data', async ({
		page,
		browser,
		testUser
	}) => {
		// User A creates a band
		const band = await createBand(page, testUser.id, { name: 'Members Only Band' });

		// User C (non-member) logs in via a separate browser context
		const userC = await createSecondUser(browser);
		try {
			// User C navigates directly to the band page
			await userC.page.goto(`/bands/${band.id}`);

			// Band layout.server.ts throws error(404, 'Band not found') because
			// RLS blocks the query for non-members (band_members check via user_band_ids())
			await expect(userC.page.getByText(/not found/i)).toBeVisible();
		} finally {
			await userC.cleanup();
			await safeDelete('bands', band.id);
		}
	});
});
