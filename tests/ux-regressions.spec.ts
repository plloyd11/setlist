import { test, expect } from './fixtures';
import { adminClient } from './helpers/supabase-admin';
import { createBand, createSong } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';

/**
 * Regression coverage for UX bugs that only show up with realistic data or on a
 * phone-sized screen: a set showing different totals on different screens, and
 * long text pushing the builder off the viewport.
 */

test.describe('One set, one total', () => {
	test('builder, rehearse, setlist list and dashboard all agree', async ({ page, testUser }) => {
		const a = await createSong(page, testUser.id, { title: 'Total A', duration_seconds: 200 });
		const b = await createSong(page, testUser.id, { title: 'Total B', duration_seconds: 100 });
		const c = await createSong(page, testUser.id, { title: 'Total C', duration_seconds: 120 });
		const { data: setlist, error } = await adminClient
			.from('setlists')
			.insert({ user_id: testUser.id, name: 'One Total Set', transition_seconds: 10 })
			.select()
			.single();
		if (error) throw new Error(error.message);

		try {
			// A, B, a 60s gap, then C. A transition only applies between consecutive
			// songs, so just A to B gets one: 200 + 10 + 100 + 60 + 120 = 8:10.
			// Songs and gaps alone would be 8:00; counting every song pair, 8:20.
			const rows = [
				{ setlist_id: setlist.id, song_id: a.id, position: 0 },
				{ setlist_id: setlist.id, song_id: b.id, position: 1 },
				{ setlist_id: setlist.id, song_id: null, gap_seconds: 60, position: 2 },
				{ setlist_id: setlist.id, song_id: c.id, position: 3 }
			];
			const { error: rowError } = await adminClient.from('setlist_songs').insert(rows);
			if (rowError) throw new Error(rowError.message);

			await page.goto(`/setlists/${setlist.id}`);
			await expect(page.getByText('8:10', { exact: true }).first()).toBeVisible();

			await page.goto(`/setlists/${setlist.id}/rehearse`);
			await expect(page.getByText('8:10', { exact: true }).first()).toBeVisible();

			await page.goto('/setlists');
			await expect(page.locator('a', { hasText: 'One Total Set' }).first()).toContainText('8:10');

			await page.goto('/dashboard');
			await expect(page.locator('a', { hasText: 'One Total Set' }).first()).toContainText('8:10');
		} finally {
			await safeDelete('setlists', setlist.id);
			for (const song of [a, b, c]) await safeDelete('songs', song.id);
		}
	});
});

test.describe('The page frame', () => {
	const ROUTES = [
		'/dashboard',
		'/songs',
		'/setlists',
		'/practice',
		'/rig',
		'/bands',
		'/settings',
		'/help'
	];

	test('every page runs full width with even gutters', async ({ page }) => {
		await page.setViewportSize({ width: 1800, height: 900 });
		for (const route of ROUTES) {
			await page.goto(route);
			const frame = await page
				.locator('.page-frame')
				.first()
				.evaluate((el) => {
					const box = el.getBoundingClientRect();
					const parent = el.parentElement!.getBoundingClientRect();
					const style = getComputedStyle(el);
					return {
						gapLeft: Math.round(box.left - parent.left),
						gapRight: Math.round(parent.right - box.right),
						paddingLeft: style.paddingLeft,
						paddingRight: style.paddingRight
					};
				});
			expect(frame, route).toEqual({
				gapLeft: 0,
				gapRight: 0,
				paddingLeft: '32px',
				paddingRight: '32px'
			});
		}
	});

	test('no page scrolls sideways on the smallest phones', async ({ page }) => {
		await page.setViewportSize({ width: 320, height: 568 });
		for (const route of ROUTES) {
			await page.goto(route);
			const overflow = await page
				.locator('main')
				.evaluate((main) => main.scrollWidth - main.clientWidth);
			expect(overflow, route).toBe(0);
		}
	});
});

test.describe('On a phone', () => {
	test('long titles and notes stay inside the builder', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, {
			title: 'A Very Long Song Title That Used To Push The Whole Builder Off The Screen',
			notes: 'Capo 2, and a note long enough that it could never fit on a single phone row'
		});
		const { data: setlist, error } = await adminClient
			.from('setlists')
			.insert({ user_id: testUser.id, name: 'Phone Width Set', transition_seconds: 0 })
			.select()
			.single();
		if (error) throw new Error(error.message);

		try {
			const { error: rowError } = await adminClient
				.from('setlist_songs')
				.insert({ setlist_id: setlist.id, song_id: song.id, position: 0 });
			if (rowError) throw new Error(rowError.message);

			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto(`/setlists/${setlist.id}`);

			// The remove button sits at the far end of the row, so it runs off first
			const remove = page.getByRole('button', { name: /^Remove .* from setlist$/ });
			await expect(remove).toBeVisible();
			const box = await remove.boundingBox();
			expect(box!.x + box!.width).toBeLessThanOrEqual(390);
		} finally {
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', song.id);
		}
	});
});

test.describe('Timing readouts', () => {
	test('durations line up digit for digit, whatever the digits', async ({ page, testUser }) => {
		// A 1 is about 60% as wide as a 0 in both typefaces, and neither has tabular figures
		const narrow = await createSong(page, testUser.id, {
			title: 'Digits Narrow',
			duration_seconds: 71
		});
		const wide = await createSong(page, testUser.id, {
			title: 'Digits Wide',
			duration_seconds: 300
		});
		try {
			await page.goto('/songs');
			const firstDigitX = (title: string) =>
				page
					.getByRole('button', { name: new RegExp(`^${title}`) })
					.locator('.digit')
					.first()
					.evaluate((el) => el.getBoundingClientRect().left);
			expect(await firstDigitX('Digits Narrow')).toBeCloseTo(await firstDigitX('Digits Wide'), 0);

			// The text a screen reader gets is one reading, not separate digits
			await expect(page.getByRole('button', { name: /^Digits Narrow/ })).toHaveAccessibleName(
				/^Digits Narrow .*1:11$/
			);
		} finally {
			await safeDelete('songs', narrow.id);
			await safeDelete('songs', wide.id);
		}
	});
});

test.describe('People and dead ends', () => {
	test('a member with no name set is not called a former member', async ({ page, testUser }) => {
		const band = await createBand(page, testUser.id);
		try {
			await page.goto(`/bands/${band.id}/members`);
			await expect(page.getByText('Former member')).toHaveCount(0);
			await expect(page.getByRole('link', { name: 'Add your name' })).toBeVisible();
		} finally {
			await safeDelete('bands', band.id);
		}
	});

	test('a missing page offers a way back', async ({ page }) => {
		const response = await page.goto('/this-page-does-not-exist');
		expect(response?.status()).toBe(404);
		await expect(page.getByText(/not found/i)).toBeVisible();
		await expect(page.getByRole('link', { name: 'Back to Setlist' })).toBeVisible();
	});
});
