import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { curatedByKey, type Lesson } from '#lib/practice/curatedTechniques.js';
import { deleteExercise, nextRoutinePosition, parseExerciseFields } from '#lib/server/exercises.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_BPM = 1;
const MAX_BPM = 400;
const MAX_NOTES_LENGTH = 4000;

function parseBpm(value: FormDataEntryValue | null): number | null {
	const bpm = Number(value);
	return Number.isInteger(bpm) && bpm >= MIN_BPM && bpm <= MAX_BPM ? bpm : null;
}

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) throw error(401, 'Not authenticated');
	if (!UUID_RE.test(params.id)) throw error(404, 'Technique not found');

	// RLS makes all of this owner-only
	const [{ data: skill }, { data: logs }, { data: drills }] = await Promise.all([
		supabase.from('skills').select('*').eq('id', params.id).maybeSingle(),
		supabase
			.from('skill_tempo_logs')
			.select('id, bpm, note, logged_at')
			.eq('skill_id', params.id)
			.order('logged_at', { ascending: false })
			.limit(20),
		supabase
			.from('exercises')
			.select('id, title, target_seconds, routine_position')
			.eq('skill_id', params.id)
			.order('created_at', { ascending: true })
	]);
	if (!skill) throw error(404, 'Technique not found');

	return {
		skill,
		// A curated lesson comes from the code, and a written one is saved with the skill
		lesson: (curatedByKey(skill.curated_key) ?? (skill.lesson as Lesson | null)) as Lesson | null,
		logs: logs ?? [],
		drills: drills ?? []
	};
};

export const actions: Actions = {
	update: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const notes = ((formData.get('notes') as string) ?? '').trim();
		const goalRaw = (formData.get('goal_bpm') as string) ?? '';
		const goal = goalRaw === '' ? null : parseBpm(goalRaw);
		if (goalRaw !== '' && goal === null) {
			return fail(400, { error: `Goal must be between ${MIN_BPM} and ${MAX_BPM} BPM` });
		}
		if (notes.length > MAX_NOTES_LENGTH) return fail(400, { error: 'Notes are too long' });

		const { data, error: updateError } = await supabase
			.from('skills')
			.update({ notes: notes || null, goal_bpm: goal, updated_at: new Date().toISOString() })
			.eq('id', params.id)
			.select('id');
		if (updateError || !data?.length) return fail(500, { error: 'Could not save that' });
		return { saved: true };
	},

	logTempo: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const bpm = parseBpm((await request.formData()).get('bpm'));
		if (bpm === null) {
			return fail(400, { error: `Tempo must be between ${MIN_BPM} and ${MAX_BPM} BPM` });
		}
		const { error: insertError } = await supabase
			.from('skill_tempo_logs')
			.insert({ skill_id: params.id, bpm });
		if (insertError) return fail(500, { error: 'Could not log that' });
		return { logged: true };
	},

	addDrill: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const fields = parseExerciseFields(await request.formData());
		if (fields.error) return fields.error;
		const { error: insertError } = await supabase.from('exercises').insert({
			skill_id: params.id,
			title: fields.title,
			notes: fields.notes,
			target_seconds: fields.target_seconds
		});
		if (insertError) return fail(500, { error: 'Could not add that' });
		return { added: true };
	},

	addToWarmUp: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const id = (await request.formData()).get('id') as string;
		const { error: updateError } = await supabase
			.from('exercises')
			.update({ routine_position: await nextRoutinePosition(supabase) })
			.eq('id', id);
		if (updateError) return fail(500, { error: 'Could not add that' });
		return { added: true };
	},

	removeDrill: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const id = (await request.formData()).get('id') as string;
		if (!UUID_RE.test(id) || !(await deleteExercise(supabase, id))) {
			return fail(500, { error: 'Could not delete that' });
		}
		return { deleted: true };
	},

	delete: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const { data, error: deleteError } = await supabase
			.from('skills')
			.delete()
			.eq('id', params.id)
			.select('id');
		if (deleteError || !data?.length) return fail(500, { error: 'Could not delete that' });
		throw redirect(303, '/practice/techniques');
	}
};
