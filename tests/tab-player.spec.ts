import fs from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { createSong } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';
import { adminClient } from './helpers/supabase-admin';

async function attachTab(songId: string, fixture: string | Buffer, fileName: string) {
	const path = `songs/${songId}/${crypto.randomUUID()}.${fileName.split('.').pop()}`;
	const file = typeof fixture === 'string' ? fs.readFileSync(fixture) : fixture;
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

test.describe('TuxGuitar files', () => {
	const fixture = (name: string) => `tests/fixtures/tuxguitar/${name}`;

	async function openTab(page: Page, songId: string) {
		await page.goto(`/songs/${songId}/practice`);
		await expect(page.getByRole('button', { name: 'Play tab' })).toBeEnabled({ timeout: 30_000 });
	}

	test('both generations of the format read as the same song', async ({ page, testUser }) => {
		await page.setViewportSize({ width: 1500, height: 1300 });
		const seen: { texts: string[]; length: string | null }[] = [];
		for (const file of ['reference_15.tg', 'reference_20.tg']) {
			const song = await createSong(page, testUser.id, { title: file });
			try {
				await attachTab(song.id, fixture(file), file);
				await openTab(page, song.id);
				await expect(page.getByLabel('Track')).toContainText('Track 3');
				seen.push({
					texts: await page.locator('.at-surface text').allTextContents(),
					length: await page.getByText(/\d:\d\d \/ \d:\d\d/).textContent()
				});
			} finally {
				await safeDelete('songs', song.id);
			}
		}
		const [old, current] = seen;
		expect(old).toEqual(current);
		expect(current.length).toContain('1:20');
		// The song's chords, markers, repeats and tempo all made it across
		for (const expected of ['C6add9', 'testMarker', 'testText', 'x4', ' = 100']) {
			expect(current.texts).toContain(expected);
		}
	});

	test('strings land the right way up, low strings at the bottom', async ({ page, testUser }) => {
		await page.setViewportSize({ width: 1500, height: 1300 });
		const song = await createSong(page, testUser.id, { title: 'Open Strings' });
		try {
			// Its first six bars play the open strings, from string 6 up to string 1
			await attachTab(song.id, fixture('demo_20.tg'), 'demo_20.tg');
			await openTab(page, song.id);
			const heights = await page
				.locator('.at-surface text', { hasText: /^0$/ })
				.evaluateAll((frets) => frets.slice(0, 6).map((f) => f.getBoundingClientRect().y));
			expect(heights).toHaveLength(6);
			for (let i = 1; i < heights.length; i++) {
				expect(heights[i]).toBeLessThan(heights[i - 1]);
			}
		} finally {
			await safeDelete('songs', song.id);
		}
	});

	test('a drum track shows notation and no tab, and the song plays', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Drum Track' });
		try {
			await attachTab(song.id, fixture('drums_handmade.tg'), 'drums_handmade.tg');
			await openTab(page, song.id);
			// The guitar track is tab, so its frets are there as numbers
			await expect(page.locator('.at-surface text', { hasText: /^3$/ }).first()).toBeVisible();

			await page.getByLabel('Track').selectOption({ label: 'Drums' });
			// The percussion clef, in the music font. Waiting for it also means the redraw is done.
			await expect(page.locator('.at-surface text', { hasText: '\ue069' })).toHaveCount(1);
			await expect(page.locator('.at-surface text', { hasText: /^3$/ })).toHaveCount(0);
			// A drum's MIDI key must not be drawn as if it were a fret
			await expect(page.locator('.at-surface text', { hasText: /^(36|38|42)$/ })).toHaveCount(0);

			await page.getByRole('button', { name: 'Play tab' }).click();
			await expect(page.getByText(/^0:0[1-9] \/ 0:04$/)).toBeVisible({ timeout: 5000 });
		} finally {
			await safeDelete('songs', song.id);
		}
	});

	test('can be uploaded from the song, and opens from there', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Upload A Tab' });
		try {
			await page.goto('/songs');
			await page.getByText('Upload A Tab').click();
			const panel = page.getByRole('dialog');
			await panel
				.locator('input[type="file"][accept*=".tg"]')
				.setInputFiles(fixture('reference_20.tg'));
			await panel.getByRole('button', { name: 'Upload chart' }).click();
			// The name shows as soon as it's picked. This only shows once it's saved.
			await expect(panel.getByText('1 chart')).toBeVisible({ timeout: 15_000 });

			await openTab(page, song.id);
			await expect(
				page.locator('.at-surface text', { hasText: 'testMarker' }).first()
			).toBeVisible();
		} finally {
			await safeDelete('songs', song.id);
		}
	});

	const unreadable: [string, Buffer][] = [
		['garbage', Buffer.from('this is not a tab at all')],
		// The binary layout from before TuxGuitar 1.3
		[
			'an older format',
			Buffer.concat([
				Buffer.from([27]),
				Buffer.from(Array.from('TuxGuitar File Format - 1.2').flatMap((c) => [0, c.charCodeAt(0)])),
				Buffer.alloc(64)
			])
		],
		// A zip, but a Guitar Pro one with the wrong extension
		['a zip of something else', fs.readFileSync('tests/fixtures/sample.gp')]
	];
	for (const [description, bytes] of unreadable) {
		test(`${description} offers the download instead`, async ({ page, testUser }) => {
			const song = await createSong(page, testUser.id, { title: 'Broken Tab' });
			try {
				await attachTab(song.id, bytes, 'broken.tg');
				await page.goto(`/songs/${song.id}/practice`);
				await expect(page.getByRole('alert')).toContainText("Couldn't open this file");
				await expect(page.getByRole('link', { name: 'Download it instead' })).toBeVisible();
			} finally {
				await safeDelete('songs', song.id);
			}
		});
	}
});
