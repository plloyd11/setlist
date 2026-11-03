import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { SongAudio, SongFile } from '#lib/types/database.js';
import type {
	RehearseChart,
	RehearseSourceRow,
	RehearseVariant
} from '#lib/components/rehearse/rehearseState.svelte.js';
import { signAll } from '#lib/server/songMedia.js';

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
	let files: SongFile[] = [];
	if (songIds.length > 0) {
		const { data: fileRows } = await supabase
			.from('song_files')
			.select('*')
			.in('song_id', songIds)
			.order('created_at', { ascending: true });
		files = (fileRows ?? []) as SongFile[];

		const { data } = await supabase
			.from('song_audio')
			.select(
				'id, song_id, label, storage_path, file_name, mime_type, file_size_bytes, duration_seconds, created_at'
			)
			.in('song_id', songIds)
			.order('created_at', { ascending: true });
		audio = (data ?? []) as Omit<SongAudio, 'waveform_peaks'>[];
	}

	const [urlByPath, chartUrlByPath] = await Promise.all([
		signAll(
			supabase,
			'song-audio',
			audio.map((v) => v.storage_path)
		),
		signAll(
			supabase,
			'song-files',
			files.map((f) => f.storage_path)
		)
	]);

	const variantsBySong: Record<string, RehearseVariant[]> = {};
	for (const v of audio) {
		(variantsBySong[v.song_id] ??= []).push({
			...v,
			signedUrl: urlByPath.get(v.storage_path) ?? null
		});
	}

	const chartsBySong: Record<string, RehearseChart[]> = {};
	for (const f of files) {
		(chartsBySong[f.song_id] ??= []).push({
			...f,
			signedUrl: chartUrlByPath.get(f.storage_path) ?? null
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
			variants: row.song_id ? (variantsBySong[row.song_id] ?? []) : [],
			charts: row.song_id ? (chartsBySong[row.song_id] ?? []) : []
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
