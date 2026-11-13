/**
 * The practice log's periods and sums. Dates here are plain days (YYYY-MM-DD) where
 * the musician is: the server works out which day a session fell on, and everything
 * after that is arithmetic on days, so nothing shifts with a time zone.
 */

export const LOG_RANGES = ['week', 'month', 'year'] as const;
export type LogRange = (typeof LOG_RANGES)[number];

/** In the order a session heats up, which is also the order a bar stacks, bottom up */
export const LOG_KINDS = ['warm-up', 'technique', 'song'] as const;
export type LogKind = (typeof LOG_KINDS)[number];
export type KindSeconds = Record<LogKind, number>;

export const KIND_NAMES: Record<LogKind, string> = {
	'warm-up': 'Warm-ups',
	technique: 'Techniques',
	song: 'Songs'
};

export interface LogPeriod {
	range: LogRange;
	/** First and last day, both inside the period */
	start: string;
	end: string;
	/** Where the period before starts */
	previous: string;
	/** Where the one after starts. Null when this one holds today: there's no log of tomorrow. */
	next: string | null;
	isCurrent: boolean;
}

export interface LogDay {
	date: string;
	seconds: KindSeconds;
}

export interface LogItem {
	key: string;
	kind: LogKind;
	label: string;
	seconds: number;
	/** How many days of the period it was practiced on */
	days: number;
	href: string | null;
}

/** One period of practice, summed. What the log's board is drawn from. */
export interface LogSummary {
	period: LogPeriod;
	today: string;
	/** The days of the period with practice on them, oldest first */
	days: LogDay[];
	/** The period before, up to the same point in it, to hold this one against */
	previous: KindSeconds;
	/** Everything practiced in the period, most time first */
	items: LogItem[];
	/** The day of the first session ever logged. Null means there's no log yet. */
	earliest: string | null;
	/** How many sessions the period holds, which can be more than are listed */
	sessionCount: number;
}

export interface LogBucket {
	/** A day (YYYY-MM-DD), or a month (YYYY-MM) in a year */
	key: string;
	/** The bucket's first day */
	date: string;
	seconds: KindSeconds;
	isToday: boolean;
	isFuture: boolean;
}

const DAY_MS = 86_400_000;

export const noSeconds = (): KindSeconds => ({ 'warm-up': 0, technique: 0, song: 0 });

/** All of it, or one kind's share */
export const secondsOf = (seconds: KindSeconds, kind: LogKind | null): number =>
	kind ? seconds[kind] : seconds['warm-up'] + seconds.technique + seconds.song;

/** A plain day as a UTC instant. For arithmetic and for formatting with `timeZone: 'UTC'`. */
export function logDate(date: string): Date {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d));
}

const dayOf = (y: number, m: number, d: number) =>
	new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

export const addDays = (date: string, days: number): string =>
	new Date(logDate(date).getTime() + days * DAY_MS).toISOString().slice(0, 10);

export const daysBetween = (from: string, to: string): number =>
	Math.round((logDate(to).getTime() - logDate(from).getTime()) / DAY_MS);

/** A real day, written the way this module writes them */
export function isLogDate(value: string | null | undefined): value is string {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	const time = logDate(value).getTime();
	return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

export const isLogRange = (value: string | null | undefined): value is LogRange =>
	LOG_RANGES.includes(value as LogRange);

/** The week (Monday first), month or year holding a day. A day after today counts as today. */
export function periodOf(range: LogRange, at: string, today: string): LogPeriod {
	const anchor = at > today ? today : at;
	const date = logDate(anchor);
	const y = date.getUTCFullYear();
	const m = date.getUTCMonth();

	let start: string, end: string, previous: string, next: string;
	if (range === 'week') {
		start = addDays(anchor, -((date.getUTCDay() + 6) % 7));
		end = addDays(start, 6);
		previous = addDays(start, -7);
		next = addDays(start, 7);
	} else if (range === 'month') {
		start = dayOf(y, m, 1);
		end = dayOf(y, m + 1, 0);
		previous = dayOf(y, m - 1, 1);
		next = dayOf(y, m + 1, 1);
	} else {
		start = dayOf(y, 0, 1);
		end = dayOf(y, 11, 31);
		previous = dayOf(y - 1, 0, 1);
		next = dayOf(y + 1, 0, 1);
	}
	const isCurrent = today <= end;
	return { range, start, end, previous, next: isCurrent ? null : next, isCurrent };
}

/**
 * The last day of the period before that's fair to compare with. A week that's only
 * reached Wednesday is held against last week's Wednesday, not all of last week.
 */
export function comparedThrough(period: LogPeriod, today: string): string {
	const lastDay = addDays(period.start, -1);
	if (!period.isCurrent) return lastDay;
	const samePoint = addDays(period.previous, daysBetween(period.start, today));
	return samePoint < lastDay ? samePoint : lastDay;
}

/** Days gone by in the period: all of them once it's over, up to today while it's running */
export function daysElapsed(period: LogPeriod, today: string): number {
	return daysBetween(period.start, period.isCurrent ? today : period.end) + 1;
}

/** Every bar the chart draws, practiced or not: days of a week or month, months of a year */
export function bucketsOf(period: LogPeriod, days: LogDay[], today: string): LogBucket[] {
	const byMonth = period.range === 'year';
	const keyOf = (date: string) => (byMonth ? date.slice(0, 7) : date);

	const totals = new Map<string, KindSeconds>();
	for (const day of days) {
		const sum = totals.get(keyOf(day.date)) ?? noSeconds();
		for (const kind of LOG_KINDS) sum[kind] += day.seconds[kind];
		totals.set(keyOf(day.date), sum);
	}

	const firstDays = byMonth
		? Array.from({ length: 12 }, (_, month) => dayOf(Number(period.start.slice(0, 4)), month, 1))
		: Array.from({ length: daysBetween(period.start, period.end) + 1 }, (_, i) =>
				addDays(period.start, i)
			);
	return firstDays.map((date) => ({
		key: keyOf(date),
		date,
		seconds: totals.get(keyOf(date)) ?? noSeconds(),
		isToday: keyOf(date) === keyOf(today),
		isFuture: date > today
	}));
}

const AXIS_STEPS = [60, 120, 300, 600, 900, 1800, 3600, 7200, 10_800, 14_400, 21_600, 43_200];

/** Round gridlines for a time axis: at most three, on steps a musician would say out loud */
export function timeAxis(maxSeconds: number): { top: number; ticks: number[] } {
	if (maxSeconds <= 0) return { top: 3600, ticks: [1800, 3600] };
	let step = AXIS_STEPS.find((s) => maxSeconds / s <= 3);
	if (!step) {
		step = 86_400;
		while (maxSeconds / step > 3) step *= 2;
	}
	const count = Math.max(1, Math.ceil(maxSeconds / step));
	const ticks = Array.from({ length: count }, (_, i) => (i + 1) * step);
	return { top: count * step, ticks };
}

/** An axis label: "30m", "1h", "1h 30m". Hours stay hours however many there are. */
export function formatAxisTime(seconds: number): string {
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const rest = minutes % 60;
	return rest === 0 ? `${minutes / 60}h` : `${Math.floor(minutes / 60)}h ${rest}m`;
}

const format = (date: string, options: Intl.DateTimeFormatOptions) =>
	logDate(date).toLocaleDateString(undefined, { ...options, timeZone: 'UTC' });

/** "Nov 9 – 15", "Oct 27 – Nov 2", with the year once it isn't this one */
function dayRange(start: string, end: string, today: string): string {
	const year = start.slice(0, 4) === today.slice(0, 4) ? {} : ({ year: 'numeric' } as const);
	const from = format(start, { month: 'short', day: 'numeric' });
	const to =
		start.slice(0, 7) === end.slice(0, 7)
			? format(end, { day: 'numeric' })
			: format(end, { month: 'short', day: 'numeric' });
	const yearText = 'year' in year ? `, ${end.slice(0, 4)}` : '';
	return `${from} – ${to}${yearText}`;
}

/** What the period is called, and the dates behind a name like "This week" */
export function periodTitle(
	period: LogPeriod,
	today: string
): { title: string; detail: string | null } {
	if (period.range === 'year') return { title: period.start.slice(0, 4), detail: null };
	if (period.range === 'month') {
		return { title: format(period.start, { month: 'long', year: 'numeric' }), detail: null };
	}
	const dates = dayRange(period.start, period.end, today);
	if (period.isCurrent) return { title: 'This week', detail: dates };
	if (addDays(period.start, 7) === periodOf('week', today, today).start) {
		return { title: 'Last week', detail: dates };
	}
	return { title: dates, detail: null };
}

/** A bucket's label under the axis, and its full name for the readout and screen readers */
export function bucketLabels(range: LogRange, bucket: LogBucket): { axis: string; name: string } {
	if (range === 'year') {
		return {
			axis: format(bucket.date, { month: 'short' }),
			name: format(bucket.date, { month: 'long', year: 'numeric' })
		};
	}
	if (range === 'month') {
		return {
			axis: String(Number(bucket.date.slice(8))),
			name: format(bucket.date, { weekday: 'short', month: 'short', day: 'numeric' })
		};
	}
	return {
		axis: format(bucket.date, { weekday: 'short' }),
		name: format(bucket.date, { weekday: 'long' })
	};
}

/** A day, short: "Tue" inside a week, "Nov 12" anywhere longer */
export function shortDay(range: LogRange, date: string): string {
	return range === 'week'
		? format(date, { weekday: 'short' })
		: format(date, { month: 'short', day: 'numeric' });
}

export const logHref = (range: LogRange, at?: string): string =>
	`/practice/log?range=${range}${at ? `&at=${at}` : ''}`;
