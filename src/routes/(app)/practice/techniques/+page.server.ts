import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { curatedByKey, curatedFor, INSTRUMENTS } from '#lib/practice/curatedTechniques.js';

const MAX_TITLE_LENGTH = 120;

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) throw error(401, 'Not authenticated');

	const [{ data: skills, error: skillsError }, { data: profile }] = await Promise.all([
		supabase
			.from('skills')
			.select('id, title, goal_bpm, curated_key, skill_tempo_logs(bpm)')
			.order('created_at', { ascending: false }),
		supabase.from('profiles').select('instrument').eq('id', session.user.id).maybeSingle()
	]);
	if (skillsError) throw error(500, 'Could not load your techniques. Please try again.');

	const mine = (skills ?? []).map((s) => ({
		id: s.id as string,
		title: s.title as string,
		goalBpm: s.goal_bpm as number | null,
		curatedKey: s.curated_key as string | null,
		bestBpm: Math.max(0, ...s.skill_tempo_logs.map((log: { bpm: number }) => log.bpm))
	}));
	const started = new Set(mine.map((s) => s.curatedKey));
	const instrument = (profile?.instrument as string | null) ?? null;

	return {
		mine,
		instrument,
		lessons: curatedFor(instrument)
			.filter((lesson) => !started.has(lesson.key))
			.map((lesson) => ({ key: lesson.key, title: lesson.title, summary: lesson.summary }))
	};
};

export const actions: Actions = {
	setInstrument: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const instrument = ((await request.formData()).get('instrument') as string) ?? '';
		if (instrument && !INSTRUMENTS.some((i) => i.value === instrument)) {
			return fail(400, { error: 'Pick an instrument from the list' });
		}
		const { error: saveError } = await supabase
			.from('profiles')
			.upsert({ id: session.user.id, instrument: instrument || null });
		if (saveError) return fail(500, { error: 'Could not save that' });
		return { saved: true };
	},

	create: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const title = (((await request.formData()).get('title') as string) ?? '').trim();
		if (!title) return fail(400, { error: 'Give it a name' });
		if (title.length > MAX_TITLE_LENGTH) {
			return fail(400, { error: `Name must be ${MAX_TITLE_LENGTH} characters or fewer` });
		}
		const { data, error: insertError } = await supabase
			.from('skills')
			.insert({ title })
			.select('id')
			.single();
		if (insertError || !data) return fail(500, { error: 'Could not add that' });
		throw redirect(303, `/practice/techniques/${data.id}`);
	},

	startLesson: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const key = (await request.formData()).get('key') as string;
		const lesson = curatedByKey(key);
		if (!lesson) return fail(404, { error: 'That lesson no longer exists' });

		const { data: existing } = await supabase
			.from('skills')
			.select('id')
			.eq('curated_key', lesson.key)
			.limit(1);
		if (existing?.[0]) throw redirect(303, `/practice/techniques/${existing[0].id}`);

		const { data: skill, error: skillError } = await supabase
			.from('skills')
			.insert({
				title: lesson.title,
				source: 'curated',
				curated_key: lesson.key,
				goal_bpm: lesson.goalBpm
			})
			.select('id')
			.single();
		if (skillError || !skill) return fail(500, { error: 'Could not start that lesson' });

		const { error: drillsError } = await supabase.from('exercises').insert(
			lesson.drills.map((drill) => ({
				skill_id: skill.id,
				title: drill.title,
				notes: drill.how,
				target_seconds: Math.round(drill.minutes * 60)
			}))
		);
		if (drillsError) return fail(500, { error: 'Could not add its drills' });

		throw redirect(303, `/practice/techniques/${skill.id}`);
	}
};
