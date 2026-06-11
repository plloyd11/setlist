/**
 * Track folder E2E tests (TRACK-05).
 *
 * REQUIRES migration 20260611000000_create_track_folders.sql (track_folders
 * table, tracks.folder_id, and the create/move/delete folder RPCs).
 *
 * Drag-and-drop here is NATIVE HTML5 dnd — Playwright's built-in dragTo()
 * supports it directly. Do NOT use tests/helpers/dnd.ts: that raw-mouse
 * helper exists only for svelte-dnd-action zones (setlist builder).
 */
import { test, expect } from './fixtures';
import { createClient } from '@supabase/supabase-js';
import { createBand, createTrackData, createTrackFolder } from './helpers/factories';
import { safeDelete, cleanupTrackAudio } from './helpers/cleanup';
import { createTestUser, deleteTestUser } from './helpers/auth';
import { faker } from '@faker-js/faker';

const FIXTURE = 'tests/fixtures/sample.wav';

function anonClient() {
	return createClient(
		process.env.PUBLIC_SUPABASE_URL!,
		process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
		{ auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
	);
}

test.describe('Track folders (TRACK-05)', () => {
	test('create, navigate via breadcrumb, rename with duplicate guard', async ({
		page,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);

		try {
			await page.goto(`/bands/${band.id}/tracks`);

			// Create two root folders through the UI
			await page.getByLabel('New folder').click();
			await page.getByPlaceholder('Folder name...').fill('Demos');
			await page.getByRole('button', { name: 'Create' }).click();
			await expect(page.getByRole('link', { name: /Demos/ })).toBeVisible();
			await expect(page.getByText('0 tracks')).toBeVisible();

			await page.getByLabel('New folder').click();
			await page.getByPlaceholder('Folder name...').fill('Live takes');
			await page.getByRole('button', { name: 'Create' }).click();
			await expect(page.getByRole('link', { name: /Live takes/ })).toBeVisible();

			// Navigate in — breadcrumb appears, empty-folder state shows
			await page.getByRole('link', { name: /Demos/ }).click();
			await expect(page).toHaveURL(/\?folder=/);
			const breadcrumb = page.getByLabel('Breadcrumb');
			await expect(breadcrumb.getByText('Demos')).toBeVisible();
			await expect(page.getByText('This folder is empty')).toBeVisible();

			// Nested folder inside Demos
			await page.getByLabel('New folder').click();
			await page.getByPlaceholder('Folder name...').fill('Acoustic');
			await page.getByRole('button', { name: 'Create' }).click();
			await page.getByRole('link', { name: /Acoustic/ }).click();
			await expect(breadcrumb.getByText('Acoustic')).toBeVisible();
			await expect(breadcrumb.getByRole('link', { name: 'Demos' })).toBeVisible();

			// Crumb navigates up one level, then back to the root
			await breadcrumb.getByRole('link', { name: 'Demos' }).click();
			await expect(page.getByRole('link', { name: /Acoustic/ })).toBeVisible();
			await breadcrumb.getByRole('link', { name: 'Tracks' }).click();
			await expect(page).not.toHaveURL(/folder=/);
			await expect(page.getByRole('link', { name: /Live takes/ })).toBeVisible();

			// Rename to a sibling's name is rejected inline; a fresh name works
			await page.getByLabel('Folder options for Live takes').click();
			await page.getByRole('button', { name: 'Rename' }).click();
			await page.getByPlaceholder('Folder name...').fill('Demos');
			await page.getByRole('button', { name: 'Rename' }).click();
			await expect(page.getByText('A folder with that name already exists here')).toBeVisible();
			await page.getByPlaceholder('Folder name...').fill('Sketches');
			await page.getByRole('button', { name: 'Rename' }).click();
			await expect(page.getByRole('link', { name: /Sketches/ })).toBeVisible();
			await expect(page.getByRole('link', { name: /Live takes/ })).not.toBeVisible();
		} finally {
			await safeDelete('bands', band.id);
		}
	});

	test('uploads land in the folder that is open', async ({ page, testUser }) => {
		const band = await createBand(page, testUser.id);
		const folder = await createTrackFolder(band.id, testUser.id, { name: 'Demos' });
		const title = `Folder demo ${faker.string.alphanumeric(6)}`;

		try {
			await page.goto(`/bands/${band.id}/tracks?folder=${folder.id}`);
			await page.getByLabel('New track').click();
			await page.getByPlaceholder('Track title...').fill(title);
			await page.locator('input[type="file"]').setInputFiles(FIXTURE);
			await page.getByRole('button', { name: 'Upload track' }).click();
			await expect(page).toHaveURL(new RegExp(`/bands/${band.id}/tracks/.+`), {
				timeout: 15_000
			});

			// Not at the root — inside the folder
			await page.goto(`/bands/${band.id}/tracks`);
			await expect(page.getByText(title)).not.toBeVisible();
			await expect(page.getByText('1 track', { exact: true })).toBeVisible();

			await page.goto(`/bands/${band.id}/tracks?folder=${folder.id}`);
			await expect(page.getByText(title)).toBeVisible();
		} finally {
			await cleanupTrackAudio(band.id);
			await safeDelete('bands', band.id);
		}
	});

	test('moves a track via the Move-to dialog and via drag-and-drop', async ({ page, testUser }) => {
		const band = await createBand(page, testUser.id);
		const folder = await createTrackFolder(band.id, testUser.id, { name: 'Demos' });
		const track = await createTrackData(band.id, testUser.id, {
			title: `Riff ${faker.string.alphanumeric(6)}`
		});

		try {
			// Dialog: root → Demos
			await page.goto(`/bands/${band.id}/tracks`);
			const card = page.getByRole('link', { name: new RegExp(track.title) });
			await card.click({ button: 'right' });
			await page.getByRole('button', { name: 'Move to…' }).click();
			await page.locator('dialog').getByRole('button', { name: 'Demos' }).click();
			await expect(card).not.toBeVisible();
			await expect(page.getByText('1 track', { exact: true })).toBeVisible();

			// Dialog: Demos → top level
			await page.goto(`/bands/${band.id}/tracks?folder=${folder.id}`);
			await expect(card).toBeVisible();
			await card.click({ button: 'right' });
			await page.getByRole('button', { name: 'Move to…' }).click();
			await page.locator('dialog').getByRole('button', { name: 'Tracks (top level)' }).click();
			await expect(card).not.toBeVisible();

			// Native HTML5 dnd: drag the card onto the folder row at the root
			await page.goto(`/bands/${band.id}/tracks`);
			await expect(card).toBeVisible();
			await card.dragTo(page.getByRole('link', { name: /Demos/ }));
			await expect(card).not.toBeVisible();
			await expect(page.getByText('1 track', { exact: true })).toBeVisible();
		} finally {
			await cleanupTrackAudio(band.id);
			await safeDelete('bands', band.id);
		}
	});

	test('folder moves are cycle-guarded; deleting a folder moves contents up', async ({
		page,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);
		const outer = await createTrackFolder(band.id, testUser.id, { name: 'Outer' });
		const inner = await createTrackFolder(band.id, testUser.id, {
			name: 'Inner',
			parent_id: outer.id
		});
		const track = await createTrackData(band.id, testUser.id, { folder_id: inner.id });

		try {
			// The Move-to dialog disables the folder's own subtree
			await page.goto(`/bands/${band.id}/tracks`);
			await page.getByLabel('Folder options for Outer').click();
			await page.getByRole('button', { name: 'Move to…' }).click();
			await expect(page.locator('dialog').getByRole('button', { name: 'Inner' })).toBeDisabled();
			await expect(page.locator('dialog').getByRole('button', { name: 'Outer' })).toBeDisabled();
			await page.locator('dialog').getByRole('button', { name: 'Cancel' }).click();

			// The RPC rejects a cycle even without the UI guard
			const memberClient = anonClient();
			const { error: signInError } = await memberClient.auth.signInWithPassword({
				email: testUser.email,
				password: testUser.password
			});
			expect(signInError).toBeNull();
			const { error: cycleError } = await memberClient.rpc('move_folder', {
				p_band_id: band.id,
				p_folder_id: outer.id,
				p_new_parent_id: inner.id
			});
			expect(cycleError?.message).toContain('its own subtree');

			// Deleting Outer reparents Inner (and its track) to the root
			await page.getByLabel('Folder options for Outer').click();
			await page.getByRole('button', { name: 'Delete' }).click();
			await page.locator('dialog:has-text("Delete \\"Outer\\"?")').waitFor();
			await page.locator('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(page.getByRole('link', { name: /Outer/ })).not.toBeVisible();
			await expect(page.getByRole('link', { name: /Inner/ })).toBeVisible();
			await expect(page.getByText('1 track', { exact: true })).toBeVisible();

			await page.goto(`/bands/${band.id}/tracks?folder=${inner.id}`);
			await expect(page.getByText(track.title)).toBeVisible();
		} finally {
			await cleanupTrackAudio(band.id);
			await safeDelete('bands', band.id);
		}
	});

	test('RLS: outsiders see nothing; members cannot bypass the RPCs', async ({ page, testUser }) => {
		const band = await createBand(page, testUser.id);
		const folder = await createTrackFolder(band.id, testUser.id);
		const track = await createTrackData(band.id, testUser.id, { folder_id: folder.id });
		const outsider = await createTestUser(Date.now());

		try {
			const outsiderClient = anonClient();
			const { error: signInError } = await outsiderClient.auth.signInWithPassword({
				email: outsider.email,
				password: outsider.password
			});
			expect(signInError).toBeNull();

			// Folders are invisible to non-members
			const { data: folders, error: selectError } = await outsiderClient
				.from('track_folders')
				.select('*')
				.eq('band_id', band.id);
			expect(selectError).toBeNull();
			expect(folders ?? []).toHaveLength(0);

			// All folder RPCs reject non-members
			const { error: createError } = await outsiderClient.rpc('create_track_folder', {
				p_band_id: band.id,
				p_parent_id: null,
				p_name: 'intruder'
			});
			expect(createError?.message).toContain('Not a member');
			const { error: moveError } = await outsiderClient.rpc('move_track', {
				p_band_id: band.id,
				p_track_id: track.id,
				p_folder_id: null
			});
			expect(moveError?.message).toContain('Not a member');
			const { error: deleteError } = await outsiderClient.rpc('delete_track_folder', {
				p_band_id: band.id,
				p_folder_id: folder.id
			});
			expect(deleteError?.message).toContain('Not a member');

			// Members can't sidestep the RPCs with direct writes:
			const memberClient = anonClient();
			await memberClient.auth.signInWithPassword({
				email: testUser.email,
				password: testUser.password
			});

			// reparenting a folder directly is blocked by the column grant
			const { error: reparentError } = await memberClient
				.from('track_folders')
				.update({ parent_id: null })
				.eq('id', folder.id);
			expect(reparentError).not.toBeNull();

			// moving a track directly is blocked by the tracks column grant
			const { error: trackMoveError } = await memberClient
				.from('tracks')
				.update({ folder_id: null })
				.eq('id', track.id);
			expect(trackMoveError).not.toBeNull();

			// deleting a folder directly is a silent no-op (no DELETE policy)
			const { data: deleted } = await memberClient
				.from('track_folders')
				.delete()
				.eq('id', folder.id)
				.select('id');
			expect(deleted ?? []).toHaveLength(0);
			const { data: stillThere } = await memberClient
				.from('track_folders')
				.select('id')
				.eq('id', folder.id);
			expect(stillThere).toHaveLength(1);
		} finally {
			await deleteTestUser(outsider.id);
			await cleanupTrackAudio(band.id);
			await safeDelete('bands', band.id);
		}
	});
});
