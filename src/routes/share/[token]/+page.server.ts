import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
	// Fetch setlist by share_token (no auth required - public route)
	const { data: setlist, error: setlistError } = await supabase
		.from('setlists')
		.select('id, name, gig_date, venue, user_id')
		.eq('share_token', params.token)
		.single();

	if (setlistError || !setlist) {
		throw error(404, 'Setlist not found');
	}

	// Fetch songs with only titles (no durations for shared view)
	const { data: setlistSongs } = await supabase
		.from('setlist_songs')
		.select('position, songs(title)')
		.eq('setlist_id', setlist.id)
		.order('position');

	// Fetch profile for logo and display name
	const { data: profile } = await supabase
		.from('profiles')
		.select('display_name, logo_url')
		.eq('id', setlist.user_id)
		.maybeSingle();

	// Return only safe data - no id or user_id
	return {
		setlist: {
			name: setlist.name,
			gig_date: setlist.gig_date,
			venue: setlist.venue
		},
		songs: (setlistSongs ?? []).map((ss: any) => ({
			title: (ss.songs as any)?.title ?? 'Unknown'
		})),
		profile
	};
};
