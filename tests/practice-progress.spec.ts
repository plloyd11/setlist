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
			await page.getByRole('button', { name: 'Start clock' }).click();
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

	test("waits to be started, and shows the day's total", async ({ browser }) => {
		// Their own account: the day's total has to start from a known place
		const user = await createSecondUser(browser);
		const { page } = user;
		try {
			const song = await createSong(page, user.user.id, { title: 'Not Yet Started' });
			const earlier = async (hoursAgo: number, seconds: number) => {
				const at = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
				const { data: session } = await adminClient
					.from('practice_sessions')
					.insert({ user_id: user.user.id, started_at: at, last_active_at: at })
					.select()
					.single();
				await adminClient.from('practice_session_items').insert({
					session_id: session!.id,
					kind: 'song',
					label: 'Earlier',
					practice_seconds: seconds
				});
			};
			// Twenty minutes just now, and ten the day before yesterday, which isn't today's
			await earlier(0, 20 * 60);
			await earlier(48, 10 * 60);

			await page.clock.install();
			await page.goto(`/songs/${song.id}/practice`);
			const clock = page.getByTestId('practice-clock');
			const today = page.getByTestId('practice-today');
			const start = page.getByRole('button', { name: 'Start clock' });
			await expect(start).toBeVisible();
			await expect(today).toHaveText('Today 20m');

			// Open isn't practicing: nothing counts until it's started
			await page.clock.runFor(45_000);
			await expect(clock).toHaveText('0:00');
			await expect(start).toBeVisible();

			await start.click();
			await page.clock.runFor(5 * 60_000);
			await expect(clock).toHaveText('5:00');
			await expect(today).toHaveText('Today 25m');
		} finally {
			await user.cleanup();
		}
	});

	test('keeps running straight on to the next step of a session, and only then', async ({
		page,
		testUser
	}) => {
		const first = await createSong(page, testUser.id, { title: 'Step One Tune' });
		const second = await createSong(page, testUser.id, { title: 'Step Two Tune' });
		try {
			await page.goto('/practice');
			await page.evaluate(
				(steps) => sessionStorage.setItem('practice:plan:v1', JSON.stringify({ steps, index: 0 })),
				[first, second].map((song) => ({
					href: `/songs/${song.id}/practice?from=/practice`,
					label: song.title
				}))
			);
			await page.goto(`/songs/${first.id}/practice?from=/practice`);
			await page.getByRole('button', { name: 'Start clock' }).click();
			await expect(page.getByRole('button', { name: 'Pause clock' })).toBeVisible();

			await page.getByRole('link', { name: 'Next: Step Two Tune' }).click();
			await expect(page.getByRole('heading', { name: 'Step Two Tune' })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Pause clock' })).toBeVisible();
			await page.waitForTimeout(2500);
			await page.getByRole('button', { name: 'Pause clock' }).click();

			// Coming back to it any other way, it waits again
			await page.goto(`/songs/${first.id}/practice`);
			await expect(page.getByRole('button', { name: /Start clock|Resume/ })).toBeVisible();
			// And the time went to the song that was on screen, not the one before it
			const journaled = await page.evaluate(
				([key, item]) => JSON.parse(localStorage.getItem(key)!).current.items[item],
				[`practice:session:v1:${testUser.id}`, `song:${second.id}`]
			);
			expect(journaled.practice_seconds).toBeGreaterThanOrEqual(2);
		} finally {
			await safeDelete('songs', first.id);
			await safeDelete('songs', second.id);
		}
	});

	test("under a minute isn't logged, by the clock or by the server", async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Barely Touched' });
		try {
			await page.clock.install();
			await page.goto(`/songs/${song.id}/practice`);
			await page.getByRole('button', { name: 'Start clock' }).click();
			await page.clock.runFor(50_000);
			await expect(page.getByTestId('practice-clock')).toHaveText('0:50');
			await page.goto('/practice');
			await page.waitForLoadState('networkidle');
			expect(await savedSeconds(song.id)).toBeNull();

			// Whatever sends it: the server holds the same line
			const now = new Date().toISOString();
			const response = await page.request.post('/practice/session', {
				data: {
					session: { id: crypto.randomUUID(), started_at: now, last_active_at: now },
					items: [
						{
							id: crypto.randomUUID(),
							kind: 'song',
							ref_id: song.id,
							label: 'Barely Touched',
							practice_seconds: 59,
							run_seconds: null,
							run_source: null,
							length_before_apply: null,
							note: null
						}
					]
				}
			});
			expect(response.ok()).toBe(true);
			expect(await savedSeconds(song.id)).toBeNull();
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
			await page.getByRole('button', { name: 'Start clock' }).click();

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

			await page.getByRole('button', { name: 'Start clock' }).click();
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

			// Unless what's touched is the clock's own button, which does what it says
			await page.clock.runFor(11 * 60_000);
			await page.getByRole('button', { name: 'Resume' }).click();
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
	test('a session can be corrected: times changed, items removed', async ({ browser }) => {
		const user = await createSecondUser(browser);
		const { page } = user;
		try {
			const at = new Date().toISOString();
			const { data: session } = await adminClient
				.from('practice_sessions')
				.insert({ user_id: user.user.id, started_at: at, last_active_at: at })
				.select()
				.single();
			const row = (label: string, seconds: number) => ({
				session_id: session!.id,
				kind: 'song',
				label,
				practice_seconds: seconds
			});
			await adminClient
				.from('practice_session_items')
				.insert([row('Left Running', 45 * 60), row('Fine As Is', 312), row('Old Blip', 2)]);
			const saved = async () => {
				const { data } = await adminClient
					.from('practice_session_items')
					.select('label, practice_seconds')
					.eq('session_id', session!.id)
					.order('label');
				return data;
			};

			await page.goto('/practice/log');
			const sessions = page.getByRole('region', { name: 'Sessions' });
			await expect(sessions.getByText('Left Running')).toBeVisible();
			// Logged before the one-minute rule: out of sight, and out of the total
			await expect(sessions.getByText('Old Blip')).toHaveCount(0);
			await expect(sessions.getByText('50m', { exact: true })).toBeVisible();

			// Cancel changes nothing
			await sessions.getByRole('button', { name: /^Edit time on/ }).click();
			await sessions.getByRole('button', { name: 'Remove Left Running' }).click();
			await sessions.getByRole('button', { name: 'Cancel' }).click();
			await expect(sessions.getByText('45m')).toBeVisible();

			// A new time for one; the other is left alone and keeps its odd seconds
			await sessions.getByRole('button', { name: /^Edit time on/ }).click();
			await sessions.getByLabel('Minutes on Left Running').fill('10');
			await sessions.getByRole('button', { name: 'Save' }).click();
			await expect(sessions.getByRole('button', { name: /^Edit time on/ })).toBeVisible();
			await expect(sessions.getByText('15m', { exact: true })).toBeVisible();
			expect(await saved()).toEqual([
				{ label: 'Fine As Is', practice_seconds: 312 },
				{ label: 'Left Running', practice_seconds: 600 },
				{ label: 'Old Blip', practice_seconds: 2 }
			]);

			// Removing can be taken back until it's saved
			await sessions.getByRole('button', { name: /^Edit time on/ }).click();
			await sessions.getByRole('button', { name: 'Remove Fine As Is' }).click();
			await sessions.getByRole('button', { name: 'Keep Fine As Is' }).click();
			await sessions.getByRole('button', { name: 'Remove Left Running' }).click();
			await sessions.getByRole('button', { name: 'Save' }).click();
			await expect(sessions.getByText('Left Running')).toHaveCount(0);
			await expect(sessions.getByText('Fine As Is')).toBeVisible();
			expect((await saved())?.map((item) => item.label)).toEqual(['Fine As Is', 'Old Blip']);

			// The last one out takes the session with it
			await sessions.getByRole('button', { name: /^Edit time on/ }).click();
			await sessions.getByRole('button', { name: 'Remove Fine As Is' }).click();
			await sessions.getByRole('button', { name: 'Save' }).click();
			await expect(page.getByText('Nothing logged yet')).toBeVisible();
			const { data: gone } = await adminClient
				.from('practice_sessions')
				.select('id')
				.eq('id', session!.id);
			expect(gone).toEqual([]);
		} finally {
			await user.cleanup();
		}
	});

	test('shows what you did, and says so plainly when empty', async ({ browser }) => {
		const user = await createSecondUser(browser);
		const { page } = user;
		try {
			await page.goto('/practice/log');
			await expect(page.getByText('Nothing logged yet')).toBeVisible();

			const song = await createSong(page, user.user.id, { title: 'Logged Tune' });
			await page.clock.install();
			await page.goto(`/songs/${song.id}/practice`);
			await page.getByRole('button', { name: 'Start clock' }).click();
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
