import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { adminClient } from './helpers/supabase-admin';
import { createSecondUser } from './helpers/multi-user';

/**
 * The board picks its hero from everything a user can see, so each test gets its own
 * user: another test's gig in the same worker would change which set is "next".
 */

function dateInZone(zone?: string, daysAhead = 0): string {
	const when = new Date(Date.now() + daysAhead * 86_400_000);
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: zone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(when);
	const part = (type: string) => parts.find((p) => p.type === type)?.value;
	return `${part('year')}-${part('month')}-${part('day')}`;
}

async function addSongs(userId: string, seconds: number[], prefix = 'Song') {
	const { data, error } = await adminClient
		.from('songs')
		.insert(
			seconds.map((duration_seconds, i) => ({
				user_id: userId,
				title: `${prefix} ${i + 1}`,
				duration_seconds
			}))
		)
		.select();
	if (error) throw new Error(error.message);
	return data;
}

async function addSet(
	userId: string,
	fields: Record<string, unknown>,
	songs: Array<{ id: string }> = []
) {
	const { data: set, error } = await adminClient
		.from('setlists')
		.insert({ user_id: userId, transition_seconds: 0, ...fields })
		.select()
		.single();
	if (error) throw new Error(error.message);
	if (songs.length > 0) {
		const { error: rowError } = await adminClient
			.from('setlist_songs')
			.insert(songs.map((song, position) => ({ setlist_id: set.id, song_id: song.id, position })));
		if (rowError) throw new Error(rowError.message);
	}
	return set;
}

const board = (page: Page) => page.getByRole('region', { name: /Next gig|Latest set/ });

test.describe('The next gig board', () => {
	test('says whether the set fits and offers what to do about it', async ({ browser }) => {
		const { page, user, cleanup } = await createSecondUser(browser);
		try {
			const songs = await addSongs(user.id, [300, 300]);
			const set = await addSet(
				user.id,
				{
					name: 'Over Gig',
					venue: 'The Crypt',
					gig_date: dateInZone(undefined, 5),
					target_seconds: 540,
					share_token: crypto.randomUUID()
				},
				songs
			);

			await page.goto('/dashboard');
			const hero = board(page);
			await expect(hero.getByRole('heading', { name: 'Over Gig' })).toBeVisible();
			await expect(hero).toContainText('The Crypt');
			await expect(hero).toContainText('In 5 days');
			await expect(hero).toContainText('Sharing on');
			await expect(hero).toContainText('1:00 over');
			await expect(hero.getByRole('link', { name: 'Rehearse' })).toHaveAttribute(
				'href',
				`/setlists/${set.id}/rehearse`
			);
			await expect(hero.getByRole('link', { name: 'Print' })).toHaveAttribute(
				'href',
				`/setlists/${set.id}/print`
			);
			await expect(hero.getByRole('button', { name: 'Copy share link' })).toBeVisible();
		} finally {
			await cleanup();
		}
	});

	test('turns sharing on from the board', async ({ browser }) => {
		const { page, user, cleanup } = await createSecondUser(browser);
		try {
			const songs = await addSongs(user.id, [200]);
			const set = await addSet(user.id, { name: 'Unshared Gig' }, songs);

			await page.goto('/dashboard');
			const hero = board(page);
			await expect(hero).not.toContainText('Sharing on');
			await hero.getByRole('button', { name: 'Share', exact: true }).click();
			await expect(hero).toContainText('Sharing on');
			await expect(hero.getByRole('button', { name: 'Copy share link' })).toBeVisible();

			const { data } = await adminClient
				.from('setlists')
				.select('share_token')
				.eq('id', set.id)
				.single();
			expect(data?.share_token).toBeTruthy();
		} finally {
			await cleanup();
		}
	});

	test('an empty set only offers adding songs', async ({ browser }) => {
		const { page, user, cleanup } = await createSecondUser(browser);
		try {
			await addSet(user.id, { name: 'Empty Gig' });
			await page.goto('/dashboard');
			const hero = board(page);
			await expect(hero).toContainText('Nothing in this set yet');
			await expect(hero.getByRole('link', { name: 'Add songs' })).toBeVisible();
			await expect(hero.getByRole('link', { name: 'Rehearse' })).toHaveCount(0);
		} finally {
			await cleanup();
		}
	});

	// The server runs on UTC, so from early evening in the US it's already on tomorrow.
	// One of these two zones is always on a different date from the machine running this,
	// and which one depends on the time of day, so both are tried.
	for (const zone of ['Pacific/Pago_Pago', 'Pacific/Kiritimati']) {
		test(`knows which day it is in ${zone}`, async ({ browser }) => {
			const serverToday = dateInZone();
			const localToday = dateInZone(zone);
			test.skip(localToday === serverToday, 'Same date as the server at the moment');

			const { page, user, cleanup } = await createSecondUser(browser);
			const context = await browser.newContext({
				storageState: await page.context().storageState(),
				baseURL: 'http://localhost:5173',
				timezoneId: zone
			});
			try {
				const later = await addSet(user.id, {
					name: 'Later Gig',
					gig_date: dateInZone(zone, 10)
				});
				const wrongDay = localToday < serverToday ? 'Tonight Gig' : 'Last Night Gig';
				// Behind the server: tonight is yesterday to the server, and must stay on.
				// Ahead of it: last night is today to the server, and must be gone.
				await addSet(user.id, {
					name: wrongDay,
					gig_date: localToday < serverToday ? localToday : serverToday
				});
				const expected = localToday < serverToday ? wrongDay : later.name;

				const localPage = await context.newPage();
				await localPage.goto('/dashboard');
				await expect(localPage.getByRole('heading', { level: 1 })).toHaveText(expected);
				if (expected === wrongDay) {
					await expect(board(localPage)).toContainText('Tonight');
				}

				// Once the zone is known, the server gets it right before any script runs
				const html = await (await localPage.request.get('/dashboard')).text();
				// Every set's name is in the page's data, so only the heading itself proves this
				expect(html).toMatch(new RegExp(`<h1[^>]*>(?:\\s|<!--.*?-->)*${expected}`));
				await expect(localPage.getByRole('heading', { level: 1 })).toHaveText(expected);
			} finally {
				await context.close();
				await cleanup();
			}
		});
	}
});

test.describe('What the dashboard lists', () => {
	test('gigs coming up lead with the date, and other sets follow', async ({ browser }) => {
		const { page, user, cleanup } = await createSecondUser(browser);
		try {
			const songs = await addSongs(user.id, [240]);
			await addSet(
				user.id,
				{ name: 'Nearest', gig_date: dateInZone(undefined, 1), target_seconds: 300 },
				songs
			);
			await addSet(
				user.id,
				{ name: 'Further', gig_date: dateInZone(undefined, 9), target_seconds: 300 },
				songs
			);
			await addSet(user.id, { name: 'Just A List' }, songs);

			await page.goto('/dashboard');
			await expect(board(page).getByRole('heading', { name: 'Nearest' })).toBeVisible();
			await expect(board(page)).toContainText('Tomorrow');

			const comingUp = page.locator('section', {
				has: page.getByRole('heading', { name: 'Coming up' })
			});
			const further = comingUp.getByRole('link', { name: /Further/ });
			await expect(further).toContainText('In 9 days');
			// 4:00 against a 5:00 target
			await expect(further).toContainText('-1:00');

			const recent = page.locator('section', {
				has: page.getByRole('heading', { name: 'Recent setlists' })
			});
			await expect(recent.getByRole('link', { name: /Just A List/ })).toBeVisible();
			await expect(recent).not.toContainText('Further');

			await expect(page.getByRole('link', { name: 'New setlist' })).toHaveAttribute(
				'href',
				'/setlists?new'
			);
		} finally {
			await cleanup();
		}
	});

	test('getting ready shows what is left to shed for the next gig', async ({ browser }) => {
		const { page, user, cleanup } = await createSecondUser(browser);
		try {
			const [solid, learning, needsWork, unmarked] = await addSongs(user.id, [100, 100, 100, 100]);
			await adminClient.from('song_practice').insert([
				{ user_id: user.id, song_id: solid.id, status: 'solid' },
				{ user_id: user.id, song_id: learning.id, status: 'learning' },
				{ user_id: user.id, song_id: needsWork.id, status: 'needs_work' }
			]);
			await addSet(user.id, { name: 'Prep Gig', gig_date: dateInZone(undefined, 3) }, [
				solid,
				learning,
				needsWork,
				unmarked
			]);

			await page.goto('/dashboard');
			const panel = page.getByRole('region', { name: 'Getting ready' });
			await expect(panel).toContainText('1 of 4 solid');

			// Worst first, and nothing that's already solid
			const rows = panel.getByRole('listitem');
			await expect(rows).toHaveCount(3);
			await expect(rows.nth(0)).toContainText(needsWork.title);
			await expect(rows.nth(1)).toContainText(learning.title);
			await expect(rows.nth(2)).toContainText(unmarked.title);
			await expect(rows.nth(2)).toContainText('Not marked');
			await expect(panel).not.toContainText(solid.title);

			await expect(rows.nth(0).getByRole('link')).toHaveAttribute(
				'href',
				`/songs/${needsWork.id}/practice?from=/dashboard`
			);
			await expect(panel.getByRole('link', { name: "Today's session" })).toHaveAttribute(
				'href',
				'/practice'
			);
		} finally {
			await cleanup();
		}
	});

	test('demos show each one’s newest news, comments included', async ({ browser }) => {
		const { page, user, cleanup } = await createSecondUser(browser);
		const { data: band } = await adminClient
			.from('bands')
			.insert({ owner_id: user.id, name: 'Feed Band' })
			.select()
			.single();
		try {
			await adminClient
				.from('band_members')
				.insert({ band_id: band!.id, user_id: user.id, role: 'owner' });
			await addSet(user.id, { name: 'A Set' });

			// Rows only: the feed never plays anything, so no audio has to exist
			const addDemo = async (title: string, hoursAgo: number) => {
				const { data: track } = await adminClient
					.from('tracks')
					.insert({ band_id: band!.id, title, created_by: user.id })
					.select()
					.single();
				const { data: version } = await adminClient
					.from('track_versions')
					.insert({
						track_id: track!.id,
						version_number: 2,
						storage_path: `bands/${band!.id}/tracks/${crypto.randomUUID()}.wav`,
						file_name: 'not-uploaded.wav',
						mime_type: 'audio/wav',
						file_size_bytes: 1,
						duration_seconds: 120,
						uploaded_by: user.id,
						created_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString()
					})
					.select()
					.single();
				return { track: track!, version: version! };
			};
			const uploaded = await addDemo('Only Uploaded', 2);
			const commented = await addDemo('Commented On', 48);
			const settled = await addDemo('Settled Comment', 72);

			const comment = (versionId: string, body: string, fields = {}) =>
				adminClient.from('track_comments').insert({
					version_id: versionId,
					author_id: user.id,
					body,
					timestamp_seconds: 83,
					...fields
				});
			await comment(commented.version.id, 'Bridge drags');
			await comment(settled.version.id, 'Old news', {
				resolved_at: new Date().toISOString(),
				resolved_by: user.id
			});

			await page.goto('/dashboard');
			const demos = page.locator('section', {
				has: page.getByRole('heading', { name: 'Demos' })
			});
			await expect(demos.getByRole('link', { name: /Commented On/ })).toContainText(
				'You commented at 1:23: “Bridge drags”'
			);
			await expect(demos.getByRole('link', { name: /Only Uploaded/ })).toContainText(
				'You uploaded v2'
			);
			await expect(demos.getByRole('link', { name: /Settled Comment/ })).toContainText(
				'You uploaded v2'
			);
			await expect(demos).not.toContainText('Old news');
			await expect(demos.getByRole('link', { name: /Only Uploaded/ })).toHaveAttribute(
				'href',
				`/bands/${band!.id}/demos/${uploaded.track.id}`
			);
		} finally {
			// Bands restrict their owner's deletion, so this goes first
			await adminClient.from('bands').delete().eq('id', band!.id);
			await cleanup();
		}
	});

	test('first run is just the activation board', async ({ browser }) => {
		const { page, cleanup } = await createSecondUser(browser);
		try {
			await page.goto('/dashboard');
			await expect(page.getByRole('heading', { name: 'Build your first set' })).toBeVisible();
			await expect(page.getByRole('link', { name: 'Add your first song' })).toBeVisible();
			await expect(page.getByRole('region', { name: 'Shed next' })).toHaveCount(0);
			await expect(page.getByText('This week')).toHaveCount(0);
		} finally {
			await cleanup();
		}
	});
});
