/**
 * The section map on the shed screen: marking a song into sections, stepping
 * through them from the transport, trimming them in the lane, and putting the
 * chart away for a bigger waveform.
 *
 * Nothing here plays audio. The playhead is moved with the arrow keys (5s a
 * press) on a 30s file, so marks land on whole seconds and the map is exact.
 */
import crypto from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { createSong, createSongFile } from './helpers/factories';
import { adminClient } from './helpers/supabase-admin';
import { safeDelete, cleanupSongAudio, cleanupSongFiles } from './helpers/cleanup';
import { makeWav } from './helpers/audio-server';

async function addThirtySeconds(songId: string) {
	const wav = makeWav(30);
	const storagePath = `songs/${songId}/${crypto.randomUUID()}.wav`;
	const { error: uploadError } = await adminClient.storage
		.from('song-audio')
		.upload(storagePath, wav, { contentType: 'audio/wav' });
	if (uploadError) throw new Error(uploadError.message);
	const { error } = await adminClient.from('song_audio').insert({
		song_id: songId,
		label: 'Full mix',
		storage_path: storagePath,
		file_name: 'thirty.wav',
		mime_type: 'audio/wav',
		file_size_bytes: wav.length,
		duration_seconds: 30,
		waveform_peaks: Array.from({ length: 100 }, (_, i) => Math.abs(Math.sin(i / 5)))
	});
	if (error) throw new Error(error.message);
}

async function openShed(page: Page, songId: string, title: string) {
	await page.goto(`/songs/${songId}/practice`);
	await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 });
	// Focus somewhere neutral, so the page's shortcuts get the keys
	await page.getByRole('heading', { name: title }).click();
}

const savedSections = (page: Page, songId: string) =>
	page.evaluate(
		(id) =>
			(JSON.parse(localStorage.getItem('practice:prefs:v1') ?? '{}')[id]?.sections ?? []) as {
				label: string;
				start: number;
				end: number;
			}[],
		songId
	);

test.describe('Section map', () => {
	test('S maps the song, and the transport steps through it', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Mapped Song' });
		await addThirtySeconds(song.id);

		try {
			await openShed(page, song.id, 'Mapped Song');
			const seek = page.getByRole('slider', { name: 'Seek' });
			const lane = page.getByRole('group', { name: 'Section map' });
			const reading = page.getByTestId('transport-section');
			const loopButton = page.getByRole('button', { name: 'Loop', exact: true });
			const next = page.getByRole('button', { name: 'Next section' });

			// No map yet: nothing to step to
			await expect(lane).toHaveCount(0);
			await expect(next).toBeDisabled();

			// A mark at 0:10 maps both sides of it, so the intro isn't left out
			await page.keyboard.press('ArrowRight');
			await page.keyboard.press('ArrowRight');
			await expect(seek).toHaveAttribute('aria-valuenow', '10');
			await page.keyboard.press('s');
			await expect(lane.getByRole('button')).toHaveCount(2);

			// A mark inside a section splits it
			await page.keyboard.press('ArrowRight');
			await page.keyboard.press('ArrowRight');
			await page.keyboard.press('s');
			await expect(lane.getByRole('button')).toHaveCount(3);
			expect(await savedSections(page, song.id)).toEqual([
				expect.objectContaining({ label: 'Section 1', start: 0, end: 10 }),
				expect.objectContaining({ label: 'Section 2', start: 10, end: 20 }),
				expect.objectContaining({ label: 'Section 3', start: 20, end: 30 })
			]);
			await expect(reading).toHaveText('Section 3');

			// On a boundary there's nothing to split
			await page.keyboard.press('s');
			await expect(page.getByText('Too close to the edge of a section')).toBeVisible();
			await expect(lane.getByRole('button')).toHaveCount(3);

			// Rename from the list; the lane and the transport follow
			await page.getByRole('button', { name: 'Edit Section 2' }).click();
			await page.getByLabel('Section name', { exact: true }).fill('Chorus');
			await page.keyboard.press('Enter');
			await expect(lane.getByRole('button', { name: 'Chorus', exact: true })).toBeVisible();
			await page.getByRole('heading', { name: 'Mapped Song' }).click();

			// , and . step between sections. Unarmed, they only move the playhead.
			await page.keyboard.press(',');
			await expect(seek).toHaveAttribute('aria-valuenow', '10');
			await expect(reading).toHaveText('Chorus');
			await expect(loopButton).toHaveAttribute('aria-pressed', 'false');
			await page.keyboard.press('.');
			await expect(seek).toHaveAttribute('aria-valuenow', '20');
			await expect(next).toBeDisabled();

			// A number loops that section and goes to the top of it
			await page.keyboard.press('1');
			await expect(loopButton).toHaveAttribute('aria-pressed', 'true');
			await expect(seek).toHaveAttribute('aria-valuenow', '0');
			await expect(lane.getByRole('button', { name: 'Section 1', exact: true })).toHaveAttribute(
				'aria-pressed',
				'true'
			);

			// Armed, stepping takes the loop along
			await next.click();
			await expect(seek).toHaveAttribute('aria-valuenow', '10');
			await expect(lane.getByRole('button', { name: 'Chorus', exact: true })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await expect(page.getByTestId('loop-reading')).toHaveText('0:10–0:20');

			// The map is the song's: it's there after a reload, with the loop parked
			await page.reload();
			await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 });
			await expect(lane.getByRole('button')).toHaveCount(3);
			await expect(loopButton).toHaveAttribute('aria-pressed', 'false');
		} finally {
			await cleanupSongAudio(song.id);
			await safeDelete('songs', song.id);
		}
	});

	test('a section is trimmed by dragging its edge, or by setting it to the loop', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Trimmed Song' });
		await addThirtySeconds(song.id);

		try {
			await openShed(page, song.id, 'Trimmed Song');
			const lane = page.getByRole('group', { name: 'Section map' });

			await page.keyboard.press('ArrowRight');
			await page.keyboard.press('ArrowRight');
			await page.keyboard.press('s');
			await expect(lane.getByRole('button')).toHaveCount(2);

			// The shared edge at 0:10 goes to 0:15, and takes both neighbours with it
			const box = (await lane.boundingBox())!;
			await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
			await page.mouse.down();
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
			await page.mouse.up();
			await expect
				.poll(async () => (await savedSections(page, song.id))[0]?.end)
				.toBeGreaterThan(14.5);
			const dragged = await savedSections(page, song.id);
			expect(dragged[0].end).toBeLessThan(15.5);
			expect(dragged[1].start).toBe(dragged[0].end);
			expect(dragged[1].end).toBe(30);

			// Without a mouse: pin a loop with the keys, then move the section onto it
			await page.getByRole('heading', { name: 'Trimmed Song' }).click();
			await page.keyboard.press('ArrowLeft');
			await page.keyboard.press('[');
			await expect(page.getByTestId('loop-reading')).toHaveText('0:05–0:30');
			await page.getByRole('button', { name: 'Edit Section 1' }).click();
			await page.getByRole('button', { name: /Set to loop/ }).click();
			await page.getByRole('button', { name: 'Done' }).click();
			await expect
				.poll(async () => (await savedSections(page, song.id)).find((s) => s.label === 'Section 1'))
				.toMatchObject({ start: 5, end: 30 });
		} finally {
			await cleanupSongAudio(song.id);
			await safeDelete('songs', song.id);
		}
	});

	test('the chart can be put away for a bigger waveform', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Roomy Song' });
		await addThirtySeconds(song.id);
		await createSongFile(song.id, { label: 'Chords' });

		try {
			await openShed(page, song.id, 'Roomy Song');
			const seek = page.getByRole('slider', { name: 'Seek' });
			const chart = page.locator('iframe[title^="Chart:"]');
			const toggle = page.getByRole('button', { name: 'Big waveform' });
			await expect(chart).toBeVisible();
			const before = (await seek.boundingBox())!.height;

			await toggle.click();
			await expect(toggle).toHaveAttribute('aria-pressed', 'true');
			await expect(chart).toBeHidden();
			await expect
				.poll(async () => (await seek.boundingBox())!.height)
				.toBeGreaterThan(before * 1.5);

			// The big waveform zooms: keys, the wheel, and back to the whole song
			const level = page.getByTestId('zoom-level');
			await expect(level).toHaveText('Fit');
			await page.getByRole('heading', { name: 'Roomy Song' }).click();
			await page.keyboard.press('+');
			await expect(level).toHaveText('1.5×');
			const wave = (await seek.boundingBox())!;
			await page.mouse.move(wave.x + wave.width / 2, wave.y + wave.height / 2);
			await page.mouse.wheel(0, -400);
			await expect
				.poll(async () => parseFloat((await level.textContent()) ?? ''))
				.toBeGreaterThan(2);
			await page.keyboard.press('0');
			await expect(level).toHaveText('Fit');

			// Leaving puts the zoom away with it
			await page.keyboard.press('+');
			await toggle.click();
			await expect(chart).toBeVisible();
			await expect(level).toBeHidden();
			await expect.poll(async () => (await seek.boundingBox())!.height).toBeLessThan(before * 1.2);
		} finally {
			await cleanupSongAudio(song.id);
			await cleanupSongFiles(song.id);
			await safeDelete('songs', song.id);
		}
	});
});
