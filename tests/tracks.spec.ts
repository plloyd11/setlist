/**
 * Band track sharing E2E tests (TRACK-01..04).
 *
 * REQUIRES migration 20260610120000_create_track_tables.sql to be applied
 * (tracks/track_versions/track_comments tables, create_track_version RPC,
 * and the private 'tracks' storage bucket).
 *
 * Audio playback assertions stay shallow (player chrome renders, transport
 * enables) — headless Chromium audio output is not asserted.
 */
import { test, expect } from './fixtures';
import { createClient } from '@supabase/supabase-js';
import { createSecondUser } from './helpers/multi-user';
import { createBand, createTrack, createTrackComment } from './helpers/factories';
import { safeDelete, cleanupTrackAudio } from './helpers/cleanup';
import { adminClient } from './helpers/supabase-admin';
import { createTestUser, deleteTestUser } from './helpers/auth';
import { faker } from '@faker-js/faker';

const FIXTURE = 'tests/fixtures/sample.wav';

test.describe('Track upload (TRACK-01)', () => {
	test('should upload a track via UI and land on the detail page with a player', async ({
		page,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);
		const title = `Demo ${faker.string.alphanumeric(6)}`;

		try {
			await page.goto(`/bands/${band.id}/demos`);
			// Wait for hydration — buttons below need their JS click handlers,
			// and a cold Vite dev server compiles this route on first visit
			await page.waitForLoadState('networkidle');

			// Empty state is shown before any upload
			await expect(page.getByText('No demos yet')).toBeVisible();

			await page.getByLabel('New demo').click();
			await page.getByPlaceholder('Demo title...').fill(title);
			await page.locator('input[type="file"]').setInputFiles(FIXTURE);
			// WAV is lossless, so the zone flags the client-side MP3 transcode
			await expect(page.getByText(/compresses to MP3 on upload/)).toBeVisible();
			await page.getByRole('button', { name: 'Upload demo' }).click();

			// Client decodes audio, uploads to storage, then the action redirects
			// to the new track's detail page
			await expect(page).toHaveURL(new RegExp(`/bands/${band.id}/demos/.+`), {
				timeout: 15_000
			});
			await expect(page.getByRole('heading', { name: title })).toBeVisible();
			await expect(page.getByText(/uploaded by/)).toContainText('v1');

			// Waveform player renders and becomes playable (peaks + signed URL)
			await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 10_000 });

			// Track appears in the list with its version badge
			await page.goto(`/bands/${band.id}/demos`);
			await expect(page.getByText(title)).toBeVisible();
			await expect(page.getByText('v1')).toBeVisible();

			// Old /tracks bookmarks redirect to /demos
			await page.goto(`/bands/${band.id}/tracks`);
			await expect(page).toHaveURL(`/bands/${band.id}/demos`);
		} finally {
			await cleanupTrackAudio(band.id);
			await safeDelete('bands', band.id);
		}
	});
});

test.describe('Track versions (TRACK-02)', () => {
	test('any member can upload a new version; comments stay on their version', async ({
		page,
		browser,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);
		const track = await createTrack(page, band.id, testUser.id);
		const userB = await createSecondUser(browser);

		try {
			await adminClient
				.from('band_members')
				.insert({ band_id: band.id, user_id: userB.user.id, role: 'member' });

			// Comment on v1 (before v2 exists)
			const v1CommentBody = `v1 feedback ${faker.string.alphanumeric(6)}`;
			await createTrackComment(track.version.id, testUser.id, { body: v1CommentBody });

			// User B (not the track creator) uploads version 2
			await userB.page.goto(`/bands/${band.id}/demos/${track.id}`);
			await userB.page.waitForLoadState('networkidle');
			await userB.page.getByRole('button', { name: '+ Version' }).click();
			await userB.page.locator('input[type="file"]').setInputFiles(FIXTURE);
			await userB.page.getByRole('button', { name: 'Upload new version' }).click();

			// Lands on v2
			await expect(userB.page).toHaveURL(/version=2/, { timeout: 15_000 });
			await expect(userB.page.getByText(/uploaded by/)).toContainText('v2');

			// v1's comment is not shown on v2
			await expect(userB.page.getByText(v1CommentBody)).not.toBeVisible();

			// Switch back to v1 via the version switcher — its comment is there
			await userB.page.getByLabel('Demo version').selectOption({ index: 1 });
			await expect(userB.page).toHaveURL(/version=1/);
			await expect(userB.page.getByText(/uploaded by/)).toContainText('v1');
			await expect(userB.page.getByText(v1CommentBody)).toBeVisible();
			await expect(userB.page.getByText(/listening to an older version/)).toBeVisible();

			// Track creator sees both versions too
			await page.goto(`/bands/${band.id}/demos/${track.id}`);
			await expect(page.getByLabel('Demo version')).toBeVisible();
			await expect(page.getByText(/uploaded by/)).toContainText('v2');
		} finally {
			await userB.cleanup();
			await cleanupTrackAudio(band.id);
			await safeDelete('bands', band.id);
		}
	});
});

test.describe('Track comments (TRACK-03)', () => {
	test('members exchange timestamped comments with replies, resolve, and delete', async ({
		page,
		browser,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);
		const track = await createTrack(page, band.id, testUser.id);
		const userB = await createSecondUser(browser);

		try {
			await adminClient
				.from('band_members')
				.insert({ band_id: band.id, user_id: userB.user.id, role: 'member' });

			// User B pins a comment at the current playhead (0:00 — nothing played yet).
			// Comments are unpinned by default; the pin is an explicit capture.
			const commentBody = `Feedback ${faker.string.alphanumeric(6)}`;
			await userB.page.goto(`/bands/${band.id}/demos/${track.id}`);
			await userB.page.waitForLoadState('networkidle');
			await userB.page.getByPlaceholder('Leave feedback...').fill(commentBody);
			await userB.page.getByRole('button', { name: /^Pin at 0:00/ }).click();
			await expect(userB.page.getByText(/^Pinned at/)).toBeVisible();
			await userB.page.getByRole('button', { name: 'Comment', exact: true }).click();
			await expect(userB.page.getByText(commentBody)).toBeVisible();

			// Track creator sees the comment and its waveform marker
			await page.goto(`/bands/${band.id}/demos/${track.id}`);
			await page.waitForLoadState('networkidle');
			await expect(page.getByText(commentBody)).toBeVisible();
			await expect(page.getByRole('button', { name: /^Comment at 0:00/ })).toBeVisible();

			// Creator replies (one-level thread)
			const replyBody = `Reply ${faker.string.alphanumeric(6)}`;
			await page.locator('[id^="track-comment-"]').getByRole('button', { name: 'Reply' }).click();
			await page.getByPlaceholder('Write a reply...').fill(replyBody);
			await page.locator('form').getByRole('button', { name: 'Reply' }).click();
			await expect(page.getByText(replyBody)).toBeVisible();

			// Replies cannot be replied to (no Reply button on the nested item)
			const replyItem = page.locator('[id^="track-comment-"]', { hasText: replyBody }).last();
			await expect(replyItem.getByRole('button', { name: 'Reply' })).not.toBeVisible();

			// Creator resolves the comment
			await page.getByRole('button', { name: 'Resolve' }).click();
			await expect(page.getByText(/^Resolved/)).toBeVisible();

			// User B sees the resolved state and deletes their own comment
			await userB.page.reload();
			await expect(userB.page.getByText(/^Resolved/)).toBeVisible();
			const bComment = userB.page
				.locator('[id^="track-comment-"]', { hasText: commentBody })
				.first();
			await bComment.getByRole('button', { name: 'Delete' }).click();
			await userB.page.locator('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(userB.page.getByText(commentBody)).not.toBeVisible();
			// Replies cascade with the parent
			await expect(userB.page.getByText(replyBody)).not.toBeVisible();
		} finally {
			await userB.cleanup();
			await cleanupTrackAudio(band.id);
			await safeDelete('bands', band.id);
		}
	});
});

test.describe('Track RLS isolation (TRACK-04)', () => {
	test('non-members cannot read tracks, comments, or sign audio URLs', async ({
		page,
		testUser
	}) => {
		const url = process.env.PUBLIC_SUPABASE_URL!;
		const publishableKey = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

		const band = await createBand(page, testUser.id);
		const track = await createTrack(page, band.id, testUser.id);
		const comment = await createTrackComment(track.version.id, testUser.id);
		const outsider = await createTestUser(Date.now());

		const outsiderClient = createClient(url, publishableKey, {
			auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
		});

		try {
			const { error: signInError } = await outsiderClient.auth.signInWithPassword({
				email: outsider.email,
				password: outsider.password
			});
			if (signInError) throw new Error(`Outsider sign-in failed: ${signInError.message}`);

			// Tracks are invisible to non-members
			const { data: tracks, error: tracksError } = await outsiderClient
				.from('tracks')
				.select('*')
				.eq('band_id', band.id);
			expect(tracksError).toBeNull();
			expect(tracks ?? []).toHaveLength(0);

			// Comments are invisible to non-members
			const { data: comments, error: commentsError } = await outsiderClient
				.from('track_comments')
				.select('*')
				.eq('id', comment.id);
			expect(commentsError).toBeNull();
			expect(comments ?? []).toHaveLength(0);

			// Audio objects cannot be signed by non-members
			const { data: signed, error: signError } = await outsiderClient.storage
				.from('tracks')
				.createSignedUrl(track.version.storage_path, 60);
			expect(signError).not.toBeNull();
			expect(signed).toBeNull();

			// Non-members cannot comment on an invisible version
			const { data: inserted, error: insertError } = await outsiderClient
				.from('track_comments')
				.insert({
					version_id: track.version.id,
					author_id: outsider.id,
					body: 'should not work'
				})
				.select();
			expect(insertError !== null || (inserted ?? []).length === 0).toBe(true);

			// Sanity: a member CAN sign the same path (via admin-created membership)
			const { data: memberSigned } = await adminClient.storage
				.from('tracks')
				.createSignedUrl(track.version.storage_path, 60);
			expect(memberSigned?.signedUrl).toBeTruthy();
		} finally {
			await deleteTestUser(outsider.id);
			await cleanupTrackAudio(band.id);
			await safeDelete('bands', band.id);
		}
	});
});
