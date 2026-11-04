import { test, expect } from './fixtures';
import { createBand, createSong } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';
import { createSecondUser } from './helpers/multi-user';
import { adminClient } from './helpers/supabase-admin';

async function savedSeconds(songId: string) {
	const { data } = await adminClient
		.from('practice_session_items')
		.select('practice_seconds, label')
		.eq('song_id', songId);
	return data?.[0] ?? null;
}

test.describe('Practice clock', () => {
	test('saves time spent, on a heartbeat', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Heartbeat Song' });
		try {
			await page.clock.install();
			await page.goto(`/songs/${song.id}/practice`);
			await page.clock.runFor(65_000);

			await expect(page.getByTestId('practice-clock')).toHaveText('1:05');
			await expect
				.poll(async () => (await savedSeconds(song.id))?.practice_seconds)
				.toBeGreaterThanOrEqual(60);
			expect((await savedSeconds(song.id))?.label).toBe('Heartbeat Song');
		} finally {
			await safeDelete('songs', song.id);
		}
	});

	test('opening a song and leaving saves nothing', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Just Looking' });
		try {
			await page.goto(`/songs/${song.id}/practice`);
			await page.waitForTimeout(1500);
			await page.goto('/practice');
			await page.waitForLoadState('networkidle');
			expect(await savedSeconds(song.id)).toBeNull();
		} finally {
			await safeDelete('songs', song.id);
		}
	});

	test('survives losing the connection: unsaved time goes up on the next visit', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Offline Song' });
		try {
			await page.clock.install();
			await page.goto(`/songs/${song.id}/practice`);

			await page.context().setOffline(true);
			await page.clock.runFor(65_000);
			await page.waitForTimeout(200);
			expect(await savedSeconds(song.id)).toBeNull();

			await page.context().setOffline(false);
			await page.reload();
			await expect
				.poll(async () => (await savedSeconds(song.id))?.practice_seconds, { timeout: 10_000 })
				.toBeGreaterThanOrEqual(60);
			// And the clock picks up where it left off rather than starting over
			await expect(page.getByTestId('practice-clock')).toContainText('1:');
		} finally {
			await page.context().setOffline(false);
			await safeDelete('songs', song.id);
		}
	});

	test('pausing stops it, and it stops itself if you walk away', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Walked Away' });
		try {
			await page.clock.install();
			await page.goto(`/songs/${song.id}/practice`);
			const clock = page.getByTestId('practice-clock');

			await page.clock.runFor(10_000);
			await page.getByRole('button', { name: 'Pause clock' }).click();
			await expect(clock).toHaveText('0:10');
			await page.clock.runFor(30_000);
			await expect(clock).toHaveText('0:10');

			await page.getByRole('button', { name: 'Resume' }).click();
			await page.clock.runFor(11 * 60_000);
			await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
			await expect(clock).toHaveText('10:10');

			// Coming back and touching anything starts it again
			await page.mouse.click(5, 5);
			await expect(page.getByRole('button', { name: 'Pause clock' })).toBeVisible();
		} finally {
			await safeDelete('songs', song.id);
		}
	});
});

test.describe('Song status', () => {
	test('saves without reloading the page, shows in Shed and the Log, and can be cleared', async ({
		browser
	}) => {
		const user = await createSecondUser(browser);
		const { page } = user;
		try {
			const first = await createSong(page, user.user.id, { title: 'Alpha Solid Tune' });
			const flagged = await createSong(page, user.user.id, { title: 'Zulu Hard Tune' });

			await page.goto(`/songs/${flagged.id}/practice`);
			const needsWork = page.getByRole('button', { name: 'Needs work', exact: true });
			await needsWork.click();
			await expect(needsWork).toHaveAttribute('aria-pressed', 'true');

			await page.getByPlaceholder('What to work on next time').fill('Bridge is shaky');
			await page.getByPlaceholder('What to work on next time').blur();
			await expect
				.poll(async () => {
					const { data } = await adminClient
						.from('song_practice')
						.select('status, note')
						.eq('song_id', flagged.id)
						.maybeSingle();
					return data;
				})
				.toEqual({ status: 'needs_work', note: 'Bridge is shaky' });

			await page.reload();
			await expect(needsWork).toHaveAttribute('aria-pressed', 'true');
			await expect(page.getByPlaceholder('What to work on next time')).toHaveValue(
				'Bridge is shaky'
			);

			// Flagged songs jump the alphabetical list
			await page.goto('/practice/shed');
			const rows = page.getByRole('listitem').getByRole('link');
			await expect(rows.first()).toContainText('Zulu Hard Tune');
			await expect(rows.first()).toContainText('Needs work');
			await expect(rows.first()).toContainText('Bridge is shaky');
			await expect(rows.last()).toContainText(first.title);
			await expect(page.getByRole('region', { name: 'Working on' })).toContainText(
				'Zulu Hard Tune'
			);
			await expect(page.getByRole('region', { name: 'Working on' })).not.toContainText(first.title);

			await page.goto('/practice/log');
			const todo = page.getByRole('region', { name: 'To work on' });
			await expect(todo).toContainText('Zulu Hard Tune');
			await expect(todo).toContainText('Bridge is shaky');

			await page.goto(`/songs/${flagged.id}/practice`);
			await needsWork.click();
			await expect(needsWork).toHaveAttribute('aria-pressed', 'false');
			await expect
				.poll(async () => {
					const { data } = await adminClient
						.from('song_practice')
						.select('status')
						.eq('song_id', flagged.id);
					return data?.length;
				})
				.toBe(0);
		} finally {
			await user.cleanup();
		}
	});
});

test.describe('Timing a run', () => {
	test('can replace your own song length in one tap', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, {
			title: 'Timed Solo',
			duration_seconds: 180
		});
		try {
			await page.clock.install();
			await page.goto(`/songs/${song.id}/practice`);
			const panel = page.getByRole('region', { name: 'Time a run' });

			await panel.getByRole('button', { name: 'Start timing' }).click();
			await page.clock.runFor(200_000);
			await panel.getByRole('button', { name: 'Stop timing' }).click();
			await expect(panel.getByText('Listed as 3:00')).toBeVisible();

			await panel.getByRole('button', { name: 'Use 3:20' }).click();
			await expect
				.poll(async () => {
					const { data } = await adminClient
						.from('songs')
						.select('duration_seconds')
						.eq('id', song.id)
						.single();
					return data?.duration_seconds;
				})
				.toBe(200);
			await expect(panel.getByRole('button', { name: /^Use / })).toBeHidden();
		} finally {
			await safeDelete('songs', song.id);
		}
	});

	test('warns before changing a shared song, and refuses if it changed meanwhile', async ({
		page,
		browser,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);
		const song = await createSong(page, testUser.id, {
			title: 'Shared Timed',
			duration_seconds: 180
		});
		const member = await createSecondUser(browser);
		const length = async () => {
			const { data } = await adminClient
				.from('songs')
				.select('duration_seconds')
				.eq('id', song.id)
				.single();
			return data?.duration_seconds;
		};

		try {
			await adminClient
				.from('band_songs')
				.insert({ band_id: band.id, song_id: song.id, added_by: testUser.id });
			await adminClient
				.from('band_members')
				.insert({ band_id: band.id, user_id: member.user.id, role: 'member' });

			await member.page.clock.install();
			await member.page.goto(`/songs/${song.id}/practice`);
			const panel = member.page.getByRole('region', { name: 'Time a run' });
			await panel.getByRole('button', { name: 'Start timing' }).click();
			await member.page.clock.runFor(200_000);
			await panel.getByRole('button', { name: 'Stop timing' }).click();

			// Cancelling leaves it alone
			await panel.getByRole('button', { name: 'Use 3:20' }).click();
			const dialog = member.page.getByRole('dialog');
			await expect(dialog).toContainText("the owner's library");
			await expect(dialog.getByRole('button', { name: 'Delete' })).toHaveCount(0);
			await dialog.getByRole('button', { name: 'Cancel' }).click();
			expect(await length()).toBe(180);

			// The owner changes it while the member is still looking at the old length
			await adminClient.from('songs').update({ duration_seconds: 150 }).eq('id', song.id);
			await panel.getByRole('button', { name: 'Use 3:20' }).click();
			await dialog.getByRole('button', { name: 'Change it' }).click();
			await expect(panel.getByRole('alert')).toContainText('changed this song');
			expect(await length()).toBe(150);
		} finally {
			await member.cleanup();
			await safeDelete('songs', song.id);
			await safeDelete('bands', band.id);
		}
	});
});

test.describe('Practice log', () => {
	test('shows what you did, and says so plainly when empty', async ({ browser }) => {
		const user = await createSecondUser(browser);
		const { page } = user;
		try {
			await page.goto('/practice/log');
			await expect(page.getByText('Nothing logged yet')).toBeVisible();

			const song = await createSong(page, user.user.id, { title: 'Logged Tune' });
			await page.clock.install();
			await page.goto(`/songs/${song.id}/practice`);
			await page.clock.runFor(125_000);
			await expect
				.poll(async () => (await savedSeconds(song.id))?.practice_seconds)
				.toBeGreaterThan(0);

			await page.goto('/practice/log');
			await expect(page.getByText('This week')).toBeVisible();
			const sessions = page.getByRole('region', { name: 'Sessions' });
			await expect(sessions.getByRole('link', { name: 'Logged Tune' })).toBeVisible();

			// Today's time lands on today's bar, here and on Today
			const practicedToday = new RegExp(
				`${new Date().toLocaleDateString('en-US', { weekday: 'long' })} [1-9]\\d*[ms]`
			);
			const week = page.getByRole('region', { name: 'Your week' }).getByRole('img');
			await expect(week).toHaveAttribute('aria-label', practicedToday);
			await page.goto('/practice');
			await expect(week).toHaveAttribute('aria-label', practicedToday);
		} finally {
			await user.cleanup();
		}
	});
});
