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
import {
	createBand,
	createSetlist,
	createSong,
	createSongAudio,
	createSongFile
} from './helpers/factories';
import { safeDelete, cleanupSongAudio, cleanupSongFiles } from './helpers/cleanup';
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
			// The flyout also has the charts file input — scope to the audio one
			await page.locator('input[type="file"][accept*="audio"]').setInputFiles(FIXTURE);
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

async function seedSet(setlistId: string, rows: Record<string, unknown>[]) {
	const { error } = await adminClient
		.from('setlist_songs')
		.insert(rows.map((row, position) => ({ setlist_id: setlistId, position, ...row })));
	if (error) throw new Error(`seedSet failed: ${error.message}`);
}

test.describe('Rehearse playthrough (REHEARSE-02)', () => {
	test('runs the set in order: stopwatch song, break countdown, backing track, finish', async ({
		page,
		testUser
	}) => {
		const live = await createSong(page, testUser.id, {
			title: 'Rehearse Opener',
			duration_seconds: 120
		});
		const backed = await createSong(page, testUser.id, {
			title: 'Rehearse Closer',
			duration_seconds: 90
		});
		const setlist = await createSetlist(page, testUser.id, { transition_seconds: 0 });

		try {
			await createSongAudio(backed.id, { label: 'Full mix' });
			await seedSet(setlist.id, [
				{ song_id: live.id },
				{ gap_seconds: 2, gap_label: 'Quick break' },
				{ song_id: backed.id }
			]);

			await page.goto(`/setlists/${setlist.id}/rehearse`);
			await expect(page.getByText('2 songs')).toBeVisible();
			await page.getByRole('button', { name: 'Start rehearsal' }).click();

			// No audio: a stopwatch the musician starts, and Next moves on
			await expect(page.getByRole('heading', { name: 'Rehearse Opener' })).toBeVisible();
			await expect(page.getByRole('timer')).toHaveText('0:00');
			await page.getByRole('button', { name: 'Next', exact: true }).click();

			// The break counts down and advances by itself
			await expect(page.getByRole('heading', { name: 'Quick break' })).toBeVisible();

			// Song with audio: the waveform player renders (signed URL + lazy peaks)
			await expect(page.getByRole('heading', { name: 'Rehearse Closer' })).toBeVisible({
				timeout: 10_000
			});
			await expect(page.getByRole('slider', { name: 'Seek' })).toBeVisible();

			await page.getByRole('button', { name: 'End', exact: true }).click();
			await expect(page.getByText('Set complete')).toBeVisible();
		} finally {
			await cleanupSongAudio(backed.id);
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', live.id);
			await safeDelete('songs', backed.id);
		}
	});

	test('with run the set off, breaks are skipped and tracks wait for you', async ({
		page,
		testUser
	}) => {
		const first = await createSong(page, testUser.id, { title: 'Drill First' });
		const second = await createSong(page, testUser.id, { title: 'Drill Second' });
		const setlist = await createSetlist(page, testUser.id, { transition_seconds: 30 });

		try {
			await createSongAudio(first.id, { label: 'Full mix' });
			await seedSet(setlist.id, [
				{ song_id: first.id },
				{ gap_seconds: 60, gap_label: 'Long break' },
				{ song_id: second.id }
			]);

			await page.goto(`/setlists/${setlist.id}/rehearse`);
			await page.getByRole('switch', { name: 'Run the set' }).click();
			await page.getByRole('button', { name: 'Start rehearsal' }).click();

			// Loaded and paused: nothing plays until asked
			await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
				timeout: 15_000
			});
			await page.waitForTimeout(500);
			await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible();

			// Next goes straight to the next song, with no break or transition
			await page.getByRole('button', { name: 'Next', exact: true }).click();
			await expect(page.getByRole('heading', { name: 'Drill Second' })).toBeVisible();
			await expect(page.getByText('Long break')).toHaveCount(0);

			// Tapping a row in the set jumps to it
			await page.getByRole('button', { name: /Drill First/ }).click();
			await expect(page.getByRole('heading', { name: 'Drill First' })).toBeVisible();
		} finally {
			await cleanupSongAudio(first.id);
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', first.id);
			await safeDelete('songs', second.id);
		}
	});

	test('the stopwatch measures real time, and N and P change song', async ({ page, testUser }) => {
		const first = await createSong(page, testUser.id, { title: 'Timed First' });
		const second = await createSong(page, testUser.id, { title: 'Timed Second' });
		const setlist = await createSetlist(page, testUser.id, { transition_seconds: 0 });

		try {
			await seedSet(setlist.id, [{ song_id: first.id }, { song_id: second.id }]);

			await page.clock.install();
			await page.goto(`/setlists/${setlist.id}/rehearse`);
			await page.getByRole('button', { name: 'Start rehearsal' }).click();
			await page.clock.runFor(1_000);

			await page.getByRole('button', { name: 'Start stopwatch' }).click();
			await page.clock.runFor(65_000);
			await expect(page.getByRole('timer')).toHaveText('1:05');

			await page.getByRole('button', { name: 'Stop stopwatch' }).click();
			await page.clock.runFor(30_000);
			await expect(page.getByRole('timer')).toHaveText('1:05');

			await page.keyboard.press('n');
			await expect(page.getByRole('heading', { name: 'Timed Second' })).toBeVisible();
			await expect(page.getByRole('timer')).toHaveText('0:00');
			await page.keyboard.press('p');
			await expect(page.getByRole('heading', { name: 'Timed First' })).toBeVisible();

			await page.getByRole('button', { name: 'End', exact: true }).click();
			await expect(page.getByText('You played for 1:05')).toBeVisible();
		} finally {
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', first.id);
			await safeDelete('songs', second.id);
		}
	});

	test('keeps the screen on while practicing', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Awake Song' });
		const setlist = await createSetlist(page, testUser.id, { transition_seconds: 0 });

		try {
			await seedSet(setlist.id, [{ song_id: song.id }]);
			await page.addInitScript(() => {
				const lock = { requested: 0, released: 0 };
				(window as unknown as { lock: typeof lock }).lock = lock;
				Object.defineProperty(navigator, 'wakeLock', {
					configurable: true,
					value: {
						request: async () => {
							lock.requested += 1;
							return {
								release: async () => {
									lock.released += 1;
								}
							};
						}
					}
				});
			});
			const lock = () =>
				page.evaluate(() => (window as unknown as { lock: Record<string, number> }).lock);

			await page.goto(`/setlists/${setlist.id}/rehearse`);
			expect(await lock()).toEqual({ requested: 0, released: 0 });

			await page.getByRole('button', { name: 'Start rehearsal' }).click();
			await expect.poll(lock).toEqual({ requested: 1, released: 0 });

			// The browser drops the lock when the page is hidden: take it back on return
			await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
			await expect.poll(lock).toEqual({ requested: 2, released: 0 });

			await page.getByRole('button', { name: 'End', exact: true }).click();
			await expect.poll(async () => (await lock()).released).toBeGreaterThan(0);
		} finally {
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', song.id);
		}
	});

	test('a phone gets one pane at a time above the waveform, with no bottom nav', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, {
			title: 'Phone Song',
			notes: 'Capo 3'
		});
		const setlist = await createSetlist(page, testUser.id, { transition_seconds: 0 });

		try {
			await createSongAudio(song.id, { label: 'Full mix' });
			await createSongFile(song.id, { label: 'Chords' });
			await seedSet(setlist.id, [{ song_id: song.id }]);

			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto(`/setlists/${setlist.id}/rehearse`);
			await page.getByRole('switch', { name: 'Run the set' }).click();
			await page.getByRole('button', { name: 'Start rehearsal' }).click();

			await expect(page.getByRole('link', { name: 'Songs' })).toBeHidden();

			const seek = page.getByRole('slider', { name: 'Seek' });
			const chart = page.locator('iframe[title^="Chart:"]');
			const volume = page.getByRole('slider', { name: 'Volume' });
			const runSwitch = page.getByRole('switch', { name: 'Run the set' });

			// The chart opens by itself when there is one
			await expect(seek).toBeVisible();
			await expect(chart).toBeVisible();
			await expect(volume).toBeHidden();

			await page.getByRole('button', { name: 'Controls', exact: true }).click();
			await expect(volume).toBeVisible();
			await expect(chart).toBeHidden();
			await expect(seek).toBeVisible();

			await page.getByRole('button', { name: 'Set', exact: true }).click();
			await expect(runSwitch).toBeVisible();
			await expect(volume).toBeHidden();

			await page.getByRole('button', { name: 'Notes', exact: true }).click();
			await expect(page.getByText('Capo 3')).toBeVisible();
			await expect(seek).toBeVisible();
		} finally {
			await cleanupSongAudio(song.id);
			await cleanupSongFiles(song.id);
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', song.id);
		}
	});

	test('desktop shows the chart, controls, set and notes together', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Desk Song', notes: 'Capo 3' });
		const setlist = await createSetlist(page, testUser.id, { transition_seconds: 0 });

		try {
			await createSongAudio(song.id, { label: 'Full mix' });
			await createSongFile(song.id, { label: 'Chords' });
			await seedSet(setlist.id, [{ song_id: song.id }]);

			await page.goto(`/setlists/${setlist.id}/rehearse`);
			await page.getByRole('switch', { name: 'Run the set' }).click();
			await page.getByRole('button', { name: 'Start rehearsal' }).click();

			await expect(page.locator('iframe[title^="Chart:"]')).toBeVisible();
			await expect(page.getByRole('slider', { name: 'Volume' })).toBeVisible();
			await expect(page.getByRole('switch', { name: 'Run the set' })).toBeVisible();
			await expect(page.getByText('Capo 3')).toBeVisible();
			// The phone's pane tabs must not leak onto wider screens
			await expect(page.getByRole('button', { name: 'Controls', exact: true })).toBeHidden();
		} finally {
			await cleanupSongAudio(song.id);
			await cleanupSongFiles(song.id);
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', song.id);
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
			await seedSet(setlist.id, [{ song_id: song.id }]);

			await page.goto(`/setlists/${setlist.id}/rehearse`);
			await page.getByRole('switch', { name: 'Run the set' }).click();
			await page.getByRole('button', { name: 'Start rehearsal' }).click();

			const picker = page.getByLabel('Mix');
			await expect(picker).toBeVisible();
			await picker.selectOption({ label: 'No guitar' });
			await expect(picker).toHaveValue(noGuitar.id);

			// Choice survives a full reload (localStorage, song-scoped)
			await page.reload();
			await page.waitForLoadState('networkidle');
			await page.getByRole('switch', { name: 'Run the set' }).click();
			await page.getByRole('button', { name: 'Start rehearsal' }).click();
			await expect(page.getByLabel('Mix')).toHaveValue(noGuitar.id);
		} finally {
			await cleanupSongAudio(song.id);
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', song.id);
		}
	});
});

test.describe('Band member rehearse (REHEARSE-04)', () => {
	test('a band member gets a working player and the chart for a band-linked song', async ({
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
			await createSongFile(song.id, { label: 'Chords' });
			const { error: linkError } = await adminClient
				.from('band_songs')
				.insert({ band_id: band.id, song_id: song.id, added_by: testUser.id });
			if (linkError) throw new Error(`Setup band_songs failed: ${linkError.message}`);
			await seedSet(setlist.id, [{ song_id: song.id }]);
			const { error: memberError } = await adminClient
				.from('band_members')
				.insert({ band_id: band.id, user_id: userB.user.id, role: 'member' });
			if (memberError) throw new Error(`Setup band_members failed: ${memberError.message}`);

			// The member opens the shared setlist's rehearse view: song_audio and
			// song_files SELECT + storage signing must all pass for these to render
			await userB.page.goto(`/setlists/${setlist.id}/rehearse`);
			await userB.page.getByRole('switch', { name: 'Run the set' }).click();
			await userB.page.getByRole('button', { name: 'Start rehearsal' }).click();
			await expect(userB.page.getByRole('heading', { name: 'Band Rehearse Song' })).toBeVisible();
			await expect(userB.page.getByRole('slider', { name: 'Seek' })).toBeVisible();
			await expect(userB.page.locator('iframe[title^="Chart:"]')).toBeVisible();
		} finally {
			await userB.cleanup();
			await cleanupSongAudio(song.id);
			await cleanupSongFiles(song.id);
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', song.id);
			await safeDelete('bands', band.id);
		}
	});
});
