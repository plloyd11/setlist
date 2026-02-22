import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	// Count band members
	const { count: memberCount } = await supabase
		.from('band_members')
		.select('*', { count: 'exact', head: true })
		.eq('band_id', params.id);

	// Count band songs
	const { count: songCount } = await supabase
		.from('band_songs')
		.select('*', { count: 'exact', head: true })
		.eq('band_id', params.id);

	// Count band setlists
	const { count: setlistCount } = await supabase
		.from('setlists')
		.select('*', { count: 'exact', head: true })
		.eq('band_id', params.id);

	// Fetch recent setlists (last 5)
	const { data: recentSetlists } = await supabase
		.from('setlists')
		.select('id, name, gig_date, venue')
		.eq('band_id', params.id)
		.order('updated_at', { ascending: false })
		.limit(5);

	return {
		memberCount: memberCount ?? 0,
		songCount: songCount ?? 0,
		setlistCount: setlistCount ?? 0,
		recentSetlists: recentSetlists ?? []
	};
};
