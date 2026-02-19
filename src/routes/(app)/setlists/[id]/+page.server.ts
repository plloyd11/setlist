import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// Validate setlist belongs to user
	const { data: setlist } = await supabase
		.from('setlists')
		.select('*')
		.eq('id', params.id)
		.eq('user_id', session.user.id)
		.single();

	if (!setlist) {
		throw error(404, 'Setlist not found');
	}

	// Load setlist songs with joined song data
	const { data: setlistSongs } = await supabase
		.from('setlist_songs')
		.select('id, position, song_id, songs(id, title, duration_seconds)')
		.eq('setlist_id', params.id)
		.order('position');

	// Load user's full song library
	const { data: songs } = await supabase
		.from('songs')
		.select('*')
		.eq('user_id', session.user.id)
		.order('title');

	// Load user's profile (for logo_url in header)
	const { data: profile } = await supabase
		.from('profiles')
		.select('*')
		.eq('id', session.user.id)
		.maybeSingle();

	return {
		setlist,
		setlistSongs: setlistSongs ?? [],
		songs: songs ?? [],
		profile
	};
};

export const actions: Actions = {
	updateSetlist: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const gig_date = (formData.get('gig_date') as string) || null;
		const venue = (formData.get('venue') as string)?.trim() || null;
		const target_seconds_str = formData.get('target_seconds') as string;
		const transition_seconds_str = formData.get('transition_seconds') as string;
		const name = (formData.get('name') as string)?.trim();

		const updates: Record<string, unknown> = {};
		if (formData.has('gig_date')) updates.gig_date = gig_date;
		if (formData.has('venue')) updates.venue = venue;
		if (formData.has('name') && name) updates.name = name;
		if (formData.has('target_seconds')) {
			updates.target_seconds = target_seconds_str ? parseInt(target_seconds_str, 10) || null : null;
		}
		if (formData.has('transition_seconds')) {
			updates.transition_seconds = parseInt(transition_seconds_str, 10) || 0;
		}

		const { error: updateError } = await supabase
			.from('setlists')
			.update(updates)
			.eq('id', params.id)
			.eq('user_id', session.user.id);

		if (updateError) return fail(500, { error: 'Failed to update setlist' });
		return { updated: true };
	},

	saveOrder: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const itemsJson = formData.get('items') as string;

		let items: Array<{ song_id: string; position: number }>;
		try {
			items = JSON.parse(itemsJson);
		} catch {
			return fail(400, { error: 'Invalid items data' });
		}

		// Delete all existing setlist_songs for this setlist
		await supabase.from('setlist_songs').delete().eq('setlist_id', params.id);

		// Insert new rows with sequential positions
		if (items.length > 0) {
			const { error: insertError } = await supabase.from('setlist_songs').insert(
				items.map((item, index) => ({
					setlist_id: params.id,
					song_id: item.song_id,
					position: index
				}))
			);

			if (insertError) return fail(500, { error: 'Failed to save order' });
		}

		return { saved: true };
	},

	addSong: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const song_id = formData.get('song_id') as string;
		if (!song_id) return fail(400, { error: 'Song ID is required' });

		// Get max position
		const { data: existing } = await supabase
			.from('setlist_songs')
			.select('position')
			.eq('setlist_id', params.id)
			.order('position', { ascending: false })
			.limit(1);

		const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

		const { data: newRow, error: insertError } = await supabase
			.from('setlist_songs')
			.insert({
				setlist_id: params.id,
				song_id,
				position: nextPosition
			})
			.select('id, position, song_id, songs(id, title, duration_seconds)')
			.single();

		if (insertError) return fail(500, { error: 'Failed to add song' });
		return { added: true, setlistSong: newRow };
	},

	toggleShare: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const share_token = (formData.get('share_token') as string) || null;

		const { error: updateError } = await supabase
			.from('setlists')
			.update({ share_token })
			.eq('id', params.id)
			.eq('user_id', session.user.id);

		if (updateError) return fail(500, { error: 'Failed to update sharing' });
		return { toggled: true };
	},

	removeSong: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const setlist_song_id = formData.get('setlist_song_id') as string;
		if (!setlist_song_id) return fail(400, { error: 'Setlist song ID is required' });

		// Delete the song
		await supabase.from('setlist_songs').delete().eq('id', setlist_song_id);

		// Re-normalize positions: get remaining songs in order, delete all, re-insert
		const { data: remaining } = await supabase
			.from('setlist_songs')
			.select('id, song_id')
			.eq('setlist_id', params.id)
			.order('position');

		if (remaining && remaining.length > 0) {
			await supabase.from('setlist_songs').delete().eq('setlist_id', params.id);
			await supabase.from('setlist_songs').insert(
				remaining.map((item, index) => ({
					setlist_id: params.id,
					song_id: item.song_id,
					position: index
				}))
			);
		}

		return { removed: true };
	}
};
