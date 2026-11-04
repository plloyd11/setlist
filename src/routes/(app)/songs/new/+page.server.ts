import { fail } from '@sveltejs/kit';
import { parseDuration } from '#lib/utils/duration.js';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { title: '', durationRaw: '', notes: null, error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const title = formData.get('title') as string;
		const durationRaw = formData.get('duration') as string;
		const notes = (formData.get('notes') as string) || null;

		if (!title?.trim()) {
			return fail(400, { title, durationRaw, notes, error: 'Title is required' });
		}

		const durationSeconds = parseDuration(durationRaw ?? '');
		if (durationSeconds === null) {
			return fail(400, {
				title,
				durationRaw,
				notes,
				error: 'Length needs minutes and seconds, like 3:45'
			});
		}

		const { error } = await supabase.from('songs').insert({
			user_id: session.user.id,
			title: title.trim(),
			duration_seconds: durationSeconds,
			notes: notes?.trim() || null
		});

		if (error) {
			console.error('Supabase insert error:', error);
			return fail(500, {
				title,
				durationRaw,
				notes,
				error: "Couldn't save that song. Check your connection and try again."
			});
		}

		return { success: true };
	}
};
