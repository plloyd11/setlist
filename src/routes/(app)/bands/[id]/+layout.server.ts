import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// Load band (RLS ensures only band members can access) and membership
	// concurrently — they're independent queries.
	const [{ data: band }, { data: membership }] = await Promise.all([
		supabase.from('bands').select('*').eq('id', params.id).single(),
		supabase
			.from('band_members')
			.select('role')
			.eq('band_id', params.id)
			.eq('user_id', session.user.id)
			.single()
	]);

	if (!band) {
		throw error(404, 'Band not found');
	}

	return { band, isOwner: membership?.role === 'owner' };
};
