import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	// All four queries are independent — run them concurrently instead of as
	// a 4-deep waterfall.
	const [
		{ count: memberCount },
		{ count: songCount },
		{ count: setlistCount },
		{ data: recentSetlists }
	] = await Promise.all([
		supabase
			.from('band_members')
			.select('*', { count: 'exact', head: true })
			.eq('band_id', params.id),
		supabase
			.from('band_songs')
			.select('*', { count: 'exact', head: true })
			.eq('band_id', params.id),
		supabase.from('setlists').select('*', { count: 'exact', head: true }).eq('band_id', params.id),
		supabase
			.from('setlists')
			.select('id, name, gig_date, venue')
			.eq('band_id', params.id)
			.order('updated_at', { ascending: false })
			.limit(5)
	]);

	return {
		memberCount: memberCount ?? 0,
		songCount: songCount ?? 0,
		setlistCount: setlistCount ?? 0,
		recentSetlists: recentSetlists ?? []
	};
};
