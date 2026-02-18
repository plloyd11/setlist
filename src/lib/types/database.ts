export interface Song {
	id: string;
	user_id: string;
	title: string;
	duration_seconds: number;
	notes: string | null;
	created_at: string;
}
