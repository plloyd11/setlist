import type { Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { test, expect } from './fixtures';
import { createSetlist, createSong } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';
import { dragAndDrop } from './helpers/dnd';
import { adminClient } from './helpers/supabase-admin';

const MOBILE = { width: 390, height: 800 };

function uniqueTitle(label: string) {
	return `${label} ${faker.string.alphanumeric(6)}`;
}

/**
 * Let the first request to a form action reach the server straight away but hold
 * its response, as a slow phone connection does: the write has committed while
 * the client still thinks it's in flight.
 */
async function holdFirstResponse(page: Page, action: string, ms: number) {
	let held = false;
	await page.route(new RegExp(`\\?/${action}$`), async (route) => {
		const response = await route.fetch();
		if (!held) {
			held = true;
			await new Promise((resolve) => setTimeout(resolve, ms));
		}
		await route.fulfill({ response });
	});
}

async function storedTitles(setlistId: string) {
	const { data } = await adminClient
		.from('setlist_songs')
		.select('position, songs(title)')
		.eq('setlist_id', setlistId)
		.order('position');
	return (data ?? []).map((row) => (row.songs as unknown as { title: string }).title);
}

async function seedSet(setlistId: string, songIds: string[]) {
	const { error } = await adminClient
		.from('setlist_songs')
		.insert(songIds.map((song_id, position) => ({ setlist_id: setlistId, song_id, position })));
	if (error) throw new Error(`seedSet failed: ${error.message}`);
}

test.describe('Setlist builder under slow responses', () => {
	test('songs tapped in quick succession all land, in order', async ({ page, testUser }) => {
		await page.setViewportSize(MOBILE);
		const titles = [uniqueTitle('First'), uniqueTitle('Second'), uniqueTitle('Third')];
		const songs = [];
		for (const title of titles) songs.push(await createSong(page, testUser.id, { title }));
		const setlist = await createSetlist(page, testUser.id, { name: uniqueTitle('Rapid') });

		try {
			await holdFirstResponse(page, 'addSong', 1500);
			await page.getByRole('button', { name: 'Library', exact: true }).click();
			for (const title of titles) {
				await page.getByRole('button', { name: `Add ${title} to setlist` }).click();
			}

			await expect(page.getByRole('button', { name: /^Setlist\s*3$/ })).toBeVisible({
				timeout: 10_000
			});
			await expect.poll(() => storedTitles(setlist.id)).toEqual(titles);
		} finally {
			await safeDelete('setlists', setlist.id);
			for (const song of songs) await safeDelete('songs', song.id);
		}
	});

	test('a drag during an in-flight add does not delete the added song', async ({
		page,
		testUser
	}) => {
		await page.setViewportSize(MOBILE);
		const [a, b, added] = [uniqueTitle('Alpha'), uniqueTitle('Beta'), uniqueTitle('Added')];
		const songA = await createSong(page, testUser.id, { title: a });
		const songB = await createSong(page, testUser.id, { title: b });
		const songAdded = await createSong(page, testUser.id, { title: added });
		const setlist = await createSetlist(page, testUser.id, { name: uniqueTitle('Drag') });

		try {
			await seedSet(setlist.id, [songA.id, songB.id]);
			await page.goto(`/setlists/${setlist.id}`);

			await holdFirstResponse(page, 'addSong', 3000);
			await page.getByRole('button', { name: 'Library', exact: true }).click();
			await page.getByRole('button', { name: `Add ${added} to setlist` }).click();

			await page.getByRole('button', { name: /^Setlist/ }).click();
			const rowA = page
				.locator('div')
				.filter({ has: page.getByLabel(`Remove ${a} from setlist`) })
				.last();
			const rowB = page
				.locator('div')
				.filter({ has: page.getByLabel(`Remove ${b} from setlist`) })
				.last();
			await dragAndDrop(page, rowB, rowA, { steps: 15, offsetY: -20 });

			await expect.poll(() => storedTitles(setlist.id), { timeout: 10_000 }).toEqual([b, a, added]);
			await expect(page.getByRole('button', { name: /^Setlist\s*3$/ })).toBeVisible();
		} finally {
			await safeDelete('setlists', setlist.id);
			for (const song of [songA, songB, songAdded]) await safeDelete('songs', song.id);
		}
	});

	test('a keyboard reorder saves and ends the drag', async ({ page, testUser }) => {
		const [a, b] = [uniqueTitle('Alpha'), uniqueTitle('Beta')];
		const songA = await createSong(page, testUser.id, { title: a });
		const songB = await createSong(page, testUser.id, { title: b });
		const setlist = await createSetlist(page, testUser.id, { name: uniqueTitle('Keys') });

		try {
			await seedSet(setlist.id, [songA.id, songB.id]);
			await page.goto(`/setlists/${setlist.id}`);

			await page
				.getByLabel(`Remove ${b} from setlist`)
				.locator('xpath=ancestor::*[@tabindex="0"][1]')
				.focus();
			await page.keyboard.press('Space');
			await page.keyboard.press('ArrowUp');
			await page.keyboard.press('Space');

			await expect.poll(() => storedTitles(setlist.id)).toEqual([b, a]);
			// The drop-zone glow is a live signal: it must not stay lit after the drop
			await expect(page.locator('.shadow-glow-neon')).toHaveCount(0);
		} finally {
			await safeDelete('setlists', setlist.id);
			for (const song of [songA, songB]) await safeDelete('songs', song.id);
		}
	});
});
