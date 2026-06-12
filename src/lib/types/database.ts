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

/**
 * Styling for the printable sheet, stored as JSONB on setlists.
 * Keys are snake_case because the value round-trips through the
 * get_shared_setlist RPC untransformed. Null column = app defaults
 * (see DEFAULT_PRINT_SETTINGS in $lib/utils/printSettings).
 */
export interface PrintSettings {
	font_family: 'display' | 'sans' | 'serif' | 'mono';
	font_size: number;
	line_spacing: number;
	text_align: 'left' | 'center';
	show_title: boolean;
	show_venue_date: boolean;
	show_notes: boolean;
	show_numbers: boolean;
	show_logo: boolean;
	show_dividers: boolean;
	logo_size: 'sm' | 'md' | 'lg';
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
	print_settings: PrintSettings | null;
	created_at: string;
	updated_at: string;
}

export interface SetlistSong {
	id: string;
	setlist_id: string;
	song_id: string | null;
	gap_seconds: number | null;
	gap_label: string | null;
	position: number;
	created_at: string;
}

export interface Band {
	id: string;
	name: string;
	owner_id: string;
	logo_url: string | null;
	// Dark variant for light backgrounds (print sheet, share page); null = use logo_url
	logo_dark_url: string | null;
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

/**
 * A rehearsal audio variant attached to a library song — e.g. "Full mix",
 * "No guitar". Visibility mirrors the song's (owner + band members when the
 * song is band-linked); only the owner uploads/manages.
 */
export interface SongAudio {
	id: string;
	song_id: string;
	label: string | null;
	storage_path: string;
	file_name: string;
	mime_type: string;
	file_size_bytes: number;
	duration_seconds: number | null;
	waveform_peaks: number[] | null;
	created_at: string;
}

/**
 * A chart/tab document attached to a library song — PDF, Word, or Guitar Pro.
 * Visibility mirrors the song's (owner + band members when the song is
 * band-linked); only the owner uploads/manages.
 */
export interface SongFile {
	id: string;
	song_id: string;
	label: string | null;
	storage_path: string;
	file_name: string;
	mime_type: string;
	file_size_bytes: number;
	created_at: string;
}

export interface Track {
	id: string;
	band_id: string;
	folder_id: string | null;
	title: string;
	description: string | null;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

export interface TrackFolder {
	id: string;
	band_id: string;
	parent_id: string | null;
	name: string;
	created_by: string | null;
	created_at: string;
	updated_at: string;
}

export interface TrackVersion {
	id: string;
	track_id: string;
	version_number: number;
	storage_path: string;
	file_name: string;
	mime_type: string;
	file_size_bytes: number;
	duration_seconds: number | null;
	waveform_peaks: number[] | null;
	uploaded_by: string | null;
	created_at: string;
}

export interface TrackComment {
	id: string;
	version_id: string;
	parent_id: string | null;
	author_id: string | null;
	body: string;
	timestamp_seconds: number | null;
	resolved_at: string | null;
	resolved_by: string | null;
	created_at: string;
}
