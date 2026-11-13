import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { createSecondUser } from './helpers/multi-user';
import { adminClient } from './helpers/supabase-admin';

/** Minutes the way the log writes them */
function time(minutes: number): string {
	if (minutes < 60) return `${minutes}m`;
	return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** Noon, so a session can't slip into the day either side of it */
function noon(daysAgo: number): Date {
	const at = new Date();
	at.setDate(at.getDate() - daysAgo);
	at.setHours(12, 0, 0, 0);
	return at;
}

type Entry = {
	kind: 'song' | 'exercise' | 'skill';
	label: string;
	minutes: number;
	song_id?: string;
	exercise_id?: string;
	skill_id?: string;
};

async function insert<T = { id: string }>(table: string, rows: Record<string, unknown>[]) {
	const { data, error } = await adminClient.from(table).insert(rows).select();
	if (error) throw new Error(`${table}: ${error.message}`);
	return data as T[];
}

async function logSession(userId: string, daysAgo: number, entries: Entry[]) {
	const at = noon(daysAgo).toISOString();
	const [session] = await insert('practice_sessions', [
		{ user_id: userId, started_at: at, last_active_at: at }
	]);
	await insert(
		'practice_session_items',
		entries.map(({ minutes, ...entry }) => ({
			...entry,
			session_id: session.id,
			practice_seconds: minutes * 60
		}))
	);
}

/**
 * Today: half an hour on a song, ten minutes of warm-up, twenty on a technique's drill.
 * A week ago to the day: twenty minutes on the song.
 */
async function seed(userId: string) {
	const [song] = await insert('songs', [
		{ user_id: userId, title: 'Logged Anthem', duration_seconds: 200 }
	]);
	const [skill] = await insert('skills', [{ user_id: userId, title: 'Sweep picking' }]);
	const [warmUp, drill] = await insert('exercises', [
		{ user_id: userId, title: 'Spider walk', routine_position: 0 },
		{ user_id: userId, title: 'Three-string sweep', skill_id: skill.id }
	]);
	const anthem = { kind: 'song', label: 'Logged Anthem', song_id: song.id } as const;
	await logSession(userId, 0, [
		{ ...anthem, minutes: 30 },
		{ kind: 'exercise', label: 'Spider walk', exercise_id: warmUp.id, minutes: 10 },
		{ kind: 'exercise', label: 'Three-string sweep', exercise_id: drill.id, minutes: 20 }
	]);
	await logSession(userId, 7, [{ ...anthem, minutes: 20 }]);
}

const reading = (page: Page, range: string, label: string) =>
	page
		.getByRole('region', { name: `Your ${range}` })
		.locator('dt', { hasText: label })
		.locator('+ dd');

test.describe('Practice log', () => {
	test('adds a week up and splits it by type', async ({ browser }) => {
		const user = await createSecondUser(browser);
		const { page } = user;
		try {
			await seed(user.user.id);
			await page.goto('/practice/log');

			const week = page.getByRole('region', { name: 'Your week' });
			await expect(week.getByRole('heading', { name: 'This week' })).toBeVisible();
			await expect(reading(page, 'week', 'Practiced')).toHaveText('1h 00m');
			await expect(reading(page, 'week', 'Days')).toContainText('1');
			// Held against last week up to the same weekday, not all of it
			await expect(week).toContainText('40m ahead of this point last week.');
			const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
			await expect(week.getByRole('img')).toHaveAttribute(
				'aria-label',
				new RegExp(`${today} 1h 00m`)
			);

			// A technique's drill is technique time; an exercise in the routine is a warm-up
			const types = page.getByRole('region', { name: 'By type' });
			const type = (name: string) => types.getByRole('button', { name: new RegExp(name) });
			await expect(type('Warm-ups')).toContainText('10m');
			await expect(type('Warm-ups')).toContainText('17%');
			await expect(type('Techniques')).toContainText('20m');
			await expect(type('Techniques')).toContainText('33%');
			await expect(type('Songs')).toContainText('30m');
			await expect(type('Songs')).toContainText('50%');

			const most = page.getByRole('region', { name: 'Most practiced' });
			await expect(most.getByRole('listitem').first()).toContainText('Logged Anthem');
			await expect(most.getByRole('listitem')).toHaveCount(3);

			// One type on its own, on the board and in everything under it
			const sessions = page.getByRole('region', { name: 'Sessions' });
			await type('Techniques').click();
			await expect(type('Techniques')).toHaveAttribute('aria-pressed', 'true');
			await expect(reading(page, 'week', 'Techniques')).toHaveText('20m');
			await expect(most.getByRole('listitem')).toHaveCount(1);
			await expect(most).toContainText('Three-string sweep');
			await expect(sessions).toContainText('Three-string sweep');
			await expect(sessions).not.toContainText('Logged Anthem');

			await types.getByRole('button', { name: 'All types' }).click();
			await expect(reading(page, 'week', 'Practiced')).toHaveText('1h 00m');
			await expect(sessions).toContainText('Logged Anthem');
		} finally {
			await user.cleanup();
		}
	});

	test('pages back, and opens out to the month and the year', async ({ browser }) => {
		const user = await createSecondUser(browser);
		const { page } = user;
		try {
			await seed(user.user.id);
			await page.goto('/practice/log');

			await page.getByRole('link', { name: 'The week before' }).click();
			const week = page.getByRole('region', { name: 'Your week' });
			await expect(week.getByRole('heading', { name: 'Last week' })).toBeVisible();
			await expect(reading(page, 'week', 'Practiced')).toHaveText('20m');
			// That's where the log starts, so there's nothing further back to page to
			await expect(page.getByRole('link', { name: 'The week before' })).toHaveCount(0);
			await page.getByRole('link', { name: 'The week after' }).click();
			await expect(week.getByRole('heading', { name: 'This week' })).toBeVisible();

			// The same two days, counted by where they fall in the month and the year
			const now = noon(0);
			const weekAgo = noon(7);
			const inMonth = weekAgo.getMonth() === now.getMonth() ? 80 : 60;
			const inYear = weekAgo.getFullYear() === now.getFullYear() ? 80 : 60;

			const ranges = page.getByRole('navigation', { name: 'Range' });
			await ranges.getByRole('link', { name: 'Month' }).click();
			const month = page.getByRole('region', { name: 'Your month' });
			const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
			await expect(month.getByRole('heading', { name: monthName })).toBeVisible();
			await expect(reading(page, 'month', 'Practiced')).toHaveText(time(inMonth));

			await ranges.getByRole('link', { name: 'Year' }).click();
			const year = page.getByRole('region', { name: 'Your year' });
			await expect(year.getByRole('heading', { name: String(now.getFullYear()) })).toBeVisible();
			await expect(reading(page, 'year', 'Practiced')).toHaveText(time(inYear));

			// A month's bar opens that month
			await year
				.getByRole('link', { name: `${monthName}, ${time(inMonth)}. Open the month.` })
				.click();
			await expect(month.getByRole('heading', { name: monthName })).toBeVisible();
		} finally {
			await user.cleanup();
		}
	});
});
