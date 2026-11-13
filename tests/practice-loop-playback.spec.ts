/**
 * Real-playback test for the practice loop engine (A/B wrap + pre-roll).
 *
 * The rest of the suite never plays audio; this spec does, because the loop
 * engine only acts while the media clock advances. Two environment quirks are
 * worked around here:
 * - Chromium aborts media requests that go through Playwright interception,
 *   and stalls on the storage URL after a pre-play seek — so the media `src`
 *   is rewritten in-page to a local HTTP server (range-capable).
 * - The loop region is created by dragging on the waveform (not [`/`]`), so
 *   playback starts with no pending seek.
 */
import crypto from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { createSong } from './helpers/factories';
import { adminClient } from './helpers/supabase-admin';
import { safeDelete, cleanupSongAudio } from './helpers/cleanup';
import { makeWav, serveWav } from './helpers/audio-server';

/** Poll the seek slider until its value drops (a loop wrap); returns the landing value. */
async function waitForWrap(page: Page, deadlineMs = 15_000): Promise<number> {
	const seek = page.getByRole('slider', { name: 'Seek' });
	let prev = Number(await seek.getAttribute('aria-valuenow'));
	const deadline = Date.now() + deadlineMs;
	while (Date.now() < deadline) {
		await page.waitForTimeout(100);
		const now = Number(await seek.getAttribute('aria-valuenow'));
		if (now < prev) return now;
		prev = now;
	}
	throw new Error('loop never wrapped');
}

/** A song with a 30s mix, served from a local server so it can really play. */
async function openPlayable(page: Page, userId: string, title: string) {
	const song = await createSong(page, userId, { title });
	const wav = makeWav(30);
	const storagePath = `songs/${song.id}/${crypto.randomUUID()}.wav`;
	const { error: upErr } = await adminClient.storage
		.from('song-audio')
		.upload(storagePath, wav, { contentType: 'audio/wav' });
	if (upErr) throw new Error(upErr.message);
	const { error: insErr } = await adminClient.from('song_audio').insert({
		song_id: song.id,
		label: 'Full mix',
		storage_path: storagePath,
		file_name: 'loop.wav',
		mime_type: 'audio/wav',
		file_size_bytes: wav.length,
		duration_seconds: 30,
		waveform_peaks: Array.from({ length: 100 }, (_, i) => Math.abs(Math.sin(i / 5)))
	});
	if (insErr) throw new Error(insErr.message);
	const { port, close } = await serveWav(wav);

	await page.addInitScript(
		({ port }) => {
			const desc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'src')!;
			Object.defineProperty(HTMLMediaElement.prototype, 'src', {
				get() {
					return desc.get!.call(this);
				},
				set(v: string) {
					desc.set!.call(
						this,
						v.includes('/storage/v1/object/sign/song-audio/')
							? `http://localhost:${port}/loop.wav`
							: v
					);
				}
			});
		},
		{ port }
	);

	return {
		song,
		async cleanup() {
			close();
			await cleanupSongAudio(song.id);
			await safeDelete('songs', song.id);
		}
	};
}

test('armed loop wraps to A, pre-roll wraps and resumes at A-2s', async ({ page, testUser }) => {
	test.setTimeout(120_000);
	const { song, cleanup } = await openPlayable(page, testUser.id, 'Loop Engine Song');

	try {
		await page.goto(`/songs/${song.id}/practice`);
		await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 });

		// Drag a region from ~1/6 to ~1/3 of the 30s waveform ≈ 5s–10s
		const waveform = page.getByRole('slider', { name: 'Seek' });
		const box = (await waveform.boundingBox())!;
		await page.mouse.move(box.x + box.width / 6, box.y + box.height / 2);
		await page.mouse.down();
		await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2, { steps: 8 });
		await page.mouse.up();
		await expect(page.locator('[part~="region"]')).toBeVisible();

		// Play from 0; arm the loop once the playhead is inside the region
		const seek = page.getByRole('slider', { name: 'Seek' });
		await page.getByRole('button', { name: 'Play' }).click();
		await expect
			.poll(async () => Number(await seek.getAttribute('aria-valuenow')), { timeout: 15_000 })
			.toBeGreaterThanOrEqual(6);
		await page.getByRole('heading', { name: 'Loop Engine Song' }).click();
		await page.keyboard.press('l');
		await expect(page.getByRole('button', { name: 'Loop', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		// Without pre-roll the wrap lands at A (≈5)
		const plainWrap = await waitForWrap(page);
		expect(plainWrap).toBeGreaterThanOrEqual(4);
		expect(plainWrap).toBeLessThanOrEqual(6);

		// With pre-roll the wrap lands at A-2 (≈3)
		await page.getByRole('button', { name: 'Pre-roll 2s' }).click();
		await expect(page.getByRole('button', { name: 'Pre-roll 2s' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		const preRollWrap = await waitForWrap(page);
		expect(preRollWrap).toBeGreaterThanOrEqual(2);
		expect(preRollWrap).toBeLessThanOrEqual(4);

		// Pause inside the region, resume: the transport starts from the lead-in
		await expect
			.poll(async () => Number(await seek.getAttribute('aria-valuenow')), { timeout: 15_000 })
			.toBeGreaterThanOrEqual(6);
		await page.getByRole('heading', { name: 'Loop Engine Song' }).click();
		await page.keyboard.press(' ');
		await page.waitForTimeout(300);
		await page.keyboard.press(' ');
		await page.waitForTimeout(400);
		const resumed = Number(await seek.getAttribute('aria-valuenow'));
		expect(resumed).toBeGreaterThanOrEqual(2);
		expect(resumed).toBeLessThanOrEqual(5);
	} finally {
		await cleanup();
	}
});

test('a stop stays put, or goes back to where the pass started', async ({ page, testUser }) => {
	test.setTimeout(120_000);
	const { song, cleanup } = await openPlayable(page, testUser.id, 'Stop Mode Song');

	try {
		await page.goto(`/songs/${song.id}/practice`);
		await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 });
		const seek = page.getByRole('slider', { name: 'Seek' });
		const position = async () => Number(await seek.getAttribute('aria-valuenow'));
		const heading = page.getByRole('heading', { name: 'Stop Mode Song' });
		const returnOnStop = page.getByRole('button', { name: 'Return on stop' });
		const playTo = async (seconds: number) => {
			await page.keyboard.press(' ');
			await expect.poll(position, { timeout: 15_000 }).toBeGreaterThanOrEqual(seconds);
		};

		// As it comes: Space pauses, and the playhead stays where it stopped
		await heading.click();
		await expect(returnOnStop).toHaveAttribute('aria-pressed', 'false');
		await playTo(2);
		await page.keyboard.press(' ');
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
		await page.waitForTimeout(300);
		const paused = await position();
		expect(paused).toBeGreaterThanOrEqual(2);

		// Shift+Space is the other kind of stop: back to where this pass started
		await playTo(paused + 2);
		await page.keyboard.press('Shift+Space');
		await expect(seek).toHaveAttribute('aria-valuenow', String(paused));

		// Switched on, every stop goes back, and the key says Stop
		await returnOnStop.click();
		await expect(returnOnStop).toHaveAttribute('aria-pressed', 'true');
		await heading.click();
		await playTo(paused + 2);
		await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible();
		await page.keyboard.press(' ');
		await expect(seek).toHaveAttribute('aria-valuenow', String(paused));

		// Moving the playhead by hand moves the place it goes back to
		await page.keyboard.press('ArrowRight');
		await page.keyboard.press('ArrowRight');
		await expect(seek).toHaveAttribute('aria-valuenow', String(paused + 10));
		await playTo(paused + 12);
		await page.keyboard.press(' ');
		await expect(seek).toHaveAttribute('aria-valuenow', String(paused + 10));

		// And Shift+Space now stays put
		await playTo(paused + 12);
		await page.keyboard.press('Shift+Space');
		await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
		await page.waitForTimeout(300);
		expect(await position()).toBeGreaterThanOrEqual(paused + 12);

		// It's the musician's habit, not the song's: still on after a reload
		await page.reload();
		await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 15_000 });
		await expect(returnOnStop).toHaveAttribute('aria-pressed', 'true');
	} finally {
		await cleanup();
	}
});
