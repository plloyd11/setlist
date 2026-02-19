import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		return { profile: null };
	}

	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', session.user.id)
		.maybeSingle();

	return { profile };
};

export const actions: Actions = {
	updateProfile: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const display_name = (formData.get('display_name') as string)?.trim() || null;

		const { error: upsertError } = await supabase.from('profiles').upsert({
			id: session.user.id,
			display_name,
			updated_at: new Date().toISOString()
		});

		if (upsertError) return fail(500, { error: 'Failed to update profile' });
		return { updated: true };
	}
};
