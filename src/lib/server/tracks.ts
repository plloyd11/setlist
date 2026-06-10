import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // mirrors the bucket file_size_limit
const MAX_PEAKS = 4000;

/**
 * Shared handler for the track upload form actions. The audio file is already
 * in storage (uploaded client-side — Netlify's function body limit rules out
 * proxying 50MB files); this validates the metadata and records the version
 * row via the atomic create_track_version RPC.
 *
 * trackId null = create a new track (title required). Non-null trackId comes
 * from the detail page route param so a forged form can't target another
 * track; the RPC additionally verifies the track belongs to bandId.
 */
export async function processTrackUpload(
	supabase: SupabaseClient,
	request: Request,
	bandId: string,
	trackId: string | null
) {
	const formData = await request.formData();

	const title = ((formData.get('title') as string) ?? '').trim();
	const storagePath = (formData.get('storage_path') as string) ?? '';
	const fileName = ((formData.get('file_name') as string) ?? '').trim();
	const mimeType = (formData.get('mime_type') as string) ?? '';
	const fileSize = Number(formData.get('file_size_bytes'));
	const durationRaw = formData.get('duration_seconds') as string | null;
	const peaksRaw = formData.get('waveform_peaks') as string | null;

	if (!trackId && !title) {
		return fail(400, { error: 'Title is required' });
	}
	if (!storagePath.startsWith(`bands/${bandId}/tracks/`)) {
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

	const { data, error } = await supabase.rpc('create_track_version', {
		p_band_id: bandId,
		p_track_id: trackId,
		p_title: title || null,
		p_storage_path: storagePath,
		p_file_name: fileName,
		p_mime_type: mimeType,
		p_file_size_bytes: fileSize,
		p_duration_seconds: duration,
		p_waveform_peaks: peaks
	});

	const row = Array.isArray(data) ? data[0] : data;
	if (error || !row) {
		return fail(500, { error: 'Failed to save track' });
	}

	return { trackId: row.track_id as string, versionNumber: row.version_number as number };
}
