import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // mirrors the bucket file_size_limit
const MAX_LABEL_LENGTH = 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Extension is the real gate (Guitar Pro has no registered MIME type — the
// bucket allowlist has to admit application/octet-stream); mirror the client
// list in #lib/utils/chartUpload.js.
const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'gp', 'gp3', 'gp4', 'gp5', 'gpx']);
const ALLOWED_MIME_TYPES = new Set([
	'application/pdf',
	'application/msword',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'application/octet-stream'
]);

/**
 * Validate the metadata of a chart already in storage. Shared by song charts and
 * exercise charts: `ownerField` is the form field holding the parent's id, and
 * `folder` is its top-level storage folder.
 */
export function parseFileUpload(formData: FormData, ownerField: string, folder: string) {
	const ownerId = ((formData.get(ownerField) as string) ?? '').trim();
	const label = ((formData.get('label') as string) ?? '').trim();
	const storagePath = (formData.get('storage_path') as string) ?? '';
	const fileName = ((formData.get('file_name') as string) ?? '').trim();
	const mimeType = (formData.get('mime_type') as string) ?? '';
	const fileSize = Number(formData.get('file_size_bytes'));

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
	const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
	if (!ALLOWED_EXTENSIONS.has(ext)) {
		return { error: fail(400, { error: 'Unsupported file type' }) };
	}
	if (!ALLOWED_MIME_TYPES.has(mimeType)) {
		return { error: fail(400, { error: 'Unsupported file type' }) };
	}
	if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
		return { error: fail(400, { error: 'Invalid file size' }) };
	}

	return {
		ownerId,
		row: {
			label: label || null,
			storage_path: storagePath,
			file_name: fileName,
			mime_type: mimeType,
			file_size_bytes: fileSize
		}
	};
}

/**
 * Handler for the song chart/tab upload form action. The file is already in
 * storage (uploaded client-side, same flow as song audio); this validates the
 * metadata and records the song_files row. song_id comes from the form, but
 * RLS restricts the insert to the song's owner and a table CHECK ties
 * storage_path to song_id, so a forged value can only fail — never attach a
 * file to someone else's song.
 */
export async function processSongFileUpload(supabase: SupabaseClient, request: Request) {
	const parsed = parseFileUpload(await request.formData(), 'song_id', 'songs');
	if (parsed.error) return parsed.error;

	// .select() so an RLS-filtered no-op fails loudly instead of faking success
	const { data, error } = await supabase
		.from('song_files')
		.insert({ song_id: parsed.ownerId, ...parsed.row })
		.select('id')
		.single();

	if (error || !data) {
		return fail(500, { error: 'Failed to save file' });
	}

	return { fileId: data.id as string };
}

/**
 * Handler for the song chart/tab delete form actions (personal + band songs
 * pages). RLS restricts the delete to the song's owner; storage removal is
 * best-effort — a failure orphans the object (accepted tradeoff), it never
 * blocks the delete.
 */
export async function processSongFileDelete(supabase: SupabaseClient, request: Request) {
	const formData = await request.formData();
	const id = formData.get('id') as string;

	if (!id) {
		return fail(400, { error: 'File ID is required' });
	}

	// .select() so an RLS-filtered no-op is reported instead of faking success
	const { data: deletedRows, error } = await supabase
		.from('song_files')
		.delete()
		.eq('id', id)
		.select('id, storage_path');

	if (error || !deletedRows?.length) {
		return fail(error ? 500 : 404, { error: 'Failed to delete file' });
	}

	const { error: storageError } = await supabase.storage
		.from('song-files')
		.remove(deletedRows.map((r) => r.storage_path));
	if (storageError) {
		console.warn('song-files cleanup failed:', storageError.message);
	}

	return { deleted: true };
}
