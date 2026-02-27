import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		return { songCount: 0, setlistCount: 0 };
	}

	const [songs, setlists] = await Promise.all([
		supabase
			.from('songs')
			.select('*', { count: 'exact', head: true })
			.eq('user_id', session.user.id),
		supabase
			.from('setlists')
			.select('*', { count: 'exact', head: true })
			.eq('user_id', session.user.id)
	]);

	return {
		songCount: songs.count ?? 0,
		setlistCount: setlists.count ?? 0
	};
};
