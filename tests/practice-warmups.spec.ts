import { test, expect } from './fixtures';
import { createSong } from './helpers/factories';
import { dragAndDrop } from './helpers/dnd';
import { createSecondUser } from './helpers/multi-user';
import { adminClient } from './helpers/supabase-admin';

const TAB_FIXTURE = 'tests/fixtures/sample.gp';
const AUDIO_FIXTURE = 'tests/fixtures/sample.wav';

async function addExercise(page: import('@playwright/test').Page, title: string, minutes = '2') {
	await page.getByLabel('New exercise').fill(title);
	await page.getByLabel('Minutes').fill(minutes);
	await page.getByRole('button', { name: 'Add', exact: true }).click();
	await expect(page.getByRole('link', { name: title })).toBeVisible();
}

test.describe('Warm up', () => {
	test('builds a routine, reorders it, and runs it step by step', async ({ browser }) => {
		const user = await createSecondUser(browser);
		const { page } = user;
		try {
			await page.goto('/practice/warm-up');
			await expect(page.getByText('No warm-up yet')).toBeVisible();

			await addExercise(page, 'Chromatic run', '2');
			await addExercise(page, 'Slow scales', '3');
			await expect(page.getByText('5m')).toBeVisible();

			const routine = page.getByRole('list', { name: 'Warm-up routine' });
			const rowOf = (title: string) => routine.getByRole('listitem').filter({ hasText: title });
			await dragAndDrop(page, rowOf('Slow scales'), rowOf('Chromatic run'), {
				steps: 15,
				offsetY: -10
			});
			await expect
				.poll(async () => {
					const { data } = await adminClient
						.from('exercises')
						.select('title')
						.eq('user_id', user.user.id)
						.order('routine_position');
					return data?.map((row) => row.title);
				})
				.toEqual(['Slow scales', 'Chromatic run']);

			// Out of the routine and back again
			await page.getByRole('button', { name: 'Take Chromatic run out of the routine' }).click();
			await expect(page.getByRole('region', { name: 'Other exercises' })).toContainText(
				'Chromatic run'
			);
			await page.getByRole('button', { name: 'Add Chromatic run to the routine' }).click();
			await expect(routine).toContainText('Chromatic run');

			await page.getByRole('button', { name: 'Start warm-up' }).click();
			await expect(page.getByRole('heading', { name: 'Slow scales' })).toBeVisible();
			const session = page.getByRole('navigation', { name: 'Practice session' });
			await expect(session).toContainText('1 of 2');

			await session.getByRole('link', { name: /Next: Chromatic run/ }).click();
			await expect(page.getByRole('heading', { name: 'Chromatic run' })).toBeVisible();
			await expect(session).toContainText('2 of 2');

			await session.getByRole('link', { name: 'Finish' }).click();
			await expect(page).toHaveURL(/\/practice\/log$/);
		} finally {
			await user.cleanup();
		}
	});

	test('an exercise can hold a Guitar Pro file and a backing track, and cleans up after itself', async ({
		browser
	}) => {
		const user = await createSecondUser(browser);
		const stranger = await createSecondUser(browser);
		const { page } = user;
		try {
			await page.goto('/practice/warm-up');
			await addExercise(page, 'Riff drill');
			await page.getByRole('link', { name: 'Riff drill' }).click();
			await expect(page.getByRole('heading', { name: 'Riff drill' })).toBeVisible();
			const exerciseUrl = page.url();

			await page.locator('input[type="file"][accept*=".gp"]').setInputFiles(TAB_FIXTURE);
			await page.getByRole('button', { name: 'Upload chart' }).click();
			const player = page.getByRole('region', { name: 'Tab player' });
			await expect(player.getByRole('button', { name: 'Play tab' })).toBeEnabled({
				timeout: 30_000
			});

			await page.locator('input[type="file"][accept*="audio"]').setInputFiles(AUDIO_FIXTURE);
			await page.getByRole('button', { name: 'Upload audio' }).click();
			await expect(page.getByRole('slider', { name: 'Seek' })).toBeVisible({ timeout: 30_000 });

			const stored = async () => {
				const { data } = await adminClient
					.from('exercises')
					.select('id, exercise_audio(storage_path), exercise_files(storage_path)')
					.eq('user_id', user.user.id);
				return data ?? [];
			};
			const [exercise] = await stored();
			const paths = [
				...exercise.exercise_audio.map((row) => row.storage_path),
				...exercise.exercise_files.map((row) => row.storage_path)
			];
			expect(paths).toHaveLength(2);

			// Private: someone else just gets a 404
			const response = await stranger.page.goto(exerciseUrl);
			expect(response?.status()).toBe(404);

			await page.getByRole('button', { name: 'Delete exercise' }).click();
			await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(page).toHaveURL(/\/practice\/warm-up$/);
			expect(await stored()).toEqual([]);

			// The files go too, not just the rows
			const folder = paths[0].split('/').slice(0, 2).join('/');
			const { data: left } = await adminClient.storage.from('exercise-files').list(folder);
			expect(left).toEqual([]);
		} finally {
			await stranger.cleanup();
			await user.cleanup();
		}
	});
});

test.describe('Techniques', () => {
	test('lessons follow your instrument, and starting one copies its drills', async ({
		browser
	}) => {
		const user = await createSecondUser(browser);
		const { page } = user;
		try {
			await page.goto('/practice/techniques');
			const lessons = page.getByRole('region', { name: 'Lessons' });
			await expect(lessons).toContainText('Alternate picking');

			await page.getByLabel('I play').selectOption({ label: 'Drums' });
			await expect(lessons).toContainText('Paradiddles');
			await expect(lessons).not.toContainText('Alternate picking');
			// For everyone, whatever you play
			await expect(lessons).toContainText('Playing in time');

			await page.reload();
			await expect(page.getByLabel('I play')).toHaveValue('drums');

			await page.getByRole('button', { name: 'Start Paradiddles' }).click();
			await expect(page.getByRole('heading', { name: 'Paradiddles' })).toBeVisible();
			const lesson = page.getByRole('region', { name: 'Lesson' });
			await expect(lesson).toContainText('How to do it');
			await expect(lesson).toContainText('Watch out for');
			const drills = page.getByRole('region', { name: 'Drills' });
			await expect(drills.getByRole('link', { name: 'Accented paradiddles' })).toBeVisible();
			await expect(page.getByTestId('best-bpm')).toContainText('120 BPM');

			// Starting it again doesn't duplicate it, and it leaves the list of lessons
			await page.goto('/practice/techniques');
			await expect(page.getByRole('region', { name: 'Your techniques' })).toContainText(
				'Paradiddles'
			);
			await expect(page.getByRole('button', { name: 'Start Paradiddles' })).toHaveCount(0);
		} finally {
			await user.cleanup();
		}
	});

	test('logs tempo against a goal, takes your own drills, and feeds the warm-up', async ({
		browser
	}) => {
		const user = await createSecondUser(browser);
		const { page } = user;
		try {
			await page.goto('/practice/techniques');
			await page.getByLabel('Something you want to work on').fill('Sweep picking');
			await page.getByRole('button', { name: 'Add', exact: true }).click();
			await expect(page.getByRole('heading', { name: 'Sweep picking' })).toBeVisible();
			await expect(page.getByRole('region', { name: 'Lesson' })).toHaveCount(0);

			await page.getByLabel('Tempo goal (BPM)').fill('140');
			await page.getByRole('button', { name: 'Save', exact: true }).click();
			const progress = page.getByRole('progressbar');
			await expect(progress).toHaveAttribute('aria-valuemax', '140');

			const best = page.getByTestId('best-bpm');
			const logTempo = async (bpm: string) => {
				await page.getByLabel('Played it clean at').fill(bpm);
				await page.getByRole('button', { name: 'Log', exact: true }).click();
			};
			await logTempo('90');
			await expect(best).toContainText('90');
			await logTempo('110');
			await expect(best).toContainText('110');
			// A slower day doesn't lower your best
			await logTempo('100');
			await expect(page.getByRole('region', { name: 'Tempo progress' })).toContainText('100 BPM');
			await expect(best).toContainText('110');
			await expect(progress).toHaveAttribute('aria-valuenow', '110');

			await page.getByLabel('New drill').fill('Three-string arpeggio');
			await page.getByRole('button', { name: 'Add', exact: true }).click();
			await expect(page.getByRole('link', { name: 'Three-string arpeggio' })).toBeVisible();
			await page.getByRole('button', { name: 'Add Three-string arpeggio to my warm-up' }).click();
			await expect(page.getByRole('region', { name: 'Drills' })).toContainText('In warm-up');

			await page.goto('/practice/warm-up');
			await expect(page.getByRole('list', { name: 'Warm-up routine' })).toContainText(
				'Three-string arpeggio'
			);

			// Deleting the technique leaves its drill in your warm-up
			await page.goto('/practice/techniques');
			await page.getByRole('link', { name: /Sweep picking/ }).click();
			await page.getByRole('button', { name: 'Delete technique' }).click();
			await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
			await expect(page).toHaveURL(/\/practice\/techniques$/);
			await page.goto('/practice/warm-up');
			await expect(page.getByRole('list', { name: 'Warm-up routine' })).toContainText(
				'Three-string arpeggio'
			);
		} finally {
			await user.cleanup();
		}
	});

	test('time on a technique counts toward the log', async ({ browser }) => {
		const user = await createSecondUser(browser);
		const { page } = user;
		try {
			await page.goto('/practice/techniques');
			await page.getByLabel('Something you want to work on').fill('Timed technique');
			await page.getByRole('button', { name: 'Add', exact: true }).click();
			await expect(page.getByRole('heading', { name: 'Timed technique' })).toBeVisible();

			await page.clock.install();
			await page.reload();
			// The clock appears once the tracker has started counting
			await expect(page.getByTestId('practice-clock')).toBeVisible();
			await page.clock.runFor(65_000);
			await expect
				.poll(async () => {
					const { data } = await adminClient
						.from('practice_session_items')
						.select('kind, label, practice_seconds')
						.eq('label', 'Timed technique');
					return data?.[0]?.practice_seconds ?? 0;
				})
				.toBeGreaterThanOrEqual(60);
		} finally {
			await user.cleanup();
		}
	});
});

test.describe("Today's session", () => {
	test('puts warm-up, technique and flagged songs in order, and runs through them', async ({
		browser
	}) => {
		const user = await createSecondUser(browser);
		const { page } = user;
		try {
			await page.goto('/practice');
			await expect(page.getByText('Nothing planned yet')).toBeVisible();

			const { data: exercise } = await adminClient
				.from('exercises')
				.insert({ user_id: user.user.id, title: 'Warm hands', routine_position: 0 })
				.select()
				.single();
			await adminClient.from('skills').insert({ user_id: user.user.id, title: 'Legato work' });
			const fine = await createSong(page, user.user.id, { title: 'Already Solid' });
			const hard = await createSong(page, user.user.id, { title: 'Hard Bridge' });
			await adminClient.from('song_practice').insert([
				{ user_id: user.user.id, song_id: fine.id, status: 'solid' },
				{ user_id: user.user.id, song_id: hard.id, status: 'needs_work' }
			]);
			expect(exercise).toBeTruthy();

			await page.goto('/practice');
			const today = page.getByRole('region', { name: "Today's session" });
			const steps = today.getByRole('listitem');
			await expect(steps).toHaveCount(3);
			await expect(steps.nth(0)).toContainText('Warm hands');
			await expect(steps.nth(1)).toContainText('Legato work');
			await expect(steps.nth(2)).toContainText('Hard Bridge');
			await expect(steps.nth(2)).toContainText('Needs work');
			await expect(today).not.toContainText('Already Solid');

			await today.getByRole('button', { name: 'Start session' }).click();
			await expect(page.getByRole('heading', { name: 'Warm hands' })).toBeVisible();
			const session = page.getByRole('navigation', { name: 'Practice session' });
			await session.getByRole('link', { name: /Next: Legato work/ }).click();
			await expect(page.getByRole('heading', { name: 'Legato work' })).toBeVisible();
			await session.getByRole('link', { name: /Next: Hard Bridge/ }).click();
			await expect(page.getByRole('heading', { name: 'Hard Bridge' })).toBeVisible();
			await expect(session).toContainText('3 of 3');
			await session.getByRole('link', { name: 'Finish' }).click();
			await expect(page).toHaveURL(/\/practice\/log$/);
		} finally {
			await user.cleanup();
		}
	});
});
