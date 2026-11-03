/**
 * Real-playback tests for the rehearse mode's advance logic. Like
 * practice-loop-playback.spec.ts, these play audio because the behaviour only
 * exists while the media clock advances; see CLAUDE.md for the Chromium quirks the
 * local audio server works around. Loop regions are dragged rather than pinned, so
 * playback starts with no pending seek.
 */
import crypto from 'node:crypto';
import { test, expect } from './fixtures';
import { createSetlist, createSong } from './helpers/factories';
import { adminClient } from './helpers/supabase-admin';
import { safeDelete, cleanupSongAudio } from './helpers/cleanup';
import { FAKE_PEAKS, makeWav, serveSongAudioLocally, serveWav } from './helpers/audio-server';

/** A song played twice in a row, with a real audio variant of the given length */
async function seedRepeatedSong(
	page: import('@playwright/test').Page,
	userId: string,
	seconds: number
) {
	const song = await createSong(page, userId, {
		title: 'Playback Song',
		duration_seconds: seconds
	});
	const setlist = await createSetlist(page, userId, {
		name: 'Playback Set',
		transition_seconds: 0
	});
	const wav = makeWav(seconds);
	const storagePath = `songs/${song.id}/${crypto.randomUUID()}.wav`;
	const { error: uploadError } = await adminClient.storage
		.from('song-audio')
		.upload(storagePath, wav, { contentType: 'audio/wav' });
	if (uploadError) throw new Error(uploadError.message);
	const { error: audioError } = await adminClient.from('song_audio').insert({
		song_id: song.id,
		label: 'Full mix',
		storage_path: storagePath,
		file_name: 'audio.wav',
		mime_type: 'audio/wav',
		file_size_bytes: wav.length,
		duration_seconds: seconds,
		waveform_peaks: FAKE_PEAKS
	});
	if (audioError) throw new Error(audioError.message);
	const { error: rowError } = await adminClient.from('setlist_songs').insert([
		{ setlist_id: setlist.id, song_id: song.id, position: 0 },
		{ setlist_id: setlist.id, song_id: song.id, position: 1 }
	]);
	if (rowError) throw new Error(rowError.message);

	const server = await serveWav(wav);
	await serveSongAudioLocally(page, server.port);
	return {
		setlist,
		cleanup: async () => {
			server.close();
			await cleanupSongAudio(song.id);
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', song.id);
		}
	};
}

test('the same song twice in a row plays through to the end of the set', async ({
	page,
	testUser
}) => {
	test.setTimeout(60_000);
	const { setlist, cleanup } = await seedRepeatedSong(page, testUser.id, 2);

	try {
		await page.goto(`/setlists/${setlist.id}/rehearse`);
		await page.getByRole('button', { name: 'Start rehearsal' }).click();

		await expect(page.getByText('Song 1 of 2')).toBeVisible();
		await expect(page.getByText('Song 2 of 2')).toBeVisible({ timeout: 15_000 });
		// The stall this guards against: the second row never reloads, so nothing plays
		await expect(page.getByText('Set complete')).toBeVisible({ timeout: 15_000 });
	} finally {
		await cleanup();
	}
});

test('skipping mid-track starts the next row from the top, even for the same file', async ({
	page,
	testUser
}) => {
	test.setTimeout(60_000);
	const { setlist, cleanup } = await seedRepeatedSong(page, testUser.id, 8);

	try {
		await page.goto(`/setlists/${setlist.id}/rehearse`);
		await page.getByRole('button', { name: 'Start rehearsal' }).click();

		const seek = page.getByRole('slider', { name: 'Seek' });
		await expect
			.poll(async () => Number(await seek.getAttribute('aria-valuenow')), { timeout: 15_000 })
			.toBeGreaterThanOrEqual(3);

		await page.keyboard.press('n');
		await expect(page.getByText('Song 2 of 2')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({
			timeout: 15_000
		});
		// Let playback report its real position: the slider resets to 0 on any remount
		await page.waitForTimeout(500);
		expect(Number(await seek.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(1);
	} finally {
		await cleanup();
	}
});

test('moving on to a song with no audio stops the track', async ({ page, testUser }) => {
	test.setTimeout(60_000);
	const { setlist, cleanup } = await seedRepeatedSong(page, testUser.id, 8);
	const silent = await createSong(page, testUser.id, { title: 'Silent Song' });

	try {
		await adminClient.from('setlist_songs').delete().eq('setlist_id', setlist.id).eq('position', 1);
		await adminClient
			.from('setlist_songs')
			.insert({ setlist_id: setlist.id, song_id: silent.id, position: 1 });

		await page.goto(`/setlists/${setlist.id}/rehearse`);
		await page.getByRole('button', { name: 'Start rehearsal' }).click();

		const seek = page.getByRole('slider', { name: 'Seek' });
		await expect
			.poll(async () => Number(await seek.getAttribute('aria-valuenow')), { timeout: 15_000 })
			.toBeGreaterThanOrEqual(1);

		await page.keyboard.press('n');
		await expect(page.getByRole('heading', { name: 'Silent Song' })).toBeVisible();
		await expect
			.poll(() => page.evaluate(() => document.querySelector('audio')?.paused))
			.toBe(true);
	} finally {
		await cleanup();
		await safeDelete('songs', silent.id);
	}
});

test('with run the set off, a finished track waits and Again replays it', async ({
	page,
	testUser
}) => {
	test.setTimeout(60_000);
	const { setlist, cleanup } = await seedRepeatedSong(page, testUser.id, 2);

	try {
		await page.goto(`/setlists/${setlist.id}/rehearse`);
		await page.getByRole('switch', { name: 'Run the set' }).click();
		await page.getByRole('button', { name: 'Start rehearsal' }).click();

		await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
			timeout: 15_000
		});
		await page.getByRole('button', { name: 'Play', exact: true }).click();

		const again = page.getByRole('button', { name: 'Again', exact: true });
		await expect(again).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Song 1 of 2')).toBeVisible();

		await again.click();
		await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
		await expect(again).toBeHidden();
	} finally {
		await cleanup();
	}
});

test('an armed loop wins over the end of the track, and moving on disarms it', async ({
	page,
	testUser
}) => {
	test.setTimeout(90_000);
	const { setlist, cleanup } = await seedRepeatedSong(page, testUser.id, 6);

	try {
		await page.goto(`/setlists/${setlist.id}/rehearse`);
		// Off while the region is set up, so the track can't run out and advance first
		await page.getByRole('switch', { name: 'Run the set' }).click();
		await page.getByRole('button', { name: 'Start rehearsal' }).click();
		await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
			timeout: 15_000
		});

		// Drag a region over roughly the second to third seconds
		const seek = page.getByRole('slider', { name: 'Seek' });
		const box = (await seek.boundingBox())!;
		await page.mouse.move(box.x + box.width / 6, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 2.5, box.y + box.height / 2, { steps: 8 });
		await page.mouse.up();
		await expect(page.locator('[part~="region"]')).toBeVisible();

		await page.getByRole('switch', { name: 'Run the set' }).click();
		await page.getByRole('button', { name: 'Play', exact: true }).click();
		await expect
			.poll(async () => Number(await seek.getAttribute('aria-valuenow')), { timeout: 15_000 })
			.toBeGreaterThanOrEqual(1);
		await page.keyboard.press('l');
		const loopButton = page.getByRole('button', { name: /Loop/ });
		await expect(loopButton).toHaveAttribute('aria-pressed', 'true');

		// Seek past B to the very end: the track finishes, but the loop re-traps it
		await seek.focus();
		await page.keyboard.press('End');
		await expect
			.poll(async () => Number(await seek.getAttribute('aria-valuenow')), { timeout: 10_000 })
			.toBeLessThanOrEqual(3);
		await expect(page.getByText('Song 1 of 2')).toBeVisible();
		await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();

		// Moving on leaves the loop behind
		await page.keyboard.press('n');
		await expect(page.getByText('Song 2 of 2')).toBeVisible();
		await expect(loopButton).toHaveAttribute('aria-pressed', 'false');
	} finally {
		await cleanup();
	}
});
