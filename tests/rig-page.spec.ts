/**
 * The Rig page (/rig): the same engine as the practice panel, with the whole chain,
 * saved rigs and the library of models and IRs.
 *
 * As in practice-rig.spec.ts, Chromium's fake capture device stands in for an audio
 * interface, and what comes out of the speakers is never asserted: these drive the
 * board, the saved rigs, the library, the two IR slots, the sync with the account,
 * and the ways between this page and the practice screens.
 *
 * One test does read the meters, because nothing else shows they're wired up. It only
 * asks that they read while the rig is live, go dark when it's off, and fall when the
 * input gain is cut: nothing about what the fake device's level actually is.
 *
 * Whether another account can get at a synced IR is rig-irs-rls.spec.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { createSong } from './helpers/factories';
import { cleanupRigIrs, safeDelete } from './helpers/cleanup';
import { fakeTone3000, T3K } from './helpers/tone3000';

test.use({
	launchOptions: {
		args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
	}
});

const IR_FIXTURE = path.resolve('tests/fixtures/sample.wav');
const MODEL_FIXTURE = path.resolve('tests/fixtures/sample.nam');

/** Requests to the account's copy of the IRs: the table and the bucket */
function toAccount(url: URL): boolean {
	return (
		url.pathname.includes('/rest/v1/rig_irs') ||
		(url.pathname.includes('/storage/v1/') && url.pathname.includes('rig-irs'))
	);
}

function board(page: Page) {
	return page.getByRole('region', { name: 'Rig', exact: true });
}

async function chooseInput(page: Page) {
	const input = board(page).getByRole('combobox', { name: 'Input', exact: true });
	await expect(input).toBeVisible();
	const deviceId = await input.locator('option:not([disabled])').first().getAttribute('value');
	expect(deviceId).toBeTruthy();
	await input.selectOption(deviceId!);
}

test.describe('Rig page', () => {
	// Uploaded IRs follow the account, and a worker's tests share one: start each clean
	test.beforeEach(({ testUser }) => cleanupRigIrs(testUser.id));
	test.afterEach(({ testUser }) => cleanupRigIrs(testUser.id));

	test('runs the rig from its own page, and saves rigs that load in one tap', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Saved Rig Song' });
		try {
			await page.goto('/rig');
			await expect(
				page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Rig' })
			).toHaveAttribute('aria-current', 'page');
			const rig = board(page);
			const status = rig.getByTestId('rig-status');
			await expect(status).toHaveText('Choose an input to get going.');
			await chooseInput(page);
			await expect(status).toHaveText('Ready. Turn Monitor on and play.');

			// The real amp's chain has no amp unit; its cab takes an IR
			await expect(rig.getByRole('group', { name: 'Amp', exact: true })).toHaveCount(0);
			const ir = rig.getByRole('combobox', { name: 'Cab IR', exact: true });
			await rig.getByLabel('Cab IR file').setInputFiles(IR_FIXTURE);
			await expect(ir.locator('option:checked')).toHaveText('sample');

			// Live: the footer says so, with the readings the browser gives
			const monitor = rig.getByRole('button', { name: 'Monitor' });
			await monitor.click();
			await expect(monitor).toHaveAttribute('aria-pressed', 'true');
			await expect(status).toHaveText('Live.');
			await expect(rig.getByText(/^\d+ ms$/)).toBeVisible();
			await expect(rig.getByText(/^[\d.]+ kHz$/)).toBeVisible();

			// This page has the switch, so the app's "Rig on" chip stays away until it's left.
			// The chip leads back here, still live.
			const rigOn = page.getByRole('status').filter({ hasText: 'Rig on' });
			await expect(rigOn).toHaveCount(0);
			await page
				.getByRole('navigation', { name: 'Main' })
				.getByRole('link', { name: 'Songs' })
				.click();
			await expect(page).toHaveURL(/\/songs$/);
			await rigOn.getByRole('link', { name: 'Rig on' }).click();
			await expect(page).toHaveURL(/\/rig$/);
			await expect(monitor).toHaveAttribute('aria-pressed', 'true');
			await expect(rigOn).toHaveCount(0);

			// Save what's dialed in
			const saved = page.getByRole('region', { name: 'Saved rigs' });
			const name = saved.getByLabel("Save what's dialed in");
			await name.fill('Crunch');
			await saved.getByRole('button', { name: 'Save', exact: true }).click();
			const crunch = saved.getByRole('button', { name: 'Load Crunch' });
			await expect(crunch).toHaveAttribute('aria-pressed', 'true');
			await expect(saved.getByRole('button', { name: 'Saved', exact: true })).toBeDisabled();

			// A change means it's no longer what was saved, and the same name saves over it
			const level = rig.getByRole('slider', { name: 'Level' });
			await level.focus();
			await page.keyboard.press('ArrowUp');
			await expect(level).toHaveAttribute('aria-valuetext', '31%');
			await expect(crunch).toHaveAttribute('aria-pressed', 'false');
			await saved.getByRole('button', { name: 'Update', exact: true }).click();
			await expect(crunch).toHaveAttribute('aria-pressed', 'true');
			await expect(saved.getByRole('listitem')).toHaveCount(1);

			// A NAM rig beside it: its own amp model, gain and (no) IR
			const namMode = rig.getByRole('button', { name: 'NAM', exact: true });
			await namMode.click();
			await expect(crunch).toHaveAttribute('aria-pressed', 'false');
			const model = rig.getByRole('combobox', { name: 'Amp model', exact: true });
			await rig.getByLabel('Amp model file').setInputFiles(MODEL_FIXTURE);
			await expect(model.locator('option:checked')).toHaveText('sample');
			await expect(rig.getByText('Loading the model…')).toHaveCount(0, { timeout: 10_000 });
			await name.fill('Direct');
			await saved.getByRole('button', { name: 'Save', exact: true }).click();
			const direct = saved.getByRole('button', { name: 'Load Direct' });
			await expect(direct).toHaveAttribute('aria-pressed', 'true');
			await expect(direct).toContainText('NAM · sample · No IR');

			// One tap back to the real amp's sound, still live
			await crunch.click();
			await expect(rig.getByRole('button', { name: 'Real amp' })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await expect(level).toHaveAttribute('aria-valuetext', '31%');
			await expect(ir.locator('option:checked')).toHaveText('sample');
			await expect(monitor).toHaveAttribute('aria-pressed', 'true');
			await expect(crunch).toContainText('Real amp · sample');

			// A saved rig can be renamed in place
			await saved.getByRole('button', { name: 'Rename Crunch' }).click();
			await saved.getByLabel('New name for Crunch').fill('Plexi crunch');
			await page.keyboard.press('Enter');
			await expect(saved.getByRole('button', { name: 'Load Plexi crunch' })).toBeVisible();

			// The practice panel offers the saved rigs, and a way to this page and back
			await page.goto(`/songs/${song.id}/practice`);
			const panel = page.getByRole('region', { name: 'Rig', exact: true });
			const preset = panel.getByRole('combobox', { name: 'Saved rig' });
			await expect(preset.locator('option:checked')).toHaveText('Plexi crunch');
			await expect(panel.getByRole('button', { name: 'Monitor' })).toHaveAttribute(
				'aria-pressed',
				'false'
			);
			await preset.selectOption({ label: 'Direct' });
			await expect(panel.getByRole('button', { name: 'NAM', exact: true })).toHaveAttribute(
				'aria-pressed',
				'true'
			);
			await expect(
				panel.getByRole('combobox', { name: 'Amp model', exact: true }).locator('option:checked')
			).toHaveText('sample');
			await panel.getByRole('link', { name: 'Open rig' }).click();
			await expect(page).toHaveURL(/\/rig\?from=/);
			await expect(
				page
					.getByRole('region', { name: 'Saved rigs' })
					.getByRole('button', { name: 'Load Direct' })
			).toHaveAttribute('aria-pressed', 'true');
			await page.getByRole('link', { name: 'Back to practice' }).click();
			await expect(page).toHaveURL(new RegExp(`/songs/${song.id}/practice$`));

			// Removing a saved rig asks first, and leaves its files in the library
			await page.goto('/rig');
			await page
				.getByRole('region', { name: 'Saved rigs' })
				.getByRole('button', { name: 'Remove Direct' })
				.click();
			const dialog = page.getByRole('dialog');
			await expect(dialog).toContainText('Remove Direct?');
			await dialog.getByRole('button', { name: 'Remove' }).click();
			await expect(
				page.getByRole('region', { name: 'Saved rigs' }).getByRole('listitem')
			).toHaveCount(1);
			await expect(
				page.getByRole('region', { name: 'Amp models' }).getByRole('listitem')
			).toHaveCount(1);
		} finally {
			await safeDelete('songs', song.id);
		}
	});

	test('the library takes a batch of files, renames them, and asks before removing', async ({
		page
	}) => {
		await page.goto('/rig');
		await chooseInput(page);
		const rig = board(page);
		const irs = page.getByRole('region', { name: 'Cab IRs' });
		const ir = rig.getByRole('combobox', { name: 'Cab IR', exact: true });
		const wav = readFileSync(IR_FIXTURE);

		// A batch is kept without being chosen, and what isn't a model or an IR is named
		await irs.getByLabel('Add cab IRs').setInputFiles([
			{ name: 'V30 SM57.wav', mimeType: 'audio/wav', buffer: wav },
			{ name: 'Greenback R121.wav', mimeType: 'audio/wav', buffer: wav },
			{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }
		]);
		await expect(irs.getByRole('listitem')).toHaveCount(2);
		await expect(rig.getByRole('alert')).toContainText(
			"notes.txt isn't a .nam model or a .wav IR."
		);
		await expect(ir).toHaveValue('');

		// Use puts one in the chain
		const v30 = irs.getByRole('listitem').filter({ hasText: 'V30 SM57' });
		await v30.getByRole('button', { name: 'Use: V30 SM57' }).click();
		await expect(ir.locator('option:checked')).toHaveText('V30 SM57');
		await expect(v30).toContainText('In use');

		// Files dropped anywhere on the page land here too: a model, by its extension.
		// Not in NAM mode, it's offered for NAM rather than put in the real amp's way.
		const dropped = readFileSync(MODEL_FIXTURE).toString('base64');
		await page.evaluate((base64) => {
			const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
			const transfer = new DataTransfer();
			transfer.items.add(new File([bytes], 'Dropped Plexi.nam'));
			for (const type of ['dragenter', 'dragover', 'drop']) {
				window.dispatchEvent(
					new DragEvent(type, { dataTransfer: transfer, bubbles: true, cancelable: true })
				);
			}
		}, dropped);
		const models = page.getByRole('region', { name: 'Amp models' });
		await expect(models.getByRole('listitem')).toHaveCount(1);
		await expect(models.getByRole('listitem')).toContainText('Dropped Plexi');

		// A rename shows everywhere the file does, and lasts a reload
		await v30.getByRole('button', { name: 'Rename V30 SM57' }).click();
		await irs.getByLabel('New name for V30 SM57').fill('Mesa 4x12');
		await page.keyboard.press('Enter');
		await expect(ir.locator('option:checked')).toHaveText('Mesa 4x12');
		await page.reload();
		await expect(ir.locator('option:checked')).toHaveText('Mesa 4x12');
		await expect(irs.getByRole('listitem')).toHaveCount(2);

		// Removing asks first, says which saved rigs it touches, and comes out of them
		const saved = page.getByRole('region', { name: 'Saved rigs' });
		await saved.getByLabel("Save what's dialed in").fill('Clean');
		await saved.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(saved.getByRole('button', { name: 'Load Clean' })).toContainText(
			'Real amp · Mesa 4x12'
		);
		const mesa = irs.getByRole('listitem').filter({ hasText: 'Mesa 4x12' });
		await expect(mesa).toContainText('1 saved rig');
		await mesa.getByRole('button', { name: 'Remove Mesa 4x12' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('One saved rig uses it');
		await dialog.getByRole('button', { name: 'Cancel' }).click();
		await expect(irs.getByRole('listitem')).toHaveCount(2);
		await mesa.getByRole('button', { name: 'Remove Mesa 4x12' }).click();
		await dialog.getByRole('button', { name: 'Remove' }).click();
		await expect(irs.getByRole('listitem')).toHaveCount(1);
		await expect(ir).toHaveValue('');
		await expect(saved.getByRole('button', { name: 'Load Clean' })).toContainText(
			'Real amp · No IR'
		);

		// The model is offered for NAM, and using it goes there
		await models.getByRole('button', { name: 'Use in NAM: Dropped Plexi' }).click();
		await expect(rig.getByRole('button', { name: 'NAM', exact: true })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(
			rig.getByRole('combobox', { name: 'Amp model', exact: true }).locator('option:checked')
		).toHaveText('Dropped Plexi');
	});

	test('a second IR blends with the first, and the blend is part of the rig', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Blend Song' });
		const wav = readFileSync(IR_FIXTURE);
		try {
			await page.goto('/rig');
			await chooseInput(page);
			const rig = board(page);
			const first = rig.getByRole('combobox', { name: 'Cab IR', exact: true });
			const second = rig.getByRole('combobox', { name: 'Second IR', exact: true });
			const blend = rig.getByRole('slider', { name: 'Blend' });

			// One IR is the whole sound: there's nothing to blend yet
			await rig
				.getByLabel('Cab IR file')
				.setInputFiles({ name: 'V30 SM57.wav', mimeType: 'audio/wav', buffer: wav });
			await expect(first.locator('option:checked')).toHaveText('V30 SM57');
			await expect(blend).toHaveAttribute('aria-disabled', 'true');
			await expect(blend).toHaveAttribute('aria-valuetext', 'Off');

			// A second one goes in beside it, at an even mix
			await rig
				.getByLabel('Second IR file')
				.setInputFiles({ name: 'V30 R121.wav', mimeType: 'audio/wav', buffer: wav });
			await expect(second.locator('option:checked')).toHaveText('V30 R121');
			await expect(first.locator('option:checked')).toHaveText('V30 SM57');
			await expect(blend).toHaveAttribute('aria-disabled', 'false');
			await expect(blend).toHaveAttribute('aria-valuetext', '50 / 50');

			// Live, both load and the blend moves with no complaint
			const monitor = rig.getByRole('button', { name: 'Monitor' });
			await monitor.click();
			await expect(monitor).toHaveAttribute('aria-pressed', 'true');
			await blend.focus();
			await page.keyboard.press('ArrowUp');
			await page.keyboard.press('ArrowUp');
			await expect(blend).toHaveAttribute('aria-valuetext', '40 / 60');
			await expect(rig.getByText('mostly the second')).toBeVisible();
			await expect(rig.getByRole('alert')).toHaveCount(0);

			// Both IRs and the blend are part of a saved rig
			const saved = page.getByRole('region', { name: 'Saved rigs' });
			await saved.getByLabel("Save what's dialed in").fill('Two mics');
			await saved.getByRole('button', { name: 'Save', exact: true }).click();
			const twoMics = saved.getByRole('button', { name: 'Load Two mics' });
			await expect(twoMics).toContainText('Real amp · V30 SM57 + V30 R121');
			await expect(twoMics).toHaveAttribute('aria-pressed', 'true');
			await page.keyboard.press('Tab');
			await blend.focus();
			await page.keyboard.press('ArrowDown');
			await expect(twoMics).toHaveAttribute('aria-pressed', 'false');
			await page.keyboard.press('ArrowUp');
			await expect(twoMics).toHaveAttribute('aria-pressed', 'true');

			// The practice panel shows the second IR and the blend once there is one,
			// and can drop it
			await page.goto(`/songs/${song.id}/practice`);
			const panel = page.getByRole('region', { name: 'Rig', exact: true });
			const panelSecond = panel.getByRole('combobox', { name: 'Second IR', exact: true });
			await expect(panelSecond.locator('option:checked')).toHaveText('V30 R121');
			await expect(panel.getByRole('slider', { name: 'Blend' })).toHaveAttribute(
				'aria-valuetext',
				'40 / 60'
			);
			await panelSecond.selectOption('');
			await expect(panelSecond).toHaveCount(0);
			await expect(panel.getByRole('slider', { name: 'Blend' })).toHaveCount(0);

			// An IR sits in one place: choosing the second as the first moves it
			await page.goto('/rig');
			await second.selectOption({ label: 'V30 R121' });
			await expect(blend).toHaveAttribute('aria-disabled', 'false');
			await first.selectOption({ label: 'V30 R121' });
			await expect(second).toHaveValue('');
			await expect(blend).toHaveAttribute('aria-disabled', 'true');
		} finally {
			await safeDelete('songs', song.id);
		}
	});

	test('an uploaded IR follows the account to another device', async ({
		page,
		browser,
		workerStorageState
	}) => {
		await page.goto('/rig');
		await chooseInput(page);
		const cabIr = (on: Page) => board(on).getByRole('combobox', { name: 'Cab IR', exact: true });
		const irs = page.getByRole('region', { name: 'Cab IRs' });
		await board(page)
			.getByLabel('Cab IR file')
			.setInputFiles({
				name: 'Synced V30.wav',
				mimeType: 'audio/wav',
				buffer: readFileSync(IR_FIXTURE)
			});
		const row = irs.getByRole('listitem').filter({ hasText: 'Synced V30' });
		await expect(row).toBeVisible();
		await expect(row).not.toContainText('Not synced yet', { timeout: 10_000 });
		await expect(irs.getByTestId('rig-sync')).toHaveText('Synced');

		// Another device: the same account, in a browser that has never seen this rig
		const context = await browser.newContext({
			storageState: workerStorageState,
			baseURL: 'http://localhost:5173'
		});
		try {
			const other = await context.newPage();
			await other.goto('/rig');
			const otherIrs = other.getByRole('region', { name: 'Cab IRs' });
			const otherRow = otherIrs.getByRole('listitem').filter({ hasText: 'Synced V30' });
			await expect(otherRow).toBeVisible({ timeout: 10_000 });

			// It's the real file: it goes into the chain there
			await otherRow.getByRole('button', { name: 'Use: Synced V30' }).click();
			await expect(cabIr(other).locator('option:checked')).toHaveText('Synced V30');

			// A rename there reaches the first device, where it's still the chosen IR
			await otherRow.getByRole('button', { name: 'Rename Synced V30' }).click();
			await otherIrs.getByLabel('New name for Synced V30').fill('Roadcase V30');
			await other.keyboard.press('Enter');
			await expect(
				otherIrs.getByRole('listitem').filter({ hasText: 'Roadcase V30' })
			).toBeVisible();
			await page.reload();
			await expect(cabIr(page).locator('option:checked')).toHaveText('Roadcase V30', {
				timeout: 10_000
			});

			// Removing it there takes it off the account, and so off the first device
			await otherIrs.getByRole('button', { name: 'Remove Roadcase V30' }).click();
			const dialog = other.getByRole('dialog');
			await expect(dialog).toContainText('deleted from your account');
			await dialog.getByRole('button', { name: 'Remove' }).click();
			await expect(otherIrs.getByRole('listitem')).toHaveCount(0);
			await page.reload();
			await expect(irs.getByRole('listitem')).toHaveCount(0, { timeout: 10_000 });
			await expect(cabIr(page)).toHaveValue('');
		} finally {
			await context.close();
		}
	});

	test('a first visit asks for an input, says what to do when refused, and then opens the board', async ({
		page
	}) => {
		// Every rig test launches with Chromium's fake permission UI, which counts as
		// access already given, and headless Chromium has no real prompt to answer. So
		// this stands in for a browser that hasn't been asked yet, the way browsers
		// behave: inputs have no names until access is given, and the answer can be no.
		await page.addInitScript(() => {
			const devices = navigator.mediaDevices;
			const enumerate = devices.enumerateDevices.bind(devices);
			const getUserMedia = devices.getUserMedia.bind(devices);
			const access = { allowed: false, refuse: true };
			(window as unknown as { rigAccess: typeof access }).rigAccess = access;
			devices.enumerateDevices = async () => {
				const all = await enumerate();
				if (access.allowed) return all;
				return all.map(
					(device) =>
						({ deviceId: '', groupId: '', kind: device.kind, label: '' }) as MediaDeviceInfo
				);
			};
			devices.getUserMedia = async (constraints) => {
				if (access.refuse) throw new DOMException('Permission denied', 'NotAllowedError');
				const stream = await getUserMedia(constraints);
				access.allowed = true;
				return stream;
			};
		});
		await page.goto('/rig');
		const rig = board(page);

		// The one thing to do, and both ways of plugging in explained
		await expect(rig.getByText('Plug in and play')).toBeVisible();
		const choose = rig.getByRole('button', { name: 'Choose an input' });
		await expect(rig.getByText('Real amp', { exact: true })).toBeVisible();
		await expect(rig.getByText('NAM', { exact: true })).toBeVisible();
		await expect(rig.getByRole('button', { name: 'Monitor' })).toHaveCount(0);

		// The library and saved rigs don't wait on an input
		await expect(page.getByRole('region', { name: 'Cab IRs' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Saved rigs' })).toBeVisible();

		// Refused: it says where to allow it, and the button is there to try again
		await choose.click();
		await expect(rig.getByRole('alert')).toContainText('Input access is blocked for this site.');
		await expect(choose).toBeEnabled();

		// Allowed: the board, with the inputs named and the complaint gone
		await page.evaluate(() => {
			(window as unknown as { rigAccess: { refuse: boolean } }).rigAccess.refuse = false;
		});
		await choose.click();
		const input = rig.getByRole('combobox', { name: 'Input', exact: true });
		await expect(input).toBeVisible();
		await expect(input.locator('option:not([disabled])').first()).not.toHaveText('Unnamed input');
		await expect(rig.getByText('Plug in and play')).toHaveCount(0);
		await expect(rig.getByRole('alert')).toHaveCount(0);
		await expect(rig.getByTestId('rig-status')).toHaveText('Choose an input to get going.');
	});

	test('the meters read only while the rig is live, and the footer says what is missing', async ({
		page
	}) => {
		await page.goto('/rig');
		await chooseInput(page);
		const rig = board(page);
		const status = rig.getByTestId('rig-status');
		const inputReading = rig.getByTestId('rig-input-meter').getByTestId('rig-meter-reading');
		const outputReading = rig.getByTestId('rig-output-meter').getByTestId('rig-meter-reading');
		const dark = /^--\s*dB$/;
		const reading = /^-?\d+\s*dB$/;
		await expect(inputReading).toHaveText(dark);
		await expect(outputReading).toHaveText(dark);

		// NAM with nothing to model with says so, before and after going live
		await rig.getByRole('button', { name: 'NAM', exact: true }).click();
		await expect(status).toHaveText('Pick an amp model, then turn Monitor on.');
		const monitor = rig.getByRole('button', { name: 'Monitor' });
		await monitor.click();
		await expect(monitor).toHaveAttribute('aria-pressed', 'true');
		await expect(status).toHaveText("Live, with no amp model: that's your guitar dry.");

		// Live, both ends of the chain read a level
		await expect(inputReading).toHaveText(reading, { timeout: 10_000 });
		await expect(outputReading).toHaveText(reading, { timeout: 10_000 });

		// The real amp with no IR gets its own warning
		await rig.getByRole('button', { name: 'Real amp' }).click();
		await expect(status).toHaveText('Live, with no cab IR: a line out sounds harsh without one.');

		// The input meter sits after the gain: cut the gain and the reading falls
		const level = async () => Number((await inputReading.textContent())?.match(/-?\d+/)?.[0]);
		const before = await level();
		const gain = rig.getByRole('slider', { name: 'Input', exact: true });
		await gain.focus();
		await page.keyboard.press('Home');
		await expect(gain).toHaveAttribute('aria-valuetext', '-24.0 dB');
		await expect.poll(level, { timeout: 15_000 }).toBeLessThanOrEqual(before - 12);

		// Off, the meters go dark and the readings clear
		await monitor.click();
		await expect(monitor).toHaveAttribute('aria-pressed', 'false');
		await expect(inputReading).toHaveText(dark);
		await expect(outputReading).toHaveText(dark);
		await expect(rig.getByText(/^\d+ ms$/)).toHaveCount(0);
		await expect(status).toHaveText('Ready. Turn Monitor on and play.');
	});

	test('an IR added while the account is out of reach is sent up once it is back', async ({
		page,
		browser,
		workerStorageState
	}) => {
		// Supabase's client tries a failed read a few more times before it gives up
		test.setTimeout(90_000);
		await page.route(toAccount, (route) => route.abort());
		await page.goto('/rig');
		await chooseInput(page);
		const rig = board(page);
		const irs = page.getByRole('region', { name: 'Cab IRs' });
		const sync = irs.getByTestId('rig-sync');
		await expect(sync).toContainText("Couldn't sync.", { timeout: 30_000 });

		// The rig doesn't wait for the account: the IR is kept here and goes in the chain
		await rig.getByLabel('Cab IR file').setInputFiles({
			name: 'Offline V30.wav',
			mimeType: 'audio/wav',
			buffer: readFileSync(IR_FIXTURE)
		});
		await expect(
			rig.getByRole('combobox', { name: 'Cab IR', exact: true }).locator('option:checked')
		).toHaveText('Offline V30');
		const row = irs.getByRole('listitem');
		await expect(row).toContainText('Not synced yet');

		// Renaming it here is fine too: the account has nothing to disagree with yet
		await row.getByRole('button', { name: 'Rename Offline V30' }).click();
		await irs.getByLabel('New name for Offline V30').fill('Offline Mesa');
		await page.keyboard.press('Enter');
		await expect(row).toContainText('Offline Mesa');

		// Back in reach: one tap sends it up, under the name it has now
		await page.unroute(toAccount);
		await sync.getByRole('button', { name: 'Try again' }).click();
		await expect(sync).toHaveText('Synced', { timeout: 30_000 });
		await expect(row).not.toContainText('Not synced yet');

		const context = await browser.newContext({
			storageState: workerStorageState,
			baseURL: 'http://localhost:5173'
		});
		try {
			const other = await context.newPage();
			await other.goto('/rig');
			await expect(
				other.getByRole('region', { name: 'Cab IRs' }).getByRole('listitem')
			).toContainText('Offline Mesa', { timeout: 10_000 });
		} finally {
			await context.close();
		}

		// Out of reach again, a synced IR isn't renamed or removed only here: that
		// would come undone on the next sync, so it says why and leaves it alone
		await page.route(toAccount, (route) => route.abort());
		await row.getByRole('button', { name: 'Rename Offline Mesa' }).click();
		await irs.getByLabel('New name for Offline Mesa').fill('Renamed nowhere');
		await page.keyboard.press('Enter');
		await expect(rig.getByRole('alert')).toContainText("Couldn't rename that IR in your account.");
		await expect(row).toContainText('Offline Mesa');

		await row.getByRole('button', { name: 'Remove Offline Mesa' }).click();
		const dialog = page.getByRole('dialog');
		await dialog.getByRole('button', { name: 'Remove' }).click();
		await expect(rig.getByRole('alert')).toContainText(
			"Couldn't remove that IR from your account."
		);
		await expect(irs.getByRole('listitem')).toHaveCount(1);

		// In reach, it goes, and the complaint goes with it
		await page.unroute(toAccount);
		await row.getByRole('button', { name: 'Remove Offline Mesa' }).click();
		await dialog.getByRole('button', { name: 'Remove' }).click();
		await expect(irs.getByRole('listitem')).toHaveCount(0);
		await expect(rig.getByRole('alert')).toHaveCount(0);
	});

	test('a TONE3000 IR goes into the slot it was browsed from, and never to the account', async ({
		page,
		context
	}) => {
		const fake = fakeTone3000();
		await context.route(`${T3K}/**`, fake.handle);
		// Anything written to the account's IRs: a TONE3000 file must cause none
		const written: string[] = [];
		page.on('request', (request) => {
			if (request.method() !== 'GET' && toAccount(new URL(request.url()))) {
				written.push(`${request.method()} ${request.url()}`);
			}
		});

		await page.goto('/rig');
		await chooseInput(page);
		const rig = board(page);
		const browseSecond = rig.getByRole('button', {
			name: 'Browse TONE3000 for a second cab IR'
		});
		test.skip(
			(await browseSecond.count()) === 0,
			'The dev server has no PUBLIC_TONE3000_CLIENT_ID (a reused server needs one in .env)'
		);
		const first = rig.getByRole('combobox', { name: 'Cab IR', exact: true });
		const second = rig.getByRole('combobox', { name: 'Second IR', exact: true });

		// Browsed from the second IR, a one-file cab goes straight into the second slot
		await browseSecond.click();
		await expect(second.locator('option:checked')).toHaveText('V30 Test – SM57');
		await expect(first).toHaveValue('');
		await rig.getByRole('button', { name: 'Close V30 Test' }).click();
		await expect(rig.getByText('By Cab Maker · CC0 · On TONE3000')).toBeVisible();

		// Browsed from the first, the copy already here is offered, and using it moves it
		await rig.getByRole('button', { name: 'Browse TONE3000 for cab IRs' }).click();
		const card = rig.getByRole('list', { name: 'Files in V30 Test' });
		await card.getByRole('button', { name: 'Use SM57' }).click();
		await expect(first.locator('option:checked')).toHaveText('V30 Test – SM57');
		await expect(second).toHaveValue('');
		expect(fake.downloadAuth).toHaveLength(1);

		// It's kept on this device only, with its maker beside it in the library
		const irs = page.getByRole('region', { name: 'Cab IRs' });
		const row = irs.getByRole('listitem').filter({ hasText: 'V30 Test' });
		await expect(row).toContainText('By Cab Maker · CC0');
		await expect(row).toContainText('This device only');
		await expect(irs.getByTestId('rig-sync')).toHaveText('Synced');
		await page.reload();
		await expect(row).toContainText('This device only');
		await expect(irs.getByTestId('rig-sync')).toHaveText('Synced', { timeout: 10_000 });
		expect(written).toEqual([]);
	});

	test('settings from before modes and blending still load, and bad saved rigs are dropped', async ({
		page
	}) => {
		// What an older version left behind: one flat setup, an IR that's long gone,
		// and a list of saved rigs that's been through the wars
		await page.addInitScript(() => {
			if (localStorage.getItem('rig-test-seeded')) return;
			localStorage.setItem('rig-test-seeded', '1');
			localStorage.setItem(
				'practice:rig:v1',
				JSON.stringify({
					deviceId: null,
					buffer: 'normal',
					inputDb: 3,
					level: 0.5,
					lowCut: 80,
					highCut: 8000,
					irId: 'an-ir-that-is-gone'
				})
			);
			localStorage.setItem(
				'practice:rig:presets:v1',
				JSON.stringify([
					{ id: 'kept', name: 'Old favourite', mode: 'amp', setup: { inputDb: -6, level: 0.4 } },
					{ id: 'blank', name: '   ', mode: 'amp', setup: {} },
					{ name: 'No id', mode: 'nam', setup: {} },
					'not a rig at all'
				])
			);
		});
		await page.goto('/rig');
		const rig = board(page);

		// The flat setup was the real amp's, and comes back as it
		await expect(rig.getByRole('button', { name: 'Real amp' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await expect(rig.getByRole('slider', { name: 'Input', exact: true })).toHaveAttribute(
			'aria-valuetext',
			'+3.0 dB'
		);
		await expect(rig.getByRole('slider', { name: 'Level' })).toHaveAttribute(
			'aria-valuetext',
			'50%'
		);
		await expect(rig.getByRole('slider', { name: 'Lo cut' })).toHaveAttribute(
			'aria-valuetext',
			'80 Hz'
		);
		await expect(rig.getByRole('slider', { name: 'Hi cut' })).toHaveAttribute(
			'aria-valuetext',
			'8.0 kHz'
		);
		await expect(rig.getByRole('combobox', { name: 'Buffer size' })).toHaveValue('normal');

		// The IR that's gone is forgotten, and with one IR at most there's no blend
		await expect(rig.getByRole('combobox', { name: 'Cab IR', exact: true })).toHaveValue('');
		await expect(rig.getByRole('combobox', { name: 'Second IR', exact: true })).toHaveValue('');
		await expect(rig.getByRole('slider', { name: 'Blend' })).toHaveAttribute(
			'aria-valuetext',
			'Off'
		);

		// NAM starts from the defaults, low on purpose
		await rig.getByRole('button', { name: 'NAM', exact: true }).click();
		await expect(rig.getByRole('slider', { name: 'Level' })).toHaveAttribute(
			'aria-valuetext',
			'30%'
		);

		// Only the saved rig that makes sense survives, with what it lacked filled in
		const saved = page.getByRole('region', { name: 'Saved rigs' });
		await expect(saved.getByRole('listitem')).toHaveCount(1);
		const old = saved.getByRole('button', { name: 'Load Old favourite' });
		await expect(old).toContainText('Real amp · No IR');
		await old.click();
		await expect(old).toHaveAttribute('aria-pressed', 'true');
		await expect(rig.getByRole('slider', { name: 'Input', exact: true })).toHaveAttribute(
			'aria-valuetext',
			'-6.0 dB'
		);
		await expect(rig.getByRole('slider', { name: 'Level' })).toHaveAttribute(
			'aria-valuetext',
			'40%'
		);
	});

	test('keeps at most 24 saved rigs, and still lets one be saved over', async ({ page }) => {
		await page.addInitScript(() => {
			if (localStorage.getItem('rig-test-seeded')) return;
			localStorage.setItem('rig-test-seeded', '1');
			localStorage.setItem(
				'practice:rig:presets:v1',
				JSON.stringify(
					Array.from({ length: 24 }, (_, i) => ({
						id: `rig-${i + 1}`,
						name: `Rig ${i + 1}`,
						mode: 'amp',
						setup: { level: 0.1 }
					}))
				)
			);
		});
		await page.goto('/rig');
		const saved = page.getByRole('region', { name: 'Saved rigs' });
		const name = saved.getByLabel("Save what's dialed in");
		await expect(saved.getByRole('listitem')).toHaveCount(24);

		await name.fill('One too many');
		await saved.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(saved.getByRole('alert')).toContainText("That's 24 saved rigs");
		await expect(saved.getByRole('listitem')).toHaveCount(24);

		// A name that's taken isn't a new rig: it saves over the one there
		await name.fill('rig 7');
		await expect(saved.getByRole('alert')).toHaveCount(0);
		await saved.getByRole('button', { name: 'Update', exact: true }).click();
		await expect(saved.getByRole('listitem')).toHaveCount(24);
		await expect(saved.getByRole('button', { name: 'Load rig 7' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);

		// A blank name is asked for, and a name another rig has is turned away
		await saved.getByRole('button', { name: 'Rename Rig 1', exact: true }).click();
		await saved.getByLabel('New name for Rig 1', { exact: true }).fill('Rig 2');
		await page.keyboard.press('Enter');
		await expect(saved.getByRole('alert')).toContainText("There's already a rig called Rig 2.");
		await expect(saved.getByRole('button', { name: 'Load Rig 1', exact: true })).toBeVisible();
	});
});
