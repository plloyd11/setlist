import { test, expect } from './fixtures';
import { createSong, createSetlist } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';
import { adminClient } from './helpers/supabase-admin';
import { dragAndDrop } from './helpers/dnd';

test.describe('Setlist - Create (SETL-01)', () => {
	test('should create a setlist via inline form and redirect to detail page', async ({ page }) => {
		await page.goto('/setlists');
		await page.getByLabel('New setlist').click();
		await page.getByPlaceholder('Setlist name...').fill('Friday Night Gig');
		await page.getByRole('button', { name: 'Create' }).click();

		// Server action redirects to /setlists/[id]
		await expect(page).toHaveURL(/\/setlists\/.+/);
		// Verify name displayed on detail page
		await expect(page.getByText('Friday Night Gig')).toBeVisible();

		// Cleanup: extract setlist ID from URL and delete
		const setlistId = page.url().split('/setlists/')[1];
		await safeDelete('setlists', setlistId);
	});

	test('should show new setlist on list page after creation', async ({ page }) => {
		await page.goto('/setlists');
		await page.getByLabel('New setlist').click();
		await page.getByPlaceholder('Setlist name...').fill('Saturday Matinee');
		await page.getByRole('button', { name: 'Create' }).click();
		await expect(page).toHaveURL(/\/setlists\/.+/);

		// Extract ID for cleanup before navigating away
		const setlistId = page.url().split('/setlists/')[1];

		// Navigate back to list
		await page.goto('/setlists');
		await expect(page.getByText('Saturday Matinee')).toBeVisible();

		// Cleanup
		await safeDelete('setlists', setlistId);
	});
});

test.describe('Setlist - Management (SETL-07)', () => {
	test('should duplicate a setlist with (Copy) suffix', async ({ page, testUser }) => {
		const setlist = await createSetlist(page, testUser.id, { name: 'Original Set' });

		await page.goto('/setlists');
		// Hover to reveal three-dot menu (opacity-0 until hover)
		const card = page.getByText('Original Set').first();
		await card.hover();
		await page.getByLabel('Setlist options').click();
		await page.getByText('Duplicate').click();

		// Verify copy appears
		await expect(page.getByText('Original Set (Copy)')).toBeVisible();

		await safeDelete('setlists', setlist.id);
		// Also remove the copy — leftovers give later tests two "Setlist
		// options" buttons and trip strict mode
		await adminClient
			.from('setlists')
			.delete()
			.eq('user_id', testUser.id)
			.eq('name', 'Original Set (Copy)');
	});

	test('should rename a setlist via click-to-edit on card', async ({ page, testUser }) => {
		const setlist = await createSetlist(page, testUser.id, { name: 'Before Rename' });

		await page.goto('/setlists');
		// Click the setlist name to enter edit mode (click-to-edit pattern, NOT menu item)
		await page.getByText('Before Rename').click();
		// Input appears -- clear and type new name
		const nameInput = page.locator('input[type="text"]').last();
		await nameInput.clear();
		await nameInput.fill('After Rename');
		await nameInput.press('Enter');

		// Verify renamed
		await expect(page.getByText('After Rename')).toBeVisible();
		await expect(page.getByText('Before Rename')).not.toBeVisible();

		await safeDelete('setlists', setlist.id);
	});

	test('should delete a setlist after confirming dialog', async ({ page, testUser }) => {
		const setlist = await createSetlist(page, testUser.id, { name: 'Delete Me Set' });

		await page.goto('/setlists');
		// Scope the options button to this card — other cards have one too
		const card = page.getByRole('link', { name: /Delete Me Set/ });
		await card.hover();
		await card.getByLabel('Setlist options').click();
		// exact + visible: 'Delete' substring-matches card titles, and the
		// ConfirmDialog's hidden 'Delete' button still resolves in strict mode
		await page.getByText('Delete', { exact: true }).filter({ visible: true }).click();

		// Confirm dialog
		await expect(page.locator('dialog')).toBeVisible();
		await page.locator('dialog').getByRole('button', { name: 'Delete' }).click();

		// Verify deleted (scope to the card link — the dialog message still
		// embeds the name)
		await expect(page.getByRole('link', { name: /Delete Me Set/ })).not.toBeVisible();
	});

	test('should cancel delete and preserve setlist', async ({ page, testUser }) => {
		const setlist = await createSetlist(page, testUser.id, { name: 'Keep Me Set' });

		await page.goto('/setlists');
		// Scope the options button to this card — other cards have one too
		const card = page.getByRole('link', { name: /Keep Me Set/ });
		await card.hover();
		await card.getByLabel('Setlist options').click();
		// exact + visible: 'Delete' substring-matches card titles, and the
		// ConfirmDialog's hidden 'Delete' button still resolves in strict mode
		await page.getByText('Delete', { exact: true }).filter({ visible: true }).click();

		// Cancel in confirm dialog
		await expect(page.locator('dialog')).toBeVisible();
		await page.locator('dialog').getByRole('button', { name: 'Cancel' }).click();

		// Setlist still visible (scope to the card title button — the dialog
		// message still embeds the name)
		await expect(page.getByRole('button', { name: 'Keep Me Set' })).toBeVisible();

		await safeDelete('setlists', setlist.id);
	});
});

test.describe('Setlist DnD - Add Songs (SETL-02)', () => {
	test('should add a song from library to setlist via drag-and-drop', async ({
		page,
		testUser
	}) => {
		// Create setlist (navigates to /setlists/:id)
		const setlist = await createSetlist(page, testUser.id, {
			name: 'DnD Add Test',
			target_seconds: null,
			transition_seconds: 0
		});

		// Create song (navigates to /songs)
		const song = await createSong(page, testUser.id, {
			title: 'Drag Me Over',
			duration_seconds: 180
		});

		// Navigate back to the setlist detail page
		await page.goto(`/setlists/${setlist.id}`);

		// Verify empty setlist state
		await expect(page.getByText('Drag songs here to build your setlist')).toBeVisible();

		// Drag song from library panel to setlist drop zone
		const librarySong = page.getByText('Drag Me Over').first();
		const setlistZone = page.getByText('Drag songs here to build your setlist');
		await dragAndDrop(page, librarySong, setlistZone, { steps: 10 });

		// Verify song appears in setlist (empty state text should be gone)
		await expect(page.getByText('Drag songs here to build your setlist')).not.toBeVisible();
		// Song has a remove button in the setlist area
		await expect(page.getByLabel('Remove Drag Me Over from setlist')).toBeVisible();

		// Cleanup
		await safeDelete('setlists', setlist.id);
		await safeDelete('songs', song.id);
	});
});

test.describe('Setlist DnD - Reorder Songs (SETL-03)', () => {
	test('should reorder songs within setlist via drag-and-drop', async ({ page, testUser }) => {
		// Create setlist and 2 songs
		const setlist = await createSetlist(page, testUser.id, {
			name: 'Reorder Test',
			transition_seconds: 0,
			target_seconds: null
		});
		const songA = await createSong(page, testUser.id, {
			title: 'Song Alpha',
			duration_seconds: 120
		});
		const songB = await createSong(page, testUser.id, {
			title: 'Song Beta',
			duration_seconds: 180
		});

		// Pre-populate setlist with songs via admin client (isolate reorder from add behavior)
		await adminClient.from('setlist_songs').insert([
			{ setlist_id: setlist.id, song_id: songA.id, position: 0 },
			{ setlist_id: setlist.id, song_id: songB.id, position: 1 }
		]);

		await page.goto(`/setlists/${setlist.id}`);

		// Verify initial order: both songs visible with remove buttons
		await expect(page.getByLabel('Remove Song Alpha from setlist')).toBeVisible();
		await expect(page.getByLabel('Remove Song Beta from setlist')).toBeVisible();

		// Drag Song Beta above Song Alpha in the setlist zone. Scope to the rows
		// that contain remove buttons — .first() on the bare title matches the
		// library panel copy, which is a copy-on-drag source, not the setlist.
		const betaRow = page
			.locator('div')
			.filter({ has: page.getByLabel('Remove Song Beta from setlist') })
			.last();
		const alphaRow = page
			.locator('div')
			.filter({ has: page.getByLabel('Remove Song Alpha from setlist') })
			.last();
		// Drop above Alpha's center — its center is the swap boundary
		// The app persists the order via a background ?/saveOrder POST; wait for
		// that round-trip before reloading or the reload races the save
		const persisted = page.waitForResponse(
			(r) => r.request().method() === 'POST' && r.url().includes('saveOrder')
		);
		await dragAndDrop(page, betaRow, alphaRow, { steps: 15, offsetY: -20 });
		await persisted;

		// Verify new order persists after reload
		await page.reload();
		await expect(page.getByLabel('Remove Song Alpha from setlist')).toBeVisible();
		await expect(page.getByLabel('Remove Song Beta from setlist')).toBeVisible();

		// Positional assertion: Beta should now be before Alpha
		// Get all song titles in the setlist panel by checking remove button order
		const betaButton = page.getByLabel('Remove Song Beta from setlist');
		const alphaButton = page.getByLabel('Remove Song Alpha from setlist');

		// Get bounding boxes to verify visual order (Beta above Alpha)
		const betaBox = await betaButton.boundingBox();
		const alphaBox = await alphaButton.boundingBox();
		expect(betaBox).not.toBeNull();
		expect(alphaBox).not.toBeNull();
		expect(betaBox!.y).toBeLessThan(alphaBox!.y);

		// Cleanup
		await safeDelete('setlists', setlist.id);
		await safeDelete('songs', songA.id);
		await safeDelete('songs', songB.id);
	});
});

test.describe('Setlist - Timing Updates (SETL-04)', () => {
	test('should show correct total time for songs in setlist', async ({ page, testUser }) => {
		const setlist = await createSetlist(page, testUser.id, {
			name: 'Timing Test',
			transition_seconds: 0,
			target_seconds: null
		});
		const song1 = await createSong(page, testUser.id, {
			title: 'Three Min',
			duration_seconds: 180
		});
		const song2 = await createSong(page, testUser.id, { title: 'Two Min', duration_seconds: 120 });

		// Pre-populate setlist via admin
		await adminClient.from('setlist_songs').insert([
			{ setlist_id: setlist.id, song_id: song1.id, position: 0 },
			{ setlist_id: setlist.id, song_id: song2.id, position: 1 }
		]);

		await page.goto(`/setlists/${setlist.id}`);

		// Total = 180 + 120 = 300s = 5:00
		// TimingBar renders desktop + mobile layouts; the CSS-hidden duplicate
		// still resolves in strict mode, so filter to the visible one
		await expect(page.getByText('5:00').filter({ visible: true })).toBeVisible();

		// Cleanup
		await safeDelete('setlists', setlist.id);
		await safeDelete('songs', song1.id);
		await safeDelete('songs', song2.id);
	});

	test('should update total when a song is removed', async ({ page, testUser }) => {
		const setlist = await createSetlist(page, testUser.id, {
			name: 'Remove Timing Test',
			transition_seconds: 0,
			target_seconds: null
		});
		const song1 = await createSong(page, testUser.id, {
			title: 'Remove Me Song',
			duration_seconds: 180
		});
		const song2 = await createSong(page, testUser.id, {
			title: 'Stay Song',
			duration_seconds: 120
		});

		await adminClient.from('setlist_songs').insert([
			{ setlist_id: setlist.id, song_id: song1.id, position: 0 },
			{ setlist_id: setlist.id, song_id: song2.id, position: 1 }
		]);

		await page.goto(`/setlists/${setlist.id}`);
		// TimingBar renders desktop + mobile layouts; the CSS-hidden duplicate
		// still resolves in strict mode, so filter to the visible one
		await expect(page.getByText('5:00').filter({ visible: true })).toBeVisible();

		// Remove first song
		await page.getByLabel('Remove Remove Me Song from setlist').click();

		// Total should update to 2:00
		// Scope to the TimingBar total <p> — song rows also show "2:00" in spans
		await expect(
			page.getByRole('paragraph').filter({ hasText: '2:00' }).filter({ visible: true })
		).toBeVisible();

		await safeDelete('setlists', setlist.id);
		await safeDelete('songs', song1.id);
		await safeDelete('songs', song2.id);
	});
});

test.describe('Setlist - Target Time (SETL-05)', () => {
	test('should show over indicator when total exceeds target', async ({ page, testUser }) => {
		const setlist = await createSetlist(page, testUser.id, {
			name: 'Over Target Test',
			transition_seconds: 0,
			target_seconds: null
		});
		// Two 3:00 songs = 6:00 total
		const song1 = await createSong(page, testUser.id, {
			title: 'Over Song A',
			duration_seconds: 180
		});
		const song2 = await createSong(page, testUser.id, {
			title: 'Over Song B',
			duration_seconds: 180
		});

		await adminClient.from('setlist_songs').insert([
			{ setlist_id: setlist.id, song_id: song1.id, position: 0 },
			{ setlist_id: setlist.id, song_id: song2.id, position: 1 }
		]);

		await page.goto(`/setlists/${setlist.id}`);

		// Set target to 5:00 (total is 6:00, so 1:00 over)
		const targetInput = page.getByPlaceholder('Set target');
		await targetInput.fill('5:00');
		await targetInput.press('Tab'); // Blur to trigger update

		// Should show +1:00 over indicator
		await expect(page.getByText('+1:00').filter({ visible: true })).toBeVisible();

		await safeDelete('setlists', setlist.id);
		await safeDelete('songs', song1.id);
		await safeDelete('songs', song2.id);
	});

	test('should show under indicator when total is less than target', async ({ page, testUser }) => {
		const setlist = await createSetlist(page, testUser.id, {
			name: 'Under Target Test',
			transition_seconds: 0,
			target_seconds: null
		});
		const song = await createSong(page, testUser.id, {
			title: 'Under Song',
			duration_seconds: 180
		});

		await adminClient
			.from('setlist_songs')
			.insert([{ setlist_id: setlist.id, song_id: song.id, position: 0 }]);

		await page.goto(`/setlists/${setlist.id}`);

		// Set target to 5:00 (total is 3:00, so 2:00 under)
		const targetInput = page.getByPlaceholder('Set target');
		await targetInput.fill('5:00');
		await targetInput.press('Tab');

		// Should show -2:00 under indicator
		await expect(page.getByText('-2:00').filter({ visible: true })).toBeVisible();

		await safeDelete('setlists', setlist.id);
		await safeDelete('songs', song.id);
	});
});

test.describe('Setlist - Transition Gap (SETL-06)', () => {
	test('should adjust total time when transition gap is changed', async ({ page, testUser }) => {
		const setlist = await createSetlist(page, testUser.id, {
			name: 'Gap Test',
			transition_seconds: 0,
			target_seconds: null
		});
		// Two 3:00 songs = 6:00 base total, 1 gap between 2 songs
		const song1 = await createSong(page, testUser.id, {
			title: 'Gap Song A',
			duration_seconds: 180
		});
		const song2 = await createSong(page, testUser.id, {
			title: 'Gap Song B',
			duration_seconds: 180
		});

		await adminClient.from('setlist_songs').insert([
			{ setlist_id: setlist.id, song_id: song1.id, position: 0 },
			{ setlist_id: setlist.id, song_id: song2.id, position: 1 }
		]);

		await page.goto(`/setlists/${setlist.id}`);
		await expect(page.getByText('6:00').filter({ visible: true })).toBeVisible();

		// Increase gap by 5s (one click on +)
		await page.getByLabel('Increase transition time').filter({ visible: true }).click();

		// Gap display shows "5s"
		await expect(page.getByText('5s').filter({ visible: true })).toBeVisible();

		// Total = 6:00 + 5s (1 gap) = 6:05
		await expect(page.getByText('6:05').filter({ visible: true })).toBeVisible();

		await safeDelete('setlists', setlist.id);
		await safeDelete('songs', song1.id);
		await safeDelete('songs', song2.id);
	});
});

test.describe('Setlist - Share (SETL-08)', () => {
	test('should share setlist and access via public link without auth', async ({
		page,
		browser,
		testUser
	}) => {
		const setlist = await createSetlist(page, testUser.id, { name: 'Shared Gig Set' });
		const song = await createSong(page, testUser.id, {
			title: 'Shared Song',
			duration_seconds: 240
		});

		// Pre-populate setlist with song
		await adminClient
			.from('setlist_songs')
			.insert([{ setlist_id: setlist.id, song_id: song.id, position: 0 }]);

		await page.goto(`/setlists/${setlist.id}`);

		// Enable sharing (exact: the title "Shared Gig Set" and the remove-song
		// button also contain "Share")
		await page.getByRole('button', { name: 'Share', exact: true }).click();
		// Wait for "Sharing On" state (button text changes)
		await expect(page.getByText('Sharing On')).toBeVisible();

		// Extract share URL (the span next to the Copy button is the only element
		// containing "/share/" -- a bare .truncate locator matches multiple elements
		// on this page and trips strict mode)
		const shareUrl = await page.locator('span.truncate', { hasText: '/share/' }).innerText();

		// Visit in unauthenticated browser context
		const publicContext = await browser.newContext({ storageState: undefined });
		const publicPage = await publicContext.newPage();
		await publicPage.goto(shareUrl);

		// Verify setlist content visible to unauthenticated user
		await expect(publicPage.getByText('Shared Gig Set')).toBeVisible();
		await expect(publicPage.getByText('Shared Song')).toBeVisible();

		await publicContext.close();

		// Cleanup
		await safeDelete('setlists', setlist.id);
		await safeDelete('songs', song.id);
	});
});
