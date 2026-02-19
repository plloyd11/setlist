export interface Song {
	id: string;
	user_id: string;
	title: string;
	duration_seconds: number;
	notes: string | null;
	created_at: string;
}

export interface Profile {
	id: string;
	display_name: string | null;
	logo_url: string | null;
	created_at: string;
	updated_at: string;
}

export interface Setlist {
	id: string;
	user_id: string;
	name: string;
	gig_date: string | null;
	venue: string | null;
	target_seconds: number | null;
	transition_seconds: number;
	share_token: string | null;
	created_at: string;
	updated_at: string;
}

export interface SetlistSong {
	id: string;
	setlist_id: string;
	song_id: string;
	position: number;
	created_at: string;
}
