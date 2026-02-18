import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		return { songs: [] };
	}

	const { data: songs } = await supabase
		.from('songs')
		.select('*')
		.eq('user_id', session.user.id)
		.order('title', { ascending: true });

	return { songs: songs ?? [] };
};

export const actions: Actions = {
	delete: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Song ID is required' });
		}

		const { error } = await supabase.from('songs').delete().eq('id', id);

		if (error) {
			return fail(500, { error: 'Failed to delete song' });
		}

		return { deleted: true };
	}
};
