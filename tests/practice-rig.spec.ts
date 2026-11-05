/**
 * Rig (interface input → NAM model → cab IR → headphones) E2E tests.
 *
 * Chromium's fake capture device stands in for an audio interface, and the fake UI
 * flag answers the input permission prompt. Audio itself is never asserted (suite
 * philosophy): these drive the panel, the file store, the two modes, persistence, and
 * the app-wide "Rig on" switch. A model loading without an error does show the NAM
 * engine (wasm in an AudioWorklet) came up.
 *
 * sample.nam is NeuralAmpModelerCore's example WaveNet model (MIT, Steven Atkinson).
 *
 * TONE3000 is faked at the network: its authorize page answers straight back to the
 * callback, as it does once someone picks a tone, and its API serves the fixtures.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Route } from '@playwright/test';
import { test, expect } from './fixtures';
import { createSong } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';

test.use({
	launchOptions: {
		args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
	}
});

const IR_FIXTURE = path.resolve('tests/fixtures/sample.wav');
const MODEL_FIXTURE = path.resolve('tests/fixtures/sample.nam');

test.describe('Rig', () => {
	test('sets up an input and an IR, stays on between screens, and comes back set up but off', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Rig Song' });
		try {
			await page.goto(`/songs/${song.id}/practice`);
			const panel = page.getByRole('region', { name: 'Rig', exact: true });

			// The fake UI flag counts as access already granted, so the inputs are named
			// from the start (the "Choose an input" step only shows before a first grant)
			const input = panel.getByRole('combobox', { name: 'Input', exact: true });
			await expect(input).toBeVisible();
			const deviceId = await input.locator('option:not([disabled])').first().getAttribute('value');
			expect(deviceId).toBeTruthy();
			await input.selectOption(deviceId!);

			// The real amp is the starting point: no amp model in the way
			await expect(panel.getByRole('button', { name: 'Real amp' })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await expect(panel.getByRole('combobox', { name: 'Amp model' })).toHaveCount(0);

			// An IR is kept in the browser and chosen as soon as it's added
			const ir = panel.getByRole('combobox', { name: 'Cab IR', exact: true });
			const irFile = panel.getByLabel('Cab IR file');
			await irFile.setInputFiles(IR_FIXTURE);
			await expect(ir.locator('option:checked')).toHaveText('sample');

			// Something that isn't audio is turned away
			await irFile.setInputFiles({
				name: 'notes.wav',
				mimeType: 'audio/wav',
				buffer: Buffer.from('not audio at all')
			});
			await expect(panel.getByRole('alert')).toContainText("Couldn't read notes.wav");
			await expect(ir.locator('option')).toHaveCount(2);

			const level = panel.getByRole('slider', { name: 'Level' });
			await expect(level).toHaveAttribute('aria-valuetext', '30%');
			await level.focus();
			await page.keyboard.press('ArrowUp');
			await expect(level).toHaveAttribute('aria-valuetext', '31%');

			const monitor = panel.getByRole('button', { name: 'Monitor' });
			await monitor.click();
			await expect(monitor).toHaveAttribute('aria-pressed', 'true');
			await expect(panel.getByText(/^\d+ ms$/)).toBeVisible();

			// Off the practice screens it keeps running, with a switch to turn it off
			const rigOn = page.getByRole('status').filter({ hasText: 'Rig on' });
			await expect(rigOn).toHaveCount(0);
			await page.getByRole('link', { name: 'Back' }).click();
			await expect(page).toHaveURL(/\/songs$/);
			await expect(rigOn).toBeVisible();
			await rigOn.getByRole('button', { name: 'Turn off' }).click();
			await expect(rigOn).toHaveCount(0);

			// A fresh load remembers the setup, but never comes back live
			await page.goto(`/songs/${song.id}/practice`);
			await expect(input).toHaveValue(deviceId!);
			await expect(ir.locator('option:checked')).toHaveText('sample');
			await expect(level).toHaveAttribute('aria-valuetext', '31%');
			await expect(monitor).toHaveAttribute('aria-pressed', 'false');

			// Removing the IR forgets it
			await panel.getByRole('button', { name: 'Remove this IR' }).click();
			await expect(ir.locator('option')).toHaveCount(1);
			await expect(ir).toHaveValue('');
		} finally {
			await safeDelete('songs', song.id);
		}
	});

	test('NAM mode loads an amp model, and each mode keeps its own settings', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'NAM Song' });
		try {
			await page.goto(`/songs/${song.id}/practice`);
			const panel = page.getByRole('region', { name: 'Rig', exact: true });
			const input = panel.getByRole('combobox', { name: 'Input', exact: true });
			const deviceId = await input.locator('option:not([disabled])').first().getAttribute('value');
			await input.selectOption(deviceId!);

			// The real amp's side: an IR, and the load box's input gain left at 0 dB
			const ir = panel.getByRole('combobox', { name: 'Cab IR', exact: true });
			await panel.getByLabel('Cab IR file').setInputFiles(IR_FIXTURE);
			await expect(ir.locator('option:checked')).toHaveText('sample');
			const gain = panel.getByRole('slider', { name: 'Input', exact: true });
			await expect(gain).toHaveAttribute('aria-valuetext', '0.0 dB');

			// NAM: a guitar straight in wants more gain, and its own (here, no) IR
			const namMode = panel.getByRole('button', { name: 'NAM', exact: true });
			await namMode.click();
			await expect(namMode).toHaveAttribute('aria-pressed', 'true');
			await expect(ir).toHaveValue('');
			await gain.focus();
			for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
			await expect(gain).toHaveAttribute('aria-valuetext', '+2.0 dB');

			// A file that isn't a NAM model is turned away
			const model = panel.getByRole('combobox', { name: 'Amp model', exact: true });
			const modelFile = panel.getByLabel('Amp model file');
			await modelFile.setInputFiles({
				name: 'notes.nam',
				mimeType: 'application/octet-stream',
				buffer: Buffer.from('{"not":"a model"}')
			});
			await expect(panel.getByRole('alert')).toContainText("notes.nam isn't a NAM model");
			await expect(model.locator('option')).toHaveCount(1);

			await modelFile.setInputFiles(MODEL_FIXTURE);
			await expect(model.locator('option:checked')).toHaveText('sample');

			// Live, the model loads into the wasm engine with no complaint
			const monitor = panel.getByRole('button', { name: 'Monitor' });
			await monitor.click();
			await expect(monitor).toHaveAttribute('aria-pressed', 'true');
			await expect(panel.getByText('Loading the model…')).toHaveCount(0, { timeout: 10_000 });
			await expect(panel.getByRole('alert')).toHaveCount(0);

			// One tap back to the real amp brings back its settings, still live
			await panel.getByRole('button', { name: 'Real amp' }).click();
			await expect(gain).toHaveAttribute('aria-valuetext', '0.0 dB');
			await expect(ir.locator('option:checked')).toHaveText('sample');
			await expect(model).toHaveCount(0);
			await expect(monitor).toHaveAttribute('aria-pressed', 'true');

			// And back again, after a reload: mode, model and gain all remembered
			await namMode.click();
			await page.goto(`/songs/${song.id}/practice`);
			await expect(namMode).toHaveAttribute('aria-pressed', 'true');
			await expect(model.locator('option:checked')).toHaveText('sample');
			await expect(gain).toHaveAttribute('aria-valuetext', '+2.0 dB');
			await expect(ir).toHaveValue('');

			// Removing the model forgets it
			await panel.getByRole('button', { name: 'Remove this model' }).click();
			await expect(model.locator('option')).toHaveCount(1);
		} finally {
			await safeDelete('songs', song.id);
		}
	});

	test('browses TONE3000 for an A2 capture and a cab IR, and keeps who made them', async ({
		page,
		context,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'TONE3000 Song' });
		const fake = fakeTone3000();
		await context.route(`${T3K}/**`, fake.handle);
		try {
			await page.goto(`/songs/${song.id}/practice`);
			const panel = page.getByRole('region', { name: 'Rig', exact: true });
			const input = panel.getByRole('combobox', { name: 'Input', exact: true });
			await expect(input).toBeVisible();
			const browseIrs = panel.getByRole('button', { name: 'Browse TONE3000 for cab IRs' });
			test.skip(
				(await browseIrs.count()) === 0,
				'The dev server has no PUBLIC_TONE3000_CLIENT_ID (a reused server needs one in .env)'
			);
			const deviceId = await input.locator('option:not([disabled])').first().getAttribute('value');
			await input.selectOption(deviceId!);
			await panel.getByRole('button', { name: 'NAM', exact: true }).click();
			const browseAmps = panel.getByRole('button', { name: 'Browse TONE3000 for amps' });

			// Closing TONE3000's window without picking goes back to the button
			fake.holdPicker = true;
			const [picker] = await Promise.all([page.waitForEvent('popup'), browseAmps.click()]);
			await expect(panel.getByText('Pick an amp in the TONE3000 window.')).toBeVisible();
			await picker.close();
			await expect(browseAmps).toBeVisible();
			fake.holdPicker = false;

			// A pick: the window comes back, and the tone's A2 captures are listed
			await browseAmps.click();
			const card = panel.getByRole('list', { name: 'Files in Plexi Test' });
			await expect(card).toBeVisible();
			const authorize = fake.authorized.at(-1)!;
			expect(authorize.get('prompt')).toBe('select_tone');
			expect(authorize.get('format')).toBe('nam');
			expect(authorize.get('architecture')).toBe('2');
			expect(authorize.get('client_id')).toBeTruthy();
			expect(authorize.get('redirect_uri')).toMatch(/\/auth\/tone3000$/);
			// PKCE: the verifier sent with the code is the one the challenge was made from
			const exchange = fake.tokenRequests.at(-1)!;
			expect(exchange.get('grant_type')).toBe('authorization_code');
			expect(exchange.get('code')).toBe('code-nam');
			expect(authorize.get('code_challenge_method')).toBe('S256');
			expect(authorize.get('code_challenge')).toBe(
				createHash('sha256').update(exchange.get('code_verifier')!).digest('base64url')
			);
			expect(fake.toneQueries.get('/api/v1/models')?.get('architecture')).toBe('2');

			// What TONE3000's terms ask to be shown with a tone
			await expect(panel.getByRole('link', { name: 'Plexi Test' })).toBeVisible();
			await expect(panel.getByText('Test Creator')).toBeVisible();
			await expect(panel.getByText('Amp head · NAM · CC BY')).toBeVisible();
			await expect(panel.getByRole('link', { name: 'Powered by TONE3000' })).toBeVisible();

			const model = panel.getByRole('combobox', { name: 'Amp model', exact: true });
			await expect(card.getByRole('listitem')).toHaveCount(2);
			await card.getByRole('button', { name: 'Add Crunch' }).click();
			await expect(model.locator('option:checked')).toHaveText('Plexi Test – Crunch');
			await expect(card.getByRole('listitem').filter({ hasText: 'Crunch' })).toContainText(
				'In use'
			);
			expect(fake.downloadAuth).toEqual(['Bearer access-1']);

			// A cab tone with one IR goes straight in, for the mode that's on
			await browseIrs.click();
			const ir = panel.getByRole('combobox', { name: 'Cab IR', exact: true });
			await expect(ir.locator('option:checked')).toHaveText('V30 Test – SM57');
			const cabAuthorize = fake.authorized.at(-1)!;
			expect(cabAuthorize.get('format')).toBe('ir');
			expect(cabAuthorize.get('gears')).toBe('cab');
			expect(cabAuthorize.has('architecture')).toBe(false);
			await panel.getByRole('button', { name: 'Close V30 Test' }).click();

			// The model's credit stays with it, after a reload too
			const credit = panel.getByText('By Test Creator · CC BY · On TONE3000');
			await expect(credit).toBeVisible();
			await expect(credit.getByRole('link', { name: 'On TONE3000' })).toHaveAttribute(
				'href',
				'https://www.tone3000.com/tones/plexi-test-42'
			);
			await expect(panel.getByText('By Cab Maker · CC0 · On TONE3000')).toBeVisible();
			await page.goto(`/songs/${song.id}/practice`);
			await expect(credit).toBeVisible();

			// Picking the same capture again uses the copy already here
			await browseAmps.click();
			await expect(card.getByRole('listitem').filter({ hasText: 'Crunch' })).toContainText(
				'In use'
			);
			await card.getByRole('button', { name: 'Add Lead' }).click();
			await expect(model.locator('option:checked')).toHaveText('Plexi Test – Lead');
			await card.getByRole('button', { name: 'Use Crunch' }).click();
			await expect(model.locator('option:checked')).toHaveText('Plexi Test – Crunch');
			await expect(model.locator('option')).toHaveCount(3);
			expect(fake.downloadAuth).toHaveLength(3);
		} finally {
			await safeDelete('songs', song.id);
		}
	});
});

const T3K = 'https://www.tone3000.com';
const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': '*',
	'access-control-allow-methods': '*'
};

/** Just enough of TONE3000: the Select flow, a tone of two A2 captures, and a cab IR */
function fakeTone3000() {
	const tones = {
		'42': {
			id: 42,
			title: 'Plexi Test',
			url: `${T3K}/tones/plexi-test-42`,
			gear: 'amp',
			format: 'nam',
			license: 'cc-by',
			images: [],
			user: {
				username: 'testcreator',
				display_name: 'Test Creator',
				avatar_url: null,
				url: `${T3K}/testcreator`
			}
		},
		'77': {
			id: 77,
			title: 'V30 Test',
			url: `${T3K}/tones/v30-test-77`,
			gear: 'cab',
			format: 'ir',
			license: 'cco',
			images: null,
			user: { username: 'Cab Maker', display_name: null, avatar_url: null, url: `${T3K}/cabmaker` }
		}
	};
	const models = {
		'42': [
			{ id: 501, name: 'Crunch', size: 'standard', model_url: `${T3K}/api/v1/models/501/download` },
			{ id: 502, name: 'Lead', size: 'standard', model_url: `${T3K}/api/v1/models/502/download` }
		],
		'77': [
			{ id: 701, name: 'SM57', size: 'standard', model_url: `${T3K}/api/v1/models/701/download` }
		]
	};
	const files: Record<string, Buffer> = {
		'501': readFileSync(MODEL_FIXTURE),
		'502': readFileSync(MODEL_FIXTURE),
		'701': readFileSync(IR_FIXTURE)
	};

	const fake = {
		/** Leave the picker open, as if they're still browsing */
		holdPicker: false,
		authorized: [] as URLSearchParams[],
		tokenRequests: [] as URLSearchParams[],
		toneQueries: new Map<string, URLSearchParams>(),
		downloadAuth: [] as (string | undefined)[],
		handle: async (route: Route) => {
			const request = route.request();
			const url = new URL(request.url());
			if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

			if (url.pathname === '/api/v1/oauth/authorize') {
				fake.authorized.push(url.searchParams);
				if (fake.holdPicker) {
					return route.fulfill({ contentType: 'text/html', body: '<h1>TONE3000</h1>' });
				}
				const kind = url.searchParams.get('format');
				const back = new URL(url.searchParams.get('redirect_uri')!);
				back.searchParams.set('code', `code-${kind}`);
				back.searchParams.set('state', url.searchParams.get('state')!);
				back.searchParams.set('tone_id', kind === 'ir' ? '77' : '42');
				return route.fulfill({ status: 302, headers: { location: back.toString() } });
			}
			if (url.pathname === '/api/v1/oauth/token') {
				fake.tokenRequests.push(new URLSearchParams(request.postData() ?? ''));
				return route.fulfill({
					headers: CORS,
					json: {
						access_token: 'access-1',
						refresh_token: 'refresh-1',
						token_type: 'bearer',
						expires_in: 3600,
						scope: 'read'
					}
				});
			}
			const tone = url.pathname.match(/^\/api\/v1\/tones\/(\d+)$/)?.[1];
			if (tone && tone in tones) {
				return route.fulfill({ headers: CORS, json: tones[tone as keyof typeof tones] });
			}
			if (url.pathname === '/api/v1/models') {
				fake.toneQueries.set(url.pathname, url.searchParams);
				const list = models[url.searchParams.get('tone_id') as keyof typeof models] ?? [];
				return route.fulfill({
					headers: CORS,
					json: { data: list, page: 1, page_size: 100, total: list.length, total_pages: 1 }
				});
			}
			const download = url.pathname.match(/^\/api\/v1\/models\/(\d+)\/download$/)?.[1];
			if (download && files[download]) {
				fake.downloadAuth.push((await request.headerValue('authorization')) ?? undefined);
				return route.fulfill({ headers: CORS, body: files[download] });
			}
			return route.fulfill({ status: 404, headers: CORS, json: { error: 'not_found' } });
		}
	};
	return fake;
}
