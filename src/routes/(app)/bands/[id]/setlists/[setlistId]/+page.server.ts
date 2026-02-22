import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// Validate setlist belongs to this band
	const { data: setlist } = await supabase
		.from('setlists')
		.select('*')
		.eq('id', params.setlistId)
		.eq('band_id', params.id)
		.single();

	if (!setlist) {
		throw error(404, 'Setlist not found');
	}

	// Load setlist songs with joined song data
	const { data: setlistSongs } = await supabase
		.from('setlist_songs')
		.select('id, position, song_id, songs(id, title, duration_seconds)')
		.eq('setlist_id', params.setlistId)
		.order('position');

	// Load band songs (library panel) -- KEY DIFFERENCE from personal builder
	const { data: bandSongs } = await supabase
		.from('band_songs')
		.select('song_id, songs(id, title, duration_seconds, notes)')
		.eq('band_id', params.id)
		.order('songs(title)');

	// Flatten band songs into Song-like objects for the library panel
	const librarySongs = (bandSongs ?? [])
		.map((bs: any) => bs.songs)
		.filter(Boolean);

	return {
		setlist,
		setlistSongs: setlistSongs ?? [],
		songs: librarySongs
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
			.eq('id', params.setlistId)
			.eq('band_id', params.id);

		if (updateError) return fail(500, { error: 'Failed to update setlist' });
		return { updated: true };
	},

	saveOrder: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const itemsJson = formData.get('items') as string;

		let items: Array<{ id?: string; song_id: string; position: number }>;
		try {
			items = JSON.parse(itemsJson);
		} catch {
			return fail(400, { error: 'Invalid items data' });
		}

		// Separate existing rows (have id) from new rows (no id)
		const existingItems = items.filter((item) => item.id);
		const newItems = items.filter((item) => !item.id);
		const existingIds = existingItems.map((item) => item.id as string);

		// Delete rows that are no longer in the list (removed during reorder)
		if (existingIds.length > 0) {
			await supabase
				.from('setlist_songs')
				.delete()
				.eq('setlist_id', params.setlistId)
				.not('id', 'in', `(${existingIds.join(',')})`);
		} else {
			await supabase.from('setlist_songs').delete().eq('setlist_id', params.setlistId);
		}

		// Update positions for existing rows
		for (const item of existingItems) {
			await supabase
				.from('setlist_songs')
				.update({ position: item.position })
				.eq('id', item.id as string)
				.eq('setlist_id', params.setlistId);
		}

		// Insert new rows
		if (newItems.length > 0) {
			const { error: insertError } = await supabase.from('setlist_songs').insert(
				newItems.map((item) => ({
					setlist_id: params.setlistId,
					song_id: item.song_id,
					position: item.position
				}))
			);
			if (insertError) return fail(500, { error: 'Failed to save order' });
		}

		// Return the full set of rows so the client can sync IDs
		const { data: savedRows } = await supabase
			.from('setlist_songs')
			.select('id, position, song_id, songs(id, title, duration_seconds)')
			.eq('setlist_id', params.setlistId)
			.order('position');

		return { saved: true, items: savedRows ?? [] };
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
			.eq('setlist_id', params.setlistId)
			.order('position', { ascending: false })
			.limit(1);

		const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

		const { data: newRow, error: insertError } = await supabase
			.from('setlist_songs')
			.insert({
				setlist_id: params.setlistId,
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
			.eq('id', params.setlistId)
			.eq('band_id', params.id);

		if (updateError) return fail(500, { error: 'Failed to update sharing' });
		return { toggled: true };
	},

	removeSong: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const setlist_song_id = formData.get('setlist_song_id') as string;
		if (!setlist_song_id) return fail(400, { error: 'Setlist song ID is required' });

		await supabase.from('setlist_songs').delete().eq('id', setlist_song_id);

		return { removed: true };
	}
};
