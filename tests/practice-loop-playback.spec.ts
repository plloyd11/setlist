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
import http from 'node:http';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { createSong } from './helpers/factories';
import { adminClient } from './helpers/supabase-admin';
import { safeDelete, cleanupSongAudio } from './helpers/cleanup';

function makeWav(seconds: number, sampleRate = 8000): Buffer {
	const numSamples = seconds * sampleRate;
	const dataSize = numSamples * 2;
	const buf = Buffer.alloc(44 + dataSize);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + dataSize, 4);
	buf.write('WAVE', 8);
	buf.write('fmt ', 12);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(sampleRate, 24);
	buf.writeUInt32LE(sampleRate * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(dataSize, 40);
	for (let i = 0; i < numSamples; i++) {
		buf.writeInt16LE(Math.round(Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 8000), 44 + i * 2);
	}
	return buf;
}

function serveWav(wav: Buffer): Promise<{ port: number; close: () => void }> {
	return new Promise((resolve) => {
		const server = http
			.createServer((req, res) => {
				const m = req.headers.range ? /bytes=(\d+)-(\d*)/.exec(req.headers.range) : null;
				if (m) {
					const start = parseInt(m[1], 10);
					const end = m[2] ? parseInt(m[2], 10) : wav.length - 1;
					res.writeHead(206, {
						'Content-Type': 'audio/wav',
						'Content-Range': `bytes ${start}-${end}/${wav.length}`,
						'Accept-Ranges': 'bytes',
						'Content-Length': end - start + 1
					});
					res.end(wav.subarray(start, end + 1));
				} else {
					res.writeHead(200, {
						'Content-Type': 'audio/wav',
						'Accept-Ranges': 'bytes',
						'Content-Length': wav.length
					});
					res.end(wav);
				}
			})
			.listen(0, () => {
				const address = server.address();
				const port = typeof address === 'object' && address ? address.port : 0;
				resolve({ port, close: () => server.close() });
			});
	});
}

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

test('armed loop wraps to A, pre-roll wraps and resumes at A-2s', async ({ page, testUser }) => {
	test.setTimeout(120_000);
	const song = await createSong(page, testUser.id, { title: 'Loop Engine Song' });
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

	try {
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
		await expect(page.getByRole('button', { name: /Loop/ })).toHaveAttribute(
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
		close();
		await cleanupSongAudio(song.id);
		await safeDelete('songs', song.id);
	}
});
