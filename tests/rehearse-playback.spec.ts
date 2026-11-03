/**
 * Real-playback test for rehearse mode's auto-advance. It plays audio because the
 * behaviour only exists while the media clock advances; see CLAUDE.md for the
 * Chromium quirks the local audio server works around.
 */
import crypto from 'node:crypto';
import { test, expect } from './fixtures';
import { createSetlist, createSong } from './helpers/factories';
import { adminClient } from './helpers/supabase-admin';
import { safeDelete, cleanupSongAudio } from './helpers/cleanup';
import { FAKE_PEAKS, makeWav, serveSongAudioLocally, serveWav } from './helpers/audio-server';

test('the same song twice in a row plays through to the end of the set', async ({
	page,
	testUser
}) => {
	test.setTimeout(60_000);
	const seconds = 2;
	const song = await createSong(page, testUser.id, {
		title: 'Playback Song',
		duration_seconds: seconds
	});
	const setlist = await createSetlist(page, testUser.id, { transition_seconds: 0 });
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

	try {
		await page.goto(`/setlists/${setlist.id}/rehearse`);
		await page.getByRole('button', { name: 'Start rehearsal' }).click();
		// The stall this guards against: the second row never reloads, so nothing plays
		await expect(page.getByText('Set complete')).toBeVisible({ timeout: 20_000 });
	} finally {
		server.close();
		await cleanupSongAudio(song.id);
		await safeDelete('setlists', setlist.id);
		await safeDelete('songs', song.id);
	}
});
