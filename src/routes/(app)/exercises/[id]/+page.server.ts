import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import type { ExerciseAudio, ExerciseFile } from '#lib/types/database.js';
import { signAll } from '#lib/server/songMedia.js';
import {
	deleteExercise,
	parseExerciseFields,
	processExerciseAudioUpload,
	processExerciseFileUpload,
	processExerciseMediaDelete
} from '#lib/server/exercises.js';
import { safeInternalPath } from '#lib/utils/safeRedirect.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = 'exercise-files';

export const load: PageServerLoad = async ({
	params,
	url,
	locals: { supabase, safeGetSession }
}) => {
	const { session } = await safeGetSession();
	if (!session) throw error(401, 'Not authenticated');
	if (!UUID_RE.test(params.id)) throw error(404, 'Exercise not found');

	// RLS makes this owner-only: someone else's exercise simply isn't found
	const [{ data: exercise }, { data: audioRows }, { data: fileRows }] = await Promise.all([
		supabase.from('exercises').select('*').eq('id', params.id).maybeSingle(),
		supabase
			.from('exercise_audio')
			.select('*')
			.eq('exercise_id', params.id)
			.order('created_at', { ascending: true }),
		supabase
			.from('exercise_files')
			.select('*')
			.eq('exercise_id', params.id)
			.order('created_at', { ascending: true })
	]);
	if (!exercise) throw error(404, 'Exercise not found');

	const audio = (audioRows ?? []) as ExerciseAudio[];
	const files = (fileRows ?? []) as ExerciseFile[];
	const urls = await signAll(
		supabase,
		BUCKET,
		[...audio, ...files].map((row) => row.storage_path)
	);

	return {
		exercise,
		variants: audio.map((v) => ({ ...v, signedUrl: urls.get(v.storage_path) ?? null })),
		charts: files.map((f) => ({ ...f, signedUrl: urls.get(f.storage_path) ?? null })),
		backHref: safeInternalPath(url.searchParams.get('from'), '/practice/warm-up')
	};
};

export const actions: Actions = {
	update: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const fields = parseExerciseFields(await request.formData());
		if (fields.error) return fields.error;
		const { data, error: updateError } = await supabase
			.from('exercises')
			.update({
				title: fields.title,
				notes: fields.notes,
				target_seconds: fields.target_seconds,
				updated_at: new Date().toISOString()
			})
			.eq('id', params.id)
			.select('id');
		if (updateError || !data?.length) return fail(500, { error: 'Could not save that' });
		return { saved: true };
	},

	delete: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		if (!(await deleteExercise(supabase, params.id))) {
			return fail(500, { error: 'Could not delete that' });
		}
		throw redirect(303, '/practice/warm-up');
	},

	uploadAudio: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });
		return processExerciseAudioUpload(supabase, request);
	},

	uploadFile: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });
		return processExerciseFileUpload(supabase, request);
	},

	deleteAudio: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });
		return processExerciseMediaDelete(supabase, 'exercise_audio', request);
	},

	deleteFile: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });
		return processExerciseMediaDelete(supabase, 'exercise_files', request);
	}
};
