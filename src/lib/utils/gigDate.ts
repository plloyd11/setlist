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

/** Whole days from today: 0 is today, negative is past */
export function daysUntil(date: string): number {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return Math.round((parseGigDate(date).getTime() - today.getTime()) / 86_400_000);
}
