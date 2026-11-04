/** gig_date is a plain date: parse it as local midnight so it can't shift by a day */
export function parseGigDate(date: string): Date {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(y, m - 1, d);
}

export function formatGigDate(date: string): string {
	return parseGigDate(date).toLocaleDateString(undefined, {
		weekday: 'short',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Whole days from today: 0 is today, negative is past. Pass `today` when the device's
 * clock isn't the one that counts, as on a server.
 */
export function daysUntil(date: string, today?: string): number {
	const from = today ? parseGigDate(today) : new Date();
	from.setHours(0, 0, 0, 0);
	return Math.round((parseGigDate(date).getTime() - from.getTime()) / 86_400_000);
}

export function gigCountdown(date: string, today?: string): string {
	const days = daysUntil(date, today);
	if (days <= 0) return 'Tonight';
	return days === 1 ? 'Tomorrow' : `In ${days} days`;
}

/** Holds the musician's time zone, so a server can tell what day it is for them */
export const TIME_ZONE_COOKIE = 'tz';

export function isTimeZone(zone: string | null | undefined): zone is string {
	if (!zone) return false;
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: zone });
		return true;
	} catch {
		return false;
	}
}

/**
 * Today as gig dates are written (YYYY-MM-DD), in a time zone or else this machine's.
 * Servers run on UTC, which is already tomorrow by the evening of a gig in the US.
 */
export function todayInZone(zone?: string | null, now = new Date()): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: zone ?? undefined,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);
	const part = (type: string) => parts.find((p) => p.type === type)?.value;
	return `${part('year')}-${part('month')}-${part('day')}`;
}
