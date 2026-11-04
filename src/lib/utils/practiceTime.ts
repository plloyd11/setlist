/** Practice time, which runs longer than a song: "45s", "12m", "1h 05m" */
export function formatPracticeTime(totalSeconds: number): string {
	const seconds = Math.round(totalSeconds);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** Mon-based start of the week containing a date, at local midnight */
export function startOfWeek(date: Date): Date {
	const start = new Date(date);
	start.setHours(0, 0, 0, 0);
	start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
	return start;
}

export interface WeekDay {
	key: string;
	name: string;
	initial: string;
	seconds: number;
	isToday: boolean;
}

/** Monday to Sunday of the week containing `now`, with the time practiced on each day */
export function weekOf(sessions: { startedAt: string; seconds: number }[], now: Date): WeekDay[] {
	const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
	const start = startOfWeek(now);
	const seconds = new Map<string, number>();
	for (const session of sessions) {
		const key = dayKey(new Date(session.startedAt));
		seconds.set(key, (seconds.get(key) ?? 0) + session.seconds);
	}
	return Array.from({ length: 7 }, (_, i) => {
		const date = new Date(start);
		date.setDate(start.getDate() + i);
		const key = dayKey(date);
		return {
			key,
			name: date.toLocaleDateString(undefined, { weekday: 'long' }),
			initial: date.toLocaleDateString(undefined, { weekday: 'narrow' }),
			seconds: seconds.get(key) ?? 0,
			isToday: key === dayKey(now)
		};
	});
}
