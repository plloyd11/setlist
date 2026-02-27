import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
	updateBand: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		// Verify ownership
		const { data: membership } = await supabase
			.from('band_members')
			.select('role')
			.eq('band_id', params.id)
			.eq('user_id', session.user.id)
			.single();

		if (membership?.role !== 'owner') return fail(403, { error: 'Only the owner can edit band settings' });

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();

		if (!name) return fail(400, { error: 'Band name is required' });

		const { error: updateError } = await supabase
			.from('bands')
			.update({ name, updated_at: new Date().toISOString() })
			.eq('id', params.id);

		if (updateError) return fail(500, { error: 'Failed to update band' });
		return { updated: true };
	},

	deleteBand: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		// Verify ownership
		const { data: membership } = await supabase
			.from('band_members')
			.select('role')
			.eq('band_id', params.id)
			.eq('user_id', session.user.id)
			.single();

		if (membership?.role !== 'owner') return fail(403, { error: 'Only the owner can delete this band' });

		const { error: deleteError } = await supabase.from('bands').delete().eq('id', params.id);

		if (deleteError) return fail(500, { error: 'Failed to delete band' });
		throw redirect(303, '/');
	}
};
