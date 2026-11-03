import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // mirrors the bucket file_size_limit
const MAX_PEAKS = 4000;
const MAX_LABEL_LENGTH = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate the metadata of an audio file already in storage. Shared by song audio and
 * exercise audio: `ownerField` is the form field holding the parent's id, and `folder`
 * is its top-level storage folder.
 */
export function parseAudioUpload(formData: FormData, ownerField: string, folder: string) {
	const ownerId = ((formData.get(ownerField) as string) ?? '').trim();
	const label = ((formData.get('label') as string) ?? '').trim();
	const storagePath = (formData.get('storage_path') as string) ?? '';
	const fileName = ((formData.get('file_name') as string) ?? '').trim();
	const mimeType = (formData.get('mime_type') as string) ?? '';
	const fileSize = Number(formData.get('file_size_bytes'));
	const durationRaw = formData.get('duration_seconds') as string | null;
	const peaksRaw = formData.get('waveform_peaks') as string | null;

	if (!UUID_RE.test(ownerId)) {
		return { error: fail(400, { error: 'Invalid song' }) };
	}
	if (label.length > MAX_LABEL_LENGTH) {
		return { error: fail(400, { error: `Label must be ${MAX_LABEL_LENGTH} characters or fewer` }) };
	}
	if (!storagePath.startsWith(`${folder}/${ownerId}/`)) {
		return { error: fail(400, { error: 'Invalid storage path' }) };
	}
	if (!fileName) {
		return { error: fail(400, { error: 'File name is required' }) };
	}
	if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
		return { error: fail(400, { error: 'Invalid file size' }) };
	}

	let duration: number | null = null;
	if (durationRaw) {
		const parsed = Number(durationRaw);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			return { error: fail(400, { error: 'Invalid duration' }) };
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
				return { error: fail(400, { error: 'Invalid waveform data' }) };
			}
			peaks = parsed;
		} catch {
			return { error: fail(400, { error: 'Invalid waveform data' }) };
		}
	}

	return {
		ownerId,
		row: {
			label: label || null,
			storage_path: storagePath,
			file_name: fileName,
			mime_type: mimeType,
			file_size_bytes: fileSize,
			duration_seconds: duration,
			waveform_peaks: peaks
		}
	};
}

/**
 * Handler for the song audio upload form action. The audio file is already
 * in storage (uploaded client-side — Netlify's function body limit rules out
 * proxying 50MB files); this validates the metadata and records the
 * song_audio row. song_id comes from the form, but RLS restricts the insert
 * to the song's owner and a table CHECK ties storage_path to song_id, so a
 * forged value can only fail — never attach audio to someone else's song.
 */
export async function processSongAudioUpload(supabase: SupabaseClient, request: Request) {
	const parsed = parseAudioUpload(await request.formData(), 'song_id', 'songs');
	if (parsed.error) return parsed.error;

	// .select() so an RLS-filtered no-op fails loudly instead of faking success
	const { data, error } = await supabase
		.from('song_audio')
		.insert({ song_id: parsed.ownerId, ...parsed.row })
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
