import { fail } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { parseAudioUpload } from './songAudio.js';
import { parseFileUpload } from './songFiles.js';

const BUCKET = 'exercise-files';
const MAX_TITLE_LENGTH = 120;
const MAX_NOTES_LENGTH = 4000;
const MAX_MINUTES = 240;

/** Validate an exercise's editable fields. Minutes accepts halves, as in "1.5". */
export function parseExerciseFields(formData: FormData) {
	const title = ((formData.get('title') as string) ?? '').trim();
	const notes = ((formData.get('notes') as string) ?? '').trim();
	const minutes = Number(formData.get('minutes'));

	if (!title) return { error: fail(400, { error: 'Give it a name' }) };
	if (title.length > MAX_TITLE_LENGTH) {
		return { error: fail(400, { error: `Name must be ${MAX_TITLE_LENGTH} characters or fewer` }) };
	}
	if (notes.length > MAX_NOTES_LENGTH) {
		return { error: fail(400, { error: 'Notes are too long' }) };
	}
	if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_MINUTES) {
		return { error: fail(400, { error: `Minutes must be between 0 and ${MAX_MINUTES}` }) };
	}
	return { title, notes: notes || null, target_seconds: Math.round(minutes * 60) };
}

/** The next free slot at the end of the warm-up routine */
export async function nextRoutinePosition(supabase: SupabaseClient): Promise<number> {
	const { data } = await supabase
		.from('exercises')
		.select('routine_position')
		.not('routine_position', 'is', null)
		.order('routine_position', { ascending: false })
		.limit(1);
	return (data?.[0]?.routine_position ?? -1) + 1;
}

/** Deleting rows doesn't remove files, so clear them out. Best effort: a failure only
 * orphans a private object, and never blocks the delete. */
async function removeStored(supabase: SupabaseClient, paths: string[]) {
	if (paths.length === 0) return;
	const { error } = await supabase.storage.from(BUCKET).remove(paths);
	if (error) console.warn('exercise-files cleanup failed:', error.message);
}

export async function deleteExercise(supabase: SupabaseClient, id: string) {
	// RLS hides other people's exercises, so finding the row proves it's ours
	const { data: owned } = await supabase.from('exercises').select('id').eq('id', id).maybeSingle();
	if (!owned) return false;

	const [{ data: audio }, { data: files }] = await Promise.all([
		supabase.from('exercise_audio').select('storage_path').eq('exercise_id', id),
		supabase.from('exercise_files').select('storage_path').eq('exercise_id', id)
	]);
	// Files first: the bucket's delete policy looks up the exercise row, so once the
	// row is gone the same call quietly removes nothing
	await removeStored(
		supabase,
		[...(audio ?? []), ...(files ?? [])].map((r) => r.storage_path)
	);

	const { data: deleted, error } = await supabase
		.from('exercises')
		.delete()
		.eq('id', id)
		.select('id');
	return !error && !!deleted?.length;
}

export async function processExerciseAudioUpload(supabase: SupabaseClient, request: Request) {
	const parsed = parseAudioUpload(await request.formData(), 'exercise_id', 'exercises');
	if (parsed.error) return parsed.error;
	const { data, error } = await supabase
		.from('exercise_audio')
		.insert({ exercise_id: parsed.ownerId, ...parsed.row })
		.select('id')
		.single();
	if (error || !data) return fail(500, { error: 'Failed to save audio' });
	return { audioId: data.id as string };
}

export async function processExerciseFileUpload(supabase: SupabaseClient, request: Request) {
	const parsed = parseFileUpload(await request.formData(), 'exercise_id', 'exercises');
	if (parsed.error) return parsed.error;
	const { data, error } = await supabase
		.from('exercise_files')
		.insert({ exercise_id: parsed.ownerId, ...parsed.row })
		.select('id')
		.single();
	if (error || !data) return fail(500, { error: 'Failed to save the file' });
	return { fileId: data.id as string };
}

export async function processExerciseMediaDelete(
	supabase: SupabaseClient,
	table: 'exercise_audio' | 'exercise_files',
	request: Request
) {
	const id = (await request.formData()).get('id') as string;
	if (!id) return fail(400, { error: 'Nothing to delete' });
	const { data, error } = await supabase.from(table).delete().eq('id', id).select('storage_path');
	if (error || !data?.length) return fail(error ? 500 : 404, { error: 'Failed to delete' });
	await removeStored(
		supabase,
		data.map((r) => r.storage_path)
	);
	return { deleted: true };
}
