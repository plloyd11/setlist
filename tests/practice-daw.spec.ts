/**
 * DAW practice controls E2E tests (volume/speed knobs, A/B loop, saved
 * sections, persistence).
 *
 * Audio playback itself is never asserted (suite philosophy) — these tests
 * drive the chrome: knob ARIA state, the loop region element rendered inside
 * wavesurfer's open shadow root (Playwright CSS locators pierce it), and
 * localStorage persistence across reloads. The audio fixture is ~1s long, so
 * loop ranges live in the 0–1s window; `]` is pressed after seeking to the
 * end of the file, which yields a full-file loop.
 */
import { test, expect } from './fixtures';
import { createSong, createSongAudio } from './helpers/factories';
import { safeDelete, cleanupSongAudio } from './helpers/cleanup';

test.describe('DAW practice controls', () => {
	test('knobs, keyboard loop, and persistence across reload and mix switch', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Shed Song' });
		await createSongAudio(song.id, { label: 'Full mix' });
		await createSongAudio(song.id, { label: 'No guitar' });

		try {
			await page.goto(`/songs/${song.id}/practice`);
			await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 10_000 });

			// Control strip renders with accessible knobs and transport extras
			const volumeKnob = page.getByRole('slider', { name: 'Volume' });
			const speedKnob = page.getByRole('slider', { name: 'Speed' });
			await expect(volumeKnob).toHaveAttribute('aria-valuenow', '1');
			await expect(volumeKnob).toHaveAttribute('aria-valuetext', '100%');
			await expect(speedKnob).toHaveAttribute('aria-valuetext', '100%');
			await expect(page.getByRole('button', { name: 'Back 5 seconds' })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Forward 5 seconds' })).toBeVisible();

			// No loop yet — the loop cluster is parked
			const loopButton = page.getByRole('button', { name: /Loop/ });
			await expect(loopButton).toBeDisabled();
			await expect(loopButton).toHaveAttribute('aria-pressed', 'false');

			// Knobs respond to arrow keys
			await volumeKnob.focus();
			await page.keyboard.press('ArrowDown');
			await page.keyboard.press('ArrowDown');
			await expect(volumeKnob).toHaveAttribute('aria-valuenow', '0.9');
			await expect(volumeKnob).toHaveAttribute('aria-valuetext', '90%');
			await speedKnob.focus();
			await page.keyboard.press('ArrowDown');
			await expect(speedKnob).toHaveAttribute('aria-valuetext', '90%');

			// Keyboard loop: seek to the end (ArrowRight clamps to the ~1s file),
			// then `]` pins B with A defaulting to 0 — a full-file loop region
			await page.getByRole('heading', { name: 'Shed Song' }).click();
			await page.keyboard.press('ArrowRight');
			await page.keyboard.press(']');
			const region = page.locator('[part~="region"]');
			await expect(region).toBeVisible();
			await expect(loopButton).toBeEnabled();

			// L arms the loop (live), L again releases it
			await page.keyboard.press('l');
			await expect(loopButton).toHaveAttribute('aria-pressed', 'true');
			await page.keyboard.press('l');
			await expect(loopButton).toHaveAttribute('aria-pressed', 'false');
			await page.keyboard.press('l');
			await expect(loopButton).toHaveAttribute('aria-pressed', 'true');

			// Reload restores knobs and the region — but the loop comes back
			// disarmed (an armed trap on page load would be surprising)
			await page.reload();
			await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 10_000 });
			await expect(volumeKnob).toHaveAttribute('aria-valuenow', '0.9');
			await expect(speedKnob).toHaveAttribute('aria-valuetext', '90%');
			await expect(region).toBeVisible();
			await expect(loopButton).toHaveAttribute('aria-pressed', 'false');

			// Switching mixes remounts the player; settings re-apply on ready
			await page.getByLabel('Mix').selectOption({ label: 'No guitar' });
			await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 10_000 });
			await expect(region).toBeVisible();
			await expect(volumeKnob).toHaveAttribute('aria-valuenow', '0.9');

			// Clear removes the region and parks the cluster again
			await page.getByRole('button', { name: 'Clear' }).click();
			await expect(region).not.toBeVisible();
			await expect(loopButton).toBeDisabled();
		} finally {
			await cleanupSongAudio(song.id);
			await safeDelete('songs', song.id);
		}
	});

	test('saved sections: save, recall, delete — persisted across reloads', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Section Song' });
		await createSongAudio(song.id, { label: 'Full mix' });

		try {
			await page.goto(`/songs/${song.id}/practice`);
			await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 10_000 });

			// Saving needs a loop first
			const saveButton = page.getByRole('button', { name: '+ Save section' });
			await expect(saveButton).toBeDisabled();

			await page.getByRole('heading', { name: 'Section Song' }).click();
			await page.keyboard.press('ArrowRight');
			await page.keyboard.press(']');
			await expect(saveButton).toBeEnabled();

			// Inline input: Enter commits, the chip appears
			await saveButton.click();
			await page.getByLabel('Section name').fill('solo');
			await page.keyboard.press('Enter');
			const chip = page.getByRole('button', { name: 'solo', exact: true });
			await expect(chip).toBeVisible();

			// Survives a reload
			await page.reload();
			await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled({ timeout: 10_000 });
			await expect(chip).toBeVisible();

			// Recall re-creates the region and arms the loop
			await chip.click();
			await expect(page.locator('[part~="region"]')).toBeVisible();
			await expect(page.getByRole('button', { name: /Loop/ })).toHaveAttribute(
				'aria-pressed',
				'true'
			);

			// Delete sticks
			await page.getByRole('button', { name: 'Delete section solo' }).click();
			await expect(chip).not.toBeVisible();
			await page.reload();
			await expect(page.getByRole('heading', { name: 'Section Song' })).toBeVisible();
			await expect(chip).not.toBeVisible();
		} finally {
			await cleanupSongAudio(song.id);
			await safeDelete('songs', song.id);
		}
	});
});
