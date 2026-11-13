import type { SupabaseClient } from '@supabase/supabase-js';
import { isLogged } from '#lib/utils/practiceTime.js';
import {
	addDays,
	comparedThrough,
	noSeconds,
	periodOf,
	type KindSeconds,
	type LogItem,
	type LogKind,
	type LogRange,
	type LogSummary
} from '#lib/utils/practiceLog.js';

/** Supabase hands back at most this many rows a request */
const PAGE_SIZE = 1000;
/** Far more sessions than two years of practice. Stops a runaway loop, nothing else. */
const MAX_PAGES = 20;
/** A week or a month lists every session. A year lists its latest: months hold the rest. */
const SESSIONS_SHOWN: Record<LogRange, number> = { week: 200, month: 200, year: 30 };

interface ItemRow {
	id: string;
	kind: 'song' | 'exercise' | 'skill';
	label: string;
	practice_seconds: number;
	run_seconds: number | null;
	song_id: string | null;
	exercise_id: string | null;
	skill_id: string | null;
	// supabase-js types a many-to-one join as an array; at runtime it's an object
	exercises: { skill_id: string | null; routine_position: number | null } | null;
}

interface SessionRow {
	id: string;
	started_at: string;
	practice_session_items: ItemRow[];
}

export type LogSessionItem = Omit<ItemRow, 'exercises'> & { type: LogKind };

export interface PracticeLog extends LogSummary {
	sessions: { id: string; startedAt: string; items: LogSessionItem[] }[];
}

/**
 * Warm-up, technique or song. An exercise is a warm-up while it's in the routine;
 * out of it, a technique's drill counts toward technique. Judged as things stand now.
 */
function typeOf(item: ItemRow): LogKind {
	if (item.kind === 'song') return 'song';
	if (item.kind === 'skill') return 'technique';
	const exercise = item.exercises;
	return exercise?.skill_id && exercise.routine_position === null ? 'technique' : 'warm-up';
}

function hrefOf(item: ItemRow): string | null {
	if (item.song_id) return `/songs/${item.song_id}/practice?from=/practice/log`;
	if (item.exercise_id) return `/exercises/${item.exercise_id}?from=/practice/log`;
	if (item.skill_id) return `/practice/techniques/${item.skill_id}`;
	return null;
}

/** Which day an instant falls on in a zone, or on this machine's clock without one */
function dayFinder(timeZone: string | null): (iso: string) => string {
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: timeZone ?? undefined,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	});
	return (iso) => {
		const parts = formatter.formatToParts(new Date(iso));
		const part = (type: string) => parts.find((p) => p.type === type)?.value;
		return `${part('year')}-${part('month')}-${part('day')}`;
	};
}

async function sessionsBetween(
	supabase: SupabaseClient,
	from: string,
	to: string
): Promise<SessionRow[] | null> {
	const rows: SessionRow[] = [];
	for (let page = 0; page < MAX_PAGES; page++) {
		const { data, error } = await supabase
			.from('practice_sessions')
			.select(
				'id, started_at, practice_session_items(id, kind, label, practice_seconds, run_seconds, song_id, exercise_id, skill_id, exercises(skill_id, routine_position))'
			)
			.gte('started_at', from)
			.lt('started_at', to)
			.order('started_at', { ascending: false })
			.order('id')
			.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
		if (error) return null;
		rows.push(...((data ?? []) as unknown as SessionRow[]));
		if ((data ?? []).length < PAGE_SIZE) break;
	}
	return rows;
}

/**
 * One period of the caller's practice, summed by day and by kind. RLS keeps it to
 * their own. Null if it couldn't be read.
 */
export async function loadPracticeLog(
	supabase: SupabaseClient,
	options: { range: LogRange; at: string | null; today: string; timeZone: string | null }
): Promise<PracticeLog | null> {
	const { range, today, timeZone } = options;
	const period = periodOf(range, options.at ?? today, today);
	const compareUntil = comparedThrough(period, today);
	const dayIn = dayFinder(timeZone);

	// A session's day depends on the zone, and no zone is more than a day from UTC.
	// So read a day wide on each side, and let each session's own day decide.
	const [rows, { data: first, error: firstError }] = await Promise.all([
		sessionsBetween(
			supabase,
			`${addDays(period.previous, -1)}T00:00:00Z`,
			`${addDays(period.end, 2)}T00:00:00Z`
		),
		supabase.from('practice_sessions').select('started_at').order('started_at').limit(1)
	]);
	if (!rows || firstError) return null;

	const days = new Map<string, KindSeconds>();
	const previous = noSeconds();
	const items = new Map<string, LogItem & { on: Set<string> }>();
	const sessions: PracticeLog['sessions'] = [];
	let sessionCount = 0;

	// Newest first, so an item renamed since keeps its latest name
	for (const row of rows) {
		const date = dayIn(row.started_at);
		// Anything under a minute from before that stopped being logged stays out of sight
		const logged = row.practice_session_items.filter(isLogged);
		if (logged.length === 0) continue;

		if (date >= period.previous && date <= compareUntil) {
			for (const item of logged) previous[typeOf(item)] += item.practice_seconds;
		}
		if (date < period.start || date > period.end) continue;

		const day = days.get(date) ?? noSeconds();
		days.set(date, day);
		for (const item of logged) {
			const kind = typeOf(item);
			day[kind] += item.practice_seconds;

			const ref = item.song_id ?? item.exercise_id ?? item.skill_id;
			const key = `${kind}:${ref ?? item.label.toLowerCase()}`;
			const entry = items.get(key) ?? {
				key,
				kind,
				label: item.label,
				seconds: 0,
				days: 0,
				href: hrefOf(item),
				on: new Set<string>()
			};
			entry.seconds += item.practice_seconds;
			entry.on.add(date);
			items.set(key, entry);
		}

		sessionCount++;
		if (sessions.length < SESSIONS_SHOWN[range]) {
			sessions.push({
				id: row.id,
				startedAt: row.started_at,
				items: logged.map((item) => {
					// The join decided the type: the page has no use for it after that
					const { exercises: _join, ...rest } = item;
					return { ...rest, type: typeOf(item) };
				})
			});
		}
	}

	return {
		period,
		today,
		days: [...days.entries()]
			.map(([date, seconds]) => ({ date, seconds }))
			.sort((a, b) => a.date.localeCompare(b.date)),
		previous,
		items: [...items.values()]
			.map(({ on, ...item }) => ({ ...item, days: on.size }))
			.sort((a, b) => b.seconds - a.seconds || a.label.localeCompare(b.label)),
		earliest: first?.[0] ? dayIn(first[0].started_at as string) : null,
		sessions,
		sessionCount
	};
}
