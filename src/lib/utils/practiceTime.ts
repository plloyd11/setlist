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
