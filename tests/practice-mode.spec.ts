import fs from 'node:fs';
import { test, expect } from './fixtures';
import {
	createBand,
	createSetlist,
	createSong,
	createSongAudio,
	createSongFile,
	createTrackData
} from './helpers/factories';
import {
	cleanupSongAudio,
	cleanupSongFiles,
	cleanupTrackAudio,
	safeDelete
} from './helpers/cleanup';
import { createSecondUser } from './helpers/multi-user';
import { adminClient } from './helpers/supabase-admin';

function daysFromNow(days: number): string {
	const date = new Date();
	date.setDate(date.getDate() + days);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

test.describe('Practice on the main menu', () => {
	test('is reachable on desktop and fits on the smallest phones', async ({ page }) => {
		await page.goto('/dashboard');
		await page.locator('a[href="/practice"]:visible').click();
		await expect(page).toHaveURL(/\/practice$/);
		await expect(page.getByRole('heading', { name: 'Practice', exact: true })).toBeVisible();

		await page.setViewportSize({ width: 320, height: 568 });
		await page.goto('/dashboard');
		const items = page.locator('nav a:visible');
		await expect(items).toHaveCount(6);
		const boxes = await items.evaluateAll((links) =>
			links.map((link) => {
				const { left, right, height } = link.getBoundingClientRect();
				return {
					label: link.textContent?.trim(),
					left,
					right,
					height,
					overflow: link.scrollWidth > link.clientWidth
				};
			})
		);
		for (const box of boxes) {
			expect(box.left, `${box.label} starts on screen`).toBeGreaterThanOrEqual(0);
			expect(box.right, `${box.label} ends on screen`).toBeLessThanOrEqual(320);
			expect(box.height, `${box.label} is tall enough to tap`).toBeGreaterThanOrEqual(44);
			expect(box.overflow, `${box.label} fits its slot`).toBe(false);
		}
	});
});

test.describe('Today', () => {
	test('with nothing planned, points at where to start', async ({ browser }) => {
		const fresh = await createSecondUser(browser);
		try {
			await fresh.page.goto('/practice');
			await expect(fresh.page.getByText('Nothing planned yet')).toBeVisible();
			await expect(fresh.page.getByRole('link', { name: 'Pick a song' })).toHaveAttribute(
				'href',
				'/practice/shed'
			);
			await expect(fresh.page.getByRole('region', { name: 'Metronome' })).toBeVisible();
		} finally {
			await fresh.cleanup();
		}
	});

	test('shows the next gig, including a band gig, and its songs once each', async ({
		page,
		browser,
		testUser
	}) => {
		const band = await createBand(page, testUser.id, { name: 'The Practice Band' });
		const repeated = await createSong(page, testUser.id, { title: 'Encore Twice' });
		const other = await createSong(page, testUser.id, { title: 'Second Tune' });
		const soon = await createSetlist(page, testUser.id, {
			name: 'Band Gig Soon',
			band_id: band.id,
			venue: 'The Fleece',
			gig_date: daysFromNow(3)
		});
		const member = await createSecondUser(browser);
		let later: { id: string } | undefined;

		try {
			await createSongAudio(repeated.id, { label: 'Full mix' });
			await createSongFile(other.id, { label: 'Chords' });
			await adminClient.from('band_songs').insert([
				{ band_id: band.id, song_id: repeated.id, added_by: testUser.id },
				{ band_id: band.id, song_id: other.id, added_by: testUser.id }
			]);
			await adminClient.from('setlist_songs').insert([
				{ setlist_id: soon.id, song_id: repeated.id, position: 0 },
				{ setlist_id: soon.id, gap_seconds: 30, position: 1 },
				{ setlist_id: soon.id, song_id: other.id, position: 2 },
				{ setlist_id: soon.id, song_id: repeated.id, position: 3 }
			]);
			await adminClient
				.from('band_members')
				.insert({ band_id: band.id, user_id: member.user.id, role: 'member' });
			later = await createSetlist(member.page, member.user.id, {
				name: 'Further Off',
				gig_date: daysFromNow(40)
			});

			await member.page.goto('/practice');
			await expect(member.page.getByRole('heading', { name: 'Band Gig Soon' })).toBeVisible();
			await expect(member.page.getByText(/In 3 days/)).toBeVisible();
			await expect(member.page.getByText(/The Fleece · The Practice Band/)).toBeVisible();

			const rows = member.page.getByRole('listitem').getByRole('link');
			await expect(rows).toHaveCount(2);
			await expect(rows.first()).toContainText('Encore Twice');
			await expect(rows.first()).toContainText('Has audio');
			await expect(rows.last()).toContainText('Has a chart');

			await rows.first().click();
			await expect(member.page.getByRole('heading', { name: 'Encore Twice' })).toBeVisible();
			await member.page.getByRole('link', { name: 'Back', exact: true }).click();
			await expect(member.page).toHaveURL(/\/practice$/);
		} finally {
			await member.cleanup();
			if (later) await safeDelete('setlists', later.id);
			await cleanupSongAudio(repeated.id);
			await cleanupSongFiles(other.id);
			await safeDelete('setlists', soon.id);
			await safeDelete('songs', repeated.id);
			await safeDelete('songs', other.id);
			await safeDelete('bands', band.id);
		}
	});
});

test.describe('Shed list', () => {
	test('lists your songs and your bands, searches, filters by setlist, and hides others', async ({
		page,
		browser,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);
		const shared = await createSong(page, testUser.id, { title: 'Shared Band Tune' });
		const stranger = await createSong(page, testUser.id, { title: 'Not Linked Anywhere' });
		const member = await createSecondUser(browser);
		let setlistId: string | undefined;

		try {
			await adminClient
				.from('band_songs')
				.insert({ band_id: band.id, song_id: shared.id, added_by: testUser.id });
			await adminClient
				.from('band_members')
				.insert({ band_id: band.id, user_id: member.user.id, role: 'member' });
			const mine = await createSong(member.page, member.user.id, { title: 'My Own Tune' });
			const setlist = await createSetlist(member.page, member.user.id, {
				name: 'Filter Set',
				gig_date: null
			});
			setlistId = setlist.id;
			await adminClient
				.from('setlist_songs')
				.insert({ setlist_id: setlist.id, song_id: mine.id, position: 0 });

			await member.page.goto('/practice/shed');
			const rows = member.page.getByRole('listitem').getByRole('link');
			await expect(rows).toHaveCount(2);
			await expect(member.page.getByText('Not Linked Anywhere')).toHaveCount(0);

			await member.page.getByLabel('Search songs').fill('band');
			await expect(rows).toHaveCount(1);
			await expect(rows.first()).toContainText('Shared Band Tune');
			await member.page.getByLabel('Search songs').fill('');

			await member.page.getByLabel('Filter by setlist').selectOption({ label: 'Filter Set' });
			await expect(rows).toHaveCount(1);
			await expect(rows.first()).toContainText('My Own Tune');

			await rows.first().click();
			await expect(member.page.getByRole('heading', { name: 'My Own Tune' })).toBeVisible();
			await expect(member.page.locator('a[href="/practice"]:visible')).toHaveAttribute(
				'aria-current',
				'page'
			);
			await member.page.getByRole('link', { name: 'Back', exact: true }).click();
			await expect(member.page).toHaveURL(/\/practice\/shed$/);
		} finally {
			await member.cleanup();
			if (setlistId) await safeDelete('setlists', setlistId);
			await safeDelete('songs', shared.id);
			await safeDelete('songs', stranger.id);
			await safeDelete('bands', band.id);
		}
	});
});

test.describe('Shed demos', () => {
	async function addVersion(trackId: string, bandId: string, userId: string, number: number) {
		const path = `bands/${bandId}/tracks/${crypto.randomUUID()}.wav`;
		const file = fs.readFileSync('tests/fixtures/sample.wav');
		await adminClient.storage.from('tracks').upload(path, file, { contentType: 'audio/wav' });
		const { error } = await adminClient.from('track_versions').insert({
			track_id: trackId,
			version_number: number,
			storage_path: path,
			file_name: `take-${number}.wav`,
			mime_type: 'audio/wav',
			file_size_bytes: file.length,
			duration_seconds: 1,
			uploaded_by: userId
		});
		if (error) throw new Error(error.message);
	}

	test("lists your bands' demos, opens the newest take, and logs time privately", async ({
		page,
		browser,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);
		const demo = await createTrackData(band.id, testUser.id, { title: 'Bridge Idea' });
		const member = await createSecondUser(browser);
		const outsider = await createSecondUser(browser);
		try {
			await addVersion(demo.id, band.id, testUser.id, 2);
			await adminClient
				.from('band_members')
				.insert({ band_id: band.id, user_id: member.user.id, role: 'member' });

			// Not in the band: not in the list, and no way in by address
			await outsider.page.goto('/practice/shed');
			await expect(outsider.page.getByText('Nothing to shed yet')).toBeVisible();
			await expect(outsider.page.getByText('Bridge Idea')).toHaveCount(0);
			const denied = await outsider.page.goto(`/demos/${demo.id}/practice`);
			expect(denied?.status()).toBe(404);

			// No songs of your own: the demos still make it a page, not an empty state
			await member.page.goto('/practice/shed');
			await expect(member.page.getByText('Nothing to shed yet')).toHaveCount(0);
			const demos = member.page.getByRole('region', { name: 'Demos' });
			await expect(demos.getByRole('link')).toContainText('Bridge Idea');
			await expect(demos.getByRole('link')).toContainText('2');

			await member.page.getByLabel('Search songs and demos').fill('nothing like it');
			await expect(demos).toHaveCount(0);
			await expect(member.page.getByText('Nothing matches.')).toBeVisible();
			await member.page.getByLabel('Search songs and demos').fill('bridge');
			await demos.getByRole('link').click();

			await expect(member.page).toHaveURL(new RegExp(`/demos/${demo.id}/practice`));
			const heading = member.page.getByRole('heading', { name: 'Bridge Idea' });
			await expect(heading).toBeVisible();
			await expect(member.page.locator('a[href="/practice"]:visible')).toHaveAttribute(
				'aria-current',
				'page'
			);

			// The player is really loaded, on the newest take
			const take = member.page.getByLabel('Mix');
			await expect(take.locator('option:checked')).toHaveText('Version 2 (latest)');
			await expect(member.page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();

			// An old take is one tap away, but never where you land next time
			await take.selectOption({ label: 'Version 1' });
			await expect(take.locator('option:checked')).toHaveText('Version 1');
			await member.page.reload();
			await expect(take.locator('option:checked')).toHaveText('Version 2 (latest)');

			await member.page.getByRole('link', { name: 'Back', exact: true }).click();
			await expect(member.page).toHaveURL(/\/practice\/shed$/);

			// Time counts toward the log, and belongs to the person who played
			await member.page.clock.install();
			await member.page.goto(`/demos/${demo.id}/practice`);
			await expect(member.page.getByTestId('practice-clock')).toBeVisible();
			await member.page.clock.runFor(65_000);
			await expect
				.poll(async () => {
					const { data } = await adminClient
						.from('practice_session_items')
						.select('kind, song_id, practice_seconds, practice_sessions!inner(user_id)')
						.eq('label', 'Bridge Idea')
						.eq('practice_sessions.user_id', member.user.id);
					return data?.[0]?.practice_seconds ?? 0;
				})
				.toBeGreaterThanOrEqual(60);
		} finally {
			await member.cleanup();
			await outsider.cleanup();
			await cleanupTrackAudio(band.id);
			await safeDelete('bands', band.id);
		}
	});

	test('shows the newest few first, with the rest a tap or a search away', async ({
		page,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);
		try {
			for (const title of ['Oldest Demo', 'Second Demo', 'Third Demo', 'Newest Demo']) {
				const { id } = await createTrackData(band.id, testUser.id, { title });
				// updated_at is what orders the list, and these can land in one millisecond
				await adminClient
					.from('tracks')
					.update({ updated_at: new Date(Date.now() + title.length).toISOString() })
					.eq('id', id);
			}
			const { data: ordered } = await adminClient
				.from('tracks')
				.select('title')
				.eq('band_id', band.id)
				.order('updated_at', { ascending: false });
			const titles = (ordered ?? []).map((t) => t.title);

			await page.goto('/practice/shed');
			const demos = page.getByRole('region', { name: 'Demos' });
			const rows = demos.getByRole('link');
			await expect(rows).toHaveCount(3);
			await expect(rows.nth(0)).toContainText(titles[0]);
			await expect(demos).not.toContainText(titles[3]);

			// Search looks through all of them, not just the ones showing
			await page.getByLabel('Search songs and demos').fill(titles[3]);
			await expect(rows).toHaveCount(1);
			await page.getByLabel('Search songs and demos').fill('');

			await demos.getByRole('button', { name: 'Show all 4 demos' }).click();
			await expect(rows).toHaveCount(4);
			await expect(demos.getByRole('button')).toHaveCount(0);
		} finally {
			await cleanupTrackAudio(band.id);
			await safeDelete('bands', band.id);
		}
	});

	test('a setlist filter leaves only songs, because demos are not on setlists', async ({
		page,
		testUser
	}) => {
		const band = await createBand(page, testUser.id);
		const song = await createSong(page, testUser.id, { title: 'On The Set' });
		const setlist = await createSetlist(page, testUser.id, { name: 'Demo Free', gig_date: null });
		try {
			await createTrackData(band.id, testUser.id, { title: 'Off The Set' });
			await adminClient
				.from('setlist_songs')
				.insert({ setlist_id: setlist.id, song_id: song.id, position: 0 });

			await page.goto('/practice/shed');
			await expect(page.getByRole('region', { name: 'Demos' })).toContainText('Off The Set');
			await page.getByLabel('Filter by setlist').selectOption({ label: 'Demo Free' });
			await expect(page.getByRole('region', { name: 'Demos' })).toHaveCount(0);
			await expect(page.getByRole('link', { name: /On The Set/ })).toBeVisible();
		} finally {
			await safeDelete('setlists', setlist.id);
			await safeDelete('songs', song.id);
			await cleanupTrackAudio(band.id);
			await safeDelete('bands', band.id);
		}
	});

	test('a malformed address is a 404', async ({ page }) => {
		const response = await page.goto('/demos/not-a-uuid/practice');
		expect(response?.status()).toBe(404);
	});
});

test.describe('Shed screen', () => {
	test('desktop shows the chart, controls, metronome and notes together', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Desk Song', notes: 'Capo 3' });
		try {
			await createSongAudio(song.id, { label: 'Full mix' });
			await createSongFile(song.id, { label: 'Chords' });

			await page.goto(`/songs/${song.id}/practice`);
			await expect(page.getByRole('slider', { name: 'Seek' })).toBeVisible();
			await expect(page.locator('iframe[title^="Chart:"]')).toBeVisible();
			await expect(page.getByRole('slider', { name: 'Volume' })).toBeVisible();
			await expect(page.getByRole('region', { name: 'Metronome' })).toBeVisible();
			await expect(page.getByText('Capo 3')).toBeVisible();
			// The phone's pane tabs must not leak onto wider screens
			await expect(page.getByRole('button', { name: 'Controls', exact: true })).toBeHidden();
		} finally {
			await cleanupSongAudio(song.id);
			await cleanupSongFiles(song.id);
			await safeDelete('songs', song.id);
		}
	});

	test('a phone gets one pane at a time above the waveform, with no bottom nav', async ({
		page,
		testUser
	}) => {
		const song = await createSong(page, testUser.id, { title: 'Phone Song', notes: 'Capo 3' });
		try {
			await createSongAudio(song.id, { label: 'Full mix' });
			await createSongFile(song.id, { label: 'Chords' });

			await page.setViewportSize({ width: 390, height: 844 });
			await page.goto(`/songs/${song.id}/practice`);
			await expect(page.locator('nav a:visible')).toHaveCount(0);

			const seek = page.getByRole('slider', { name: 'Seek' });
			const chart = page.locator('iframe[title^="Chart:"]');
			const volume = page.getByRole('slider', { name: 'Volume' });
			const metronome = page.getByRole('region', { name: 'Metronome' });

			await expect(seek).toBeVisible();
			await expect(chart).toBeVisible();
			await expect(volume).toBeHidden();

			await page.getByRole('button', { name: 'Controls', exact: true }).click();
			await expect(volume).toBeVisible();
			await expect(chart).toBeHidden();

			await page.getByRole('button', { name: 'Metronome', exact: true }).click();
			await expect(metronome).toBeVisible();
			await expect(volume).toBeHidden();

			await page.getByRole('button', { name: 'Notes', exact: true }).click();
			await expect(page.getByText('Capo 3')).toBeVisible();
			await expect(seek).toBeVisible();
		} finally {
			await cleanupSongAudio(song.id);
			await cleanupSongFiles(song.id);
			await safeDelete('songs', song.id);
		}
	});

	test('a song with no audio can still be shed to the metronome', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Silent Shed' });
		try {
			await page.goto(`/songs/${song.id}/practice`);
			await expect(page.getByText('No rehearsal audio yet')).toBeVisible();
			await expect(page.getByRole('region', { name: 'Metronome' })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Back 5 seconds' })).toHaveCount(0);
		} finally {
			await safeDelete('songs', song.id);
		}
	});
});

test.describe('Metronome', () => {
	test('runs, lights its lamps, stops, and answers to M', async ({ page }) => {
		await page.goto('/practice');
		const metronome = page.getByRole('region', { name: 'Metronome' });
		const lamps = metronome.locator('[data-beat]');
		const toggle = metronome.getByRole('button', { name: /metronome/ });

		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		await expect(lamps).toHaveAttribute('data-beat', '-1');

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-pressed', 'true');
		const seen = new Set<string>();
		await expect
			.poll(
				async () => {
					seen.add((await lamps.getAttribute('data-beat')) ?? '');
					return seen.size;
				},
				{ timeout: 10_000 }
			)
			.toBeGreaterThanOrEqual(3);

		await toggle.click();
		await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		await expect(lamps).toHaveAttribute('data-beat', '-1');
	});

	test('sets tempo by tap, buttons and knob, and remembers it per song', async ({
		page,
		testUser
	}) => {
		const first = await createSong(page, testUser.id, { title: 'Tempo First' });
		const second = await createSong(page, testUser.id, { title: 'Tempo Second' });
		try {
			await page.clock.install();
			await page.goto(`/songs/${first.id}/practice`);
			// Stop the clock so the only time between taps is the time we say
			await page.clock.pauseAt(Date.now() + 60_000);
			const metronome = page.getByRole('region', { name: 'Metronome' });
			const knob = metronome.getByRole('slider', { name: 'Tempo' });

			// Four taps half a second apart is 120 BPM
			const tap = metronome.getByRole('button', { name: 'Tap tempo' });
			for (let i = 0; i < 4; i++) {
				await tap.click();
				await page.clock.runFor(500);
			}
			await expect(knob).toHaveAttribute('aria-valuenow', '120');
			await page.clock.resume();

			await metronome.getByRole('button', { name: 'Faster' }).click();
			await expect(knob).toHaveAttribute('aria-valuenow', '121');
			await knob.focus();
			await page.keyboard.press('ArrowDown');
			await expect(knob).toHaveAttribute('aria-valuenow', '120');

			await metronome.getByLabel('Beats per bar').selectOption('3');
			await expect(metronome.locator('[data-beat] > span')).toHaveCount(3);

			// A different song starts from the last tempo used, and can keep its own
			await page.goto(`/songs/${second.id}/practice`);
			await expect(knob).toHaveAttribute('aria-valuenow', '120');
			await metronome.getByRole('button', { name: 'Slower' }).click();
			await expect(knob).toHaveAttribute('aria-valuenow', '119');

			await page.goto(`/songs/${first.id}/practice`);
			await expect(knob).toHaveAttribute('aria-valuenow', '120');
			await expect(metronome.locator('[data-beat] > span')).toHaveCount(3);
		} finally {
			await safeDelete('songs', first.id);
			await safeDelete('songs', second.id);
		}
	});

	test('M toggles it from the shed screen, but not while typing', async ({ page, testUser }) => {
		const song = await createSong(page, testUser.id, { title: 'Keyboard Shed' });
		try {
			await createSongAudio(song.id, { label: 'Full mix' });
			await page.goto(`/songs/${song.id}/practice`);
			const toggle = page
				.getByRole('region', { name: 'Metronome' })
				.getByRole('button', { name: /metronome/ });

			await page.getByRole('heading', { name: 'Keyboard Shed' }).click();
			await page.keyboard.press('m');
			await expect(toggle).toHaveAttribute('aria-pressed', 'true');
			await page.keyboard.press('m');
			await expect(toggle).toHaveAttribute('aria-pressed', 'false');
		} finally {
			await cleanupSongAudio(song.id);
			await safeDelete('songs', song.id);
		}
	});
});
