import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { deleteExercise, nextRoutinePosition, parseExerciseFields } from '#lib/server/exercises.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ROUTINE = 200;

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) throw error(401, 'Not authenticated');

	const { data, error: loadError } = await supabase
		.from('exercises')
		.select(
			'id, title, target_seconds, routine_position, skill_id, exercise_audio(count), exercise_files(count)'
		)
		.order('routine_position', { ascending: true, nullsFirst: false })
		.order('created_at', { ascending: true });
	if (loadError) throw error(500, 'Could not load your exercises. Please try again.');

	const exercises = (data ?? []).map((e) => ({
		id: e.id as string,
		title: e.title as string,
		targetSeconds: e.target_seconds as number,
		inRoutine: e.routine_position !== null,
		hasAudio: (e.exercise_audio[0]?.count ?? 0) > 0,
		hasChart: (e.exercise_files[0]?.count ?? 0) > 0
	}));
	return {
		routine: exercises.filter((e) => e.inRoutine),
		others: exercises.filter((e) => !e.inRoutine)
	};
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const fields = parseExerciseFields(await request.formData());
		if (fields.error) return fields.error;
		const { error: insertError } = await supabase.from('exercises').insert({
			title: fields.title,
			notes: fields.notes,
			target_seconds: fields.target_seconds,
			routine_position: await nextRoutinePosition(supabase)
		});
		if (insertError) return fail(500, { error: 'Could not add that' });
		return { created: true };
	},

	addToRoutine: async ({ request, locals: { supabase, safeGetSession } }) => {
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

	removeFromRoutine: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const id = (await request.formData()).get('id') as string;
		const { error: updateError } = await supabase
			.from('exercises')
			.update({ routine_position: null })
			.eq('id', id);
		if (updateError) return fail(500, { error: 'Could not remove that' });
		return { removed: true };
	},

	reorder: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		let ids: unknown;
		try {
			ids = JSON.parse((await request.formData()).get('ids') as string);
		} catch {
			return fail(400, { error: 'Invalid order' });
		}
		if (
			!Array.isArray(ids) ||
			ids.length > MAX_ROUTINE ||
			ids.some((id) => typeof id !== 'string' || !UUID_RE.test(id))
		) {
			return fail(400, { error: 'Invalid order' });
		}
		const results = await Promise.all(
			(ids as string[]).map((id, position) =>
				supabase.from('exercises').update({ routine_position: position }).eq('id', id)
			)
		);
		if (results.some((r) => r.error)) return fail(500, { error: 'Could not save the order' });
		return { reordered: true };
	},

	delete: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const id = (await request.formData()).get('id') as string;
		if (!UUID_RE.test(id) || !(await deleteExercise(supabase, id))) {
			return fail(500, { error: 'Could not delete that' });
		}
		return { deleted: true };
	}
};
