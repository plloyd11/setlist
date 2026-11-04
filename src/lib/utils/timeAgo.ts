/** How long ago something happened, short enough for a row: "just now", "2h ago", "3d ago", "Oct 3" */
export function timeAgo(iso: string, now = new Date()): string {
	const date = new Date(iso);
	const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
	if (minutes < 1) return 'just now';
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
