/**
 * Rehearse mode E2E tests (REHEARSE-01..04).
 *
 * REQUIRES migration 20260611220000_create_song_audio.sql to be applied
 * (song_audio table + the private 'song-audio' storage bucket).
 *
 * Audio playback assertions stay shallow (player chrome renders, countdowns
 * advance) — headless Chromium audio output is not asserted, and autoplay
 * policy varies, so tests never depend on playback actually starting.
 */
import { test, expect } from './fixtures';
import { createSecondUser } from './helpers/multi-user';
import { createBand, createSetlist, createSong, createSongAudio } from './helpers/factories';
import { safeDelete, cleanupSongAudio } from './helpers/cleanup';
import { adminClient } from './helpers/supabase-admin';

const FIXTURE = 'tests/fixtures/sample.wav';

test.describe('Song audio management (REHEARSE-01)', () => {
	test('uploads, renames, and deletes a variant from the songs page', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Audio Mgmt Song' });

		try {
			// Clicking the row opens the detail flyout with the audio section
			await page.getByText('Audio Mgmt Song').click();
			await expect(page.getByText('Rehearsal audio')).toBeVisible();
			await expect(page.getByText('No audio yet')).toBeVisible();

			// Upload with a label — decode + storage upload + metadata save
			await page
				.getByPlaceholder(/e\.g\. "No guitar"/)
				.first()
				.fill('No guitar');
			await page.locator('input[type="file"]').setInputFiles(FIXTURE);
			await page.getByRole('button', { name: 'Upload audio' }).click();
			await expect(page.getByText('No guitar')).toBeVisible({ timeout: 15_000 });
			await expect(page.getByText('No audio yet')).not.toBeVisible();

			// Rename the variant label
			await page.getByRole('button', { name: 'Rename No guitar' }).click();
			await page
				.getByPlaceholder(/e\.g\. "No guitar"/)
				.first()
				.fill('Drums only');
			await page.getByRole('button', { name: 'Save label' }).click();
			await expect(page.getByText('Drums only')).toBeVisible();

			// Delete it (ConfirmDialog's hidden 'Delete' needs the visible filter)
			await page.getByRole('button', { name: 'Delete Drums only' }).click();
			await page.getByText('Delete', { exact: true }).filter({ visible: true }).click();
			await expect(page.getByText('No audio yet')).toBeVisible();
		} finally {
			await cleanupSongAudio(song.id);
			await safeDelete('songs', song.id);
		}
	});
});

test.describe('Rehearse playthrough (REHEARSE-02)', () => {
	test('plays the set in order: song with audio, gap countdown, waiting song, finish', async ({
		page,
		testUser
	}) => {
		const songA = await createSong(page, testUser.id, {
			title: 'Rehearse Opener',
			duration_seconds: 120
		});
		const songB = await createSong(page, testUser.id, {
			title: 'Rehearse Closer',
			duration_seconds: 90
		});
		const setlist = await createSetlist(page, testUser.id, { transition_seconds: 0 });

		try {
			await createSongAudio(songA.id, { label: 'Full mix' });
			const { error } = await adminClient.from('setlist_songs').insert([
				{ setlist_id: setlist.id, song_id: songA.id, position: 0 },
				{ setlist_id: setlist.id, gap_seconds: 2, gap_label: 'Quick break', position: 1 },
				{ setlist_id: setlist.id, song_id: songB.id, position: 2 }
			]);
			if (error) throw new Error(`Setup setlist_songs failed: ${error.message}`);

			await page.goto(`/setlists/${setlist.id}/rehearse`);
			await expect(page.getByText('2 songs')).toBeVisible();
			await page.getByRole('button', { name: 'Start rehearsal' }).click();

			// Song with audio: the waveform player renders (signed URL + peaks)
			await expect(page.getByRole('heading', { name: 'Rehearse Opener' })).toBeVisible();
			await expect(page.getByRole('slider', { name: 'Seek' })).toBeVisible();

			// Skip ahead to the gap — it counts down and auto-advances after ~2s.
			// The label renders twice (countdown panel + set-order row); assert
			// the panel's copy to satisfy strict mode.
			await page.getByRole('button', { name: 'Next', exact: true }).click();
			await expect(page.getByText('Quick break').first()).toBeVisible();
			await expect(page.getByText('No audio for this one')).toBeVisible({ timeout: 10_000 });

			// Pause-and-wait song advances only on user action
			await expect(page.getByRole('heading', { name: 'Rehearse Closer' })).toBeVisible();
			await page.getByRole('button', { name: 'Done — next song' }).click();
			await expect(page.getByText('Set complete')).toBeVisible();
		} finally {
			await cleanupSongAudio(songA.id);
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', songA.id);
			await safeDelete('songs', songB.id);
		}
	});
});

test.describe('Variant selection (REHEARSE-03)', () => {
	test('remembers the chosen variant across reloads', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Variant Song' });
		const setlist = await createSetlist(page, testUser.id, { transition_seconds: 0 });

		try {
			await createSongAudio(song.id, { label: 'Full mix' });
			const noGuitar = await createSongAudio(song.id, { label: 'No guitar' });
			const { error } = await adminClient
				.from('setlist_songs')
				.insert({ setlist_id: setlist.id, song_id: song.id, position: 0 });
			if (error) throw new Error(`Setup setlist_songs failed: ${error.message}`);

			await page.goto(`/setlists/${setlist.id}/rehearse`);
			await page.getByRole('button', { name: 'Start rehearsal' }).click();

			const picker = page.getByLabel('Audio variant');
			await expect(picker).toBeVisible();
			await picker.selectOption({ label: 'No guitar' });
			await expect(picker).toHaveValue(noGuitar.id);

			// Choice survives a full reload (localStorage, song-scoped)
			await page.reload();
			await page.waitForLoadState('networkidle');
			await page.getByRole('button', { name: 'Start rehearsal' }).click();
			await expect(page.getByLabel('Audio variant')).toHaveValue(noGuitar.id);
		} finally {
			await cleanupSongAudio(song.id);
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', song.id);
		}
	});
});

test.describe('Band member rehearse (REHEARSE-04)', () => {
	test('a band member gets a working player for a band-linked song', async ({
		page,
		browser,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);
		const song = await createSong(page, testUser.id, { title: 'Band Rehearse Song' });
		const setlist = await createSetlist(page, testUser.id, {
			band_id: band.id,
			transition_seconds: 0
		});
		const userB = await createSecondUser(browser);

		try {
			await createSongAudio(song.id, { label: 'Full mix' });
			const { error: linkError } = await adminClient
				.from('band_songs')
				.insert({ band_id: band.id, song_id: song.id, added_by: testUser.id });
			if (linkError) throw new Error(`Setup band_songs failed: ${linkError.message}`);
			const { error: rowError } = await adminClient
				.from('setlist_songs')
				.insert({ setlist_id: setlist.id, song_id: song.id, position: 0 });
			if (rowError) throw new Error(`Setup setlist_songs failed: ${rowError.message}`);
			const { error: memberError } = await adminClient
				.from('band_members')
				.insert({ band_id: band.id, user_id: userB.user.id, role: 'member' });
			if (memberError) throw new Error(`Setup band_members failed: ${memberError.message}`);

			// The member opens the shared setlist's rehearse view: song_audio
			// SELECT + storage signing must both pass for the player to render
			await userB.page.goto(`/setlists/${setlist.id}/rehearse`);
			await userB.page.getByRole('button', { name: 'Start rehearsal' }).click();
			await expect(userB.page.getByRole('heading', { name: 'Band Rehearse Song' })).toBeVisible();
			await expect(userB.page.getByRole('slider', { name: 'Seek' })).toBeVisible();
		} finally {
			await userB.cleanup();
			await cleanupSongAudio(song.id);
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', song.id);
			await safeDelete('bands', band.id);
		}
	});
});
