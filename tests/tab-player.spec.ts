import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { createSong } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';
import { adminClient } from './helpers/supabase-admin';

async function attachTab(songId: string, fixture: string, fileName: string) {
	const path = `songs/${songId}/${crypto.randomUUID()}.${fileName.split('.').pop()}`;
	const file = fs.readFileSync(fixture);
	const { error: uploadError } = await adminClient.storage
		.from('song-files')
		.upload(path, file, { contentType: 'application/octet-stream' });
	if (uploadError) throw new Error(uploadError.message);
	const { error } = await adminClient.from('song_files').insert({
		song_id: songId,
		storage_path: path,
		file_name: fileName,
		mime_type: 'application/octet-stream',
		file_size_bytes: file.length
	});
	if (error) throw new Error(error.message);
}

/**
 * Pretend the speakers are this far behind, and note when sound leaves the page, when
 * the cursor first moves and when a note first lights up.
 */
async function watchPlayback(page: Page, outputLatencySeconds: number) {
	await page.addInitScript((latency) => {
		const w = window as unknown as Record<string, number | null>;
		w.__sound = w.__cursorMoved = w.__highlighted = null;
		Object.defineProperty(AudioContext.prototype, 'outputLatency', { get: () => latency });
		const connect = AudioNode.prototype.connect as (...args: unknown[]) => unknown;
		let tapped = false;
		(AudioNode.prototype as unknown as { connect: unknown }).connect = function (
			this: AudioNode,
			destination: unknown,
			...rest: unknown[]
		) {
			if (destination instanceof AudioDestinationNode && !tapped) {
				tapped = true;
				const analyser = this.context.createAnalyser();
				analyser.fftSize = 256;
				connect.call(this, analyser);
				const samples = new Float32Array(analyser.fftSize);
				let startX: number | null = null;
				setInterval(() => {
					analyser.getFloatTimeDomainData(samples);
					const now = performance.now();
					if (w.__sound === null && samples.some((v) => Math.abs(v) > 0.001)) w.__sound = now;
					const x = document.querySelector('.at-cursor-beat')?.getBoundingClientRect().x;
					if (w.__sound === null) startX = x ?? null;
					else if (w.__cursorMoved === null && x !== undefined && startX !== null) {
						if (Math.abs(x - startX) > 0.5) w.__cursorMoved = now;
					}
					if (w.__highlighted === null && document.querySelector('.at-highlight')) {
						w.__highlighted = now;
					}
				}, 4);
			}
			return connect.call(this, destination, ...rest);
		};
	}, outputLatencySeconds);
}

const timings = (page: Page) =>
	page.evaluate(() => {
		const w = window as unknown as Record<string, number>;
		return { sound: w.__sound, cursorMoved: w.__cursorMoved, highlighted: w.__highlighted };
	});

test.describe('Tab player and the sound', () => {
	for (const [latency, floor, ceiling] of [
		[0.4, 300, 800],
		[0, 0, 250]
	]) {
		test(`with speakers ${latency * 1000} ms behind, the cursor waits that long`, async ({
			page,
			testUser
		}) => {
			const song = await createSong(page, testUser.id, { title: 'Sync Song' });
			try {
				await attachTab(song.id, 'tests/fixtures/sample.gp', 'sample.gp');
				await watchPlayback(page, latency);
				await page.goto(`/songs/${song.id}/practice`);
				const play = page.getByRole('button', { name: 'Play tab' });
				await expect(play).toBeEnabled({ timeout: 30_000 });
				await play.click();

				await expect.poll(async () => (await timings(page)).cursorMoved).not.toBeNull();
				await expect.poll(async () => (await timings(page)).highlighted).not.toBeNull();
				const { sound, cursorMoved, highlighted } = await timings(page);
				const cursorLag = cursorMoved - sound;
				expect(cursorLag).toBeGreaterThanOrEqual(floor);
				expect(cursorLag).toBeLessThan(ceiling);
				expect(highlighted - sound).toBeGreaterThanOrEqual(floor);
			} finally {
				await safeDelete('songs', song.id);
			}
		});
	}

	test('pausing stops the cursor at once, with nothing left to move it', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Pause Song' });
		try {
			await attachTab(song.id, 'tests/fixtures/sample.gp', 'sample.gp');
			await watchPlayback(page, 0.4);
			await page.goto(`/songs/${song.id}/practice`);
			await expect(page.getByRole('button', { name: 'Play tab' })).toBeEnabled({
				timeout: 30_000
			});
			await page.getByRole('button', { name: 'Play tab' }).click();
			await expect.poll(async () => (await timings(page)).cursorMoved).not.toBeNull();
			await page.waitForTimeout(1500);
			await page.getByRole('button', { name: 'Pause tab' }).click();

			const cursor = page.locator('.at-cursor-beat');
			const x = async () => (await cursor.boundingBox())?.x;
			await page.waitForTimeout(100);
			const stopped = await x();
			// Longer than the delay, so anything still queued would have fired
			await page.waitForTimeout(700);
			expect(await x()).toBe(stopped);
			await expect(page.locator('.at-highlight')).toHaveCount(0);
		} finally {
			await safeDelete('songs', song.id);
		}
	});
});
