import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { SongAudio } from '$lib/types/database';
import type {
	RehearseSourceRow,
	RehearseVariant
} from '$lib/components/rehearse/rehearseState.svelte';

// 6h — outlives any realistic rehearsal session; WaveformPlayer's onloaderror
// path covers the rare mid-session expiry.
const SIGNED_URL_TTL = 21600;

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// No user_id/band_id filter: RLS authorizes the owner and band members
	// (via user_band_ids()), so this one route serves both setlist flavors.
	const [{ data: setlist }, { data: setlistSongs }] = await Promise.all([
		supabase.from('setlists').select('*').eq('id', params.id).single(),
		supabase
			.from('setlist_songs')
			.select(
				'id, position, song_id, gap_seconds, gap_label, songs(id, title, duration_seconds, notes)'
			)
			.eq('setlist_id', params.id)
			.order('position')
	]);

	if (!setlist) {
		throw error(404, 'Setlist not found');
	}

	const rows = setlistSongs ?? [];
	const songIds = [...new Set(rows.map((r) => r.song_id).filter((id): id is string => !!id))];

	// RLS filters to songs the caller can see (own + band-linked). Peaks are
	// excluded — at ~10KB per variant they'd dominate the payload; the page
	// fetches them lazily per variant from ./rehearse/peaks/[audioId].
	let audio: Omit<SongAudio, 'waveform_peaks'>[] = [];
	if (songIds.length > 0) {
		const { data } = await supabase
			.from('song_audio')
			.select(
				'id, song_id, label, storage_path, file_name, mime_type, file_size_bytes, duration_seconds, created_at'
			)
			.in('song_id', songIds)
			.order('created_at', { ascending: true });
		audio = (data ?? []) as Omit<SongAudio, 'waveform_peaks'>[];
	}

	// One round-trip signs every variant; per-path failures (deleted object,
	// revoked access) come back as null and render as unavailable.
	const urlByPath = new Map<string, string | null>();
	if (audio.length > 0) {
		const { data: signed } = await supabase.storage.from('song-audio').createSignedUrls(
			audio.map((v) => v.storage_path),
			SIGNED_URL_TTL
		);
		for (const entry of signed ?? []) {
			if (entry.path) urlByPath.set(entry.path, entry.error ? null : entry.signedUrl);
		}
	}

	const variantsBySong: Record<string, RehearseVariant[]> = {};
	for (const v of audio) {
		(variantsBySong[v.song_id] ??= []).push({
			...v,
			signedUrl: urlByPath.get(v.storage_path) ?? null
		});
	}

	const sourceRows: RehearseSourceRow[] = rows.map((row) => {
		// supabase-js types the many-to-one join as an array; at runtime it's an object
		const song = row.songs as unknown as {
			id: string;
			title: string;
			duration_seconds: number;
			notes: string | null;
		} | null;
		return {
			id: row.id,
			song_id: row.song_id,
			gap_seconds: row.gap_seconds,
			gap_label: row.gap_label,
			song,
			variants: row.song_id ? (variantsBySong[row.song_id] ?? []) : []
		};
	});

	return {
		setlist,
		rows: sourceRows,
		backHref: setlist.band_id
			? `/bands/${setlist.band_id}/setlists/${setlist.id}`
			: `/setlists/${setlist.id}`
	};
};
