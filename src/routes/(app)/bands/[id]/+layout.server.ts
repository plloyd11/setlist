import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// Load band (RLS ensures only band members can access)
	const { data: band } = await supabase.from('bands').select('*').eq('id', params.id).single();

	if (!band) {
		throw error(404, 'Band not found');
	}

	// Load membership to determine role
	const { data: membership } = await supabase
		.from('band_members')
		.select('role')
		.eq('band_id', params.id)
		.eq('user_id', session.user.id)
		.single();

	return { band, isOwner: membership?.role === 'owner' };
};
