import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // mirrors the bucket file_size_limit
const MAX_PEAKS = 4000;
const MAX_LABEL_LENGTH = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Handler for the song audio upload form action. The audio file is already
 * in storage (uploaded client-side — Netlify's function body limit rules out
 * proxying 50MB files); this validates the metadata and records the
 * song_audio row. song_id comes from the form, but RLS restricts the insert
 * to the song's owner and a table CHECK ties storage_path to song_id, so a
 * forged value can only fail — never attach audio to someone else's song.
 */
export async function processSongAudioUpload(supabase: SupabaseClient, request: Request) {
	const formData = await request.formData();

	const songId = ((formData.get('song_id') as string) ?? '').trim();
	const label = ((formData.get('label') as string) ?? '').trim();
	const storagePath = (formData.get('storage_path') as string) ?? '';
	const fileName = ((formData.get('file_name') as string) ?? '').trim();
	const mimeType = (formData.get('mime_type') as string) ?? '';
	const fileSize = Number(formData.get('file_size_bytes'));
	const durationRaw = formData.get('duration_seconds') as string | null;
	const peaksRaw = formData.get('waveform_peaks') as string | null;

	if (!UUID_RE.test(songId)) {
		return fail(400, { error: 'Invalid song' });
	}
	if (label.length > MAX_LABEL_LENGTH) {
		return fail(400, { error: `Label must be ${MAX_LABEL_LENGTH} characters or fewer` });
	}
	if (!storagePath.startsWith(`songs/${songId}/`)) {
		return fail(400, { error: 'Invalid storage path' });
	}
	if (!fileName) {
		return fail(400, { error: 'File name is required' });
	}
	if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
		return fail(400, { error: 'Invalid file size' });
	}

	let duration: number | null = null;
	if (durationRaw) {
		const parsed = Number(durationRaw);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			return fail(400, { error: 'Invalid duration' });
		}
		duration = parsed;
	}

	let peaks: number[] | null = null;
	if (peaksRaw) {
		try {
			const parsed = JSON.parse(peaksRaw);
			if (
				!Array.isArray(parsed) ||
				parsed.length > MAX_PEAKS ||
				parsed.some((p) => typeof p !== 'number' || !Number.isFinite(p))
			) {
				return fail(400, { error: 'Invalid waveform data' });
			}
			peaks = parsed;
		} catch {
			return fail(400, { error: 'Invalid waveform data' });
		}
	}

	// .select() so an RLS-filtered no-op fails loudly instead of faking success
	const { data, error } = await supabase
		.from('song_audio')
		.insert({
			song_id: songId,
			label: label || null,
			storage_path: storagePath,
			file_name: fileName,
			mime_type: mimeType,
			file_size_bytes: fileSize,
			duration_seconds: duration,
			waveform_peaks: peaks
		})
		.select('id')
		.single();

	if (error || !data) {
		return fail(500, { error: 'Failed to save audio' });
	}

	return { audioId: data.id as string };
}

/**
 * Handler for the song audio delete form actions (personal + band songs
 * pages). RLS restricts the delete to the song's owner; storage removal is
 * best-effort — a failure orphans the object (accepted tradeoff), it never
 * blocks the delete.
 */
export async function processSongAudioDelete(supabase: SupabaseClient, request: Request) {
	const formData = await request.formData();
	const id = formData.get('id') as string;

	if (!id) {
		return fail(400, { error: 'Audio ID is required' });
	}

	// .select() so an RLS-filtered no-op is reported instead of faking success
	const { data: deletedRows, error } = await supabase
		.from('song_audio')
		.delete()
		.eq('id', id)
		.select('id, storage_path');

	if (error || !deletedRows?.length) {
		return fail(error ? 500 : 404, { error: 'Failed to delete audio' });
	}

	const { error: storageError } = await supabase.storage
		.from('song-audio')
		.remove(deletedRows.map((r) => r.storage_path));
	if (storageError) {
		console.warn('song-audio cleanup failed:', storageError.message);
	}

	return { deleted: true };
}
