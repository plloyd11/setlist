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
	band_id: string | null;
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

export interface Band {
	id: string;
	name: string;
	owner_id: string;
	logo_url: string | null;
	created_at: string;
	updated_at: string;
}

export interface BandMember {
	id: string;
	band_id: string;
	user_id: string;
	role: 'owner' | 'member';
	joined_at: string;
}

export interface BandSong {
	id: string;
	band_id: string;
	song_id: string;
	added_by: string | null;
	added_at: string;
}

export interface BandInvite {
	id: string;
	band_id: string;
	token: string;
	created_by: string | null;
	used_by: string | null;
	used_at: string | null;
	created_at: string;
	expires_at: string;
}
