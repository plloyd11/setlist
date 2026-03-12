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
		const card = page.getByText('Delete Me Set').first();
		await card.hover();
		await page.getByLabel('Setlist options').click();
		await page.getByText('Delete').click();

		// Confirm dialog
		await expect(page.locator('dialog')).toBeVisible();
		await page.locator('dialog').getByRole('button', { name: 'Delete' }).click();

		// Verify deleted
		await expect(page.getByText('Delete Me Set')).not.toBeVisible();
	});

	test('should cancel delete and preserve setlist', async ({ page, testUser }) => {
		const setlist = await createSetlist(page, testUser.id, { name: 'Keep Me Set' });

		await page.goto('/setlists');
		const card = page.getByText('Keep Me Set').first();
		await card.hover();
		await page.getByLabel('Setlist options').click();
		await page.getByText('Delete').click();

		// Cancel in confirm dialog
		await expect(page.locator('dialog')).toBeVisible();
		await page.locator('dialog').getByRole('button', { name: 'Cancel' }).click();

		// Setlist still visible
		await expect(page.getByText('Keep Me Set')).toBeVisible();

		await safeDelete('setlists', setlist.id);
	});
});

test.describe('Setlist DnD - Add Songs (SETL-02)', () => {
	test('should add a song from library to setlist via drag-and-drop', async ({ page, testUser }) => {
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
		const songA = await createSong(page, testUser.id, { title: 'Song Alpha', duration_seconds: 120 });
		const songB = await createSong(page, testUser.id, { title: 'Song Beta', duration_seconds: 180 });

		// Pre-populate setlist with songs via admin client (isolate reorder from add behavior)
		await adminClient.from('setlist_songs').insert([
			{ setlist_id: setlist.id, song_id: songA.id, position: 0 },
			{ setlist_id: setlist.id, song_id: songB.id, position: 1 }
		]);

		await page.goto(`/setlists/${setlist.id}`);

		// Verify initial order: both songs visible with remove buttons
		await expect(page.getByLabel('Remove Song Alpha from setlist')).toBeVisible();
		await expect(page.getByLabel('Remove Song Beta from setlist')).toBeVisible();

		// Drag Song Beta above Song Alpha in the setlist zone
		const betaRow = page.getByText('Song Beta').first();
		const alphaRow = page.getByText('Song Alpha').first();
		await dragAndDrop(page, betaRow, alphaRow, { steps: 15 });

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
