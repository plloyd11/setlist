import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		return { setlists: [], stats: {} };
	}

	// Load all band setlists
	const { data: setlists } = await supabase
		.from('setlists')
		.select('*')
		.eq('band_id', params.id)
		.order('updated_at', { ascending: false });

	const setlistList = setlists ?? [];

	// Build stats map: setlist_id -> { songCount, totalSeconds }
	const stats: Record<string, { songCount: number; totalSeconds: number }> = {};

	if (setlistList.length > 0) {
		const setlistIds = setlistList.map((s) => s.id);

		// Fetch setlist_songs with their song durations
		const { data: setlistSongs } = await supabase
			.from('setlist_songs')
			.select('setlist_id, songs(duration_seconds)')
			.in('setlist_id', setlistIds);

		if (setlistSongs) {
			for (const row of setlistSongs) {
				const sid = row.setlist_id;
				if (!stats[sid]) {
					stats[sid] = { songCount: 0, totalSeconds: 0 };
				}
				stats[sid].songCount += 1;
				const song = row.songs as unknown as { duration_seconds: number } | null;
				if (song) {
					stats[sid].totalSeconds += song.duration_seconds;
				}
			}
		}
	}

	return { setlists: setlistList, stats };
};

export const actions: Actions = {
	create: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();

		if (!name) {
			return fail(400, { error: 'Name is required' });
		}

		const { data: newSetlist, error } = await supabase
			.from('setlists')
			.insert({
				user_id: session.user.id,
				band_id: params.id,
				name,
				transition_seconds: 0
			})
			.select('id')
			.single();

		if (error || !newSetlist) {
			return fail(500, { error: 'Failed to create setlist' });
		}

		throw redirect(303, `/bands/${params.id}/setlists/${newSetlist.id}`);
	},

	delete: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Setlist ID is required' });
		}

		// Explicit band scope plus .select() so an RLS-filtered no-op is
		// reported instead of faking success.
		const { data: deletedRows, error } = await supabase
			.from('setlists')
			.delete()
			.eq('id', id)
			.eq('band_id', params.id)
			.select('id');

		if (error || !deletedRows?.length) {
			return fail(error ? 500 : 404, { error: 'Failed to delete setlist' });
		}

		return { deleted: true };
	},

	duplicate: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Setlist ID is required' });
		}

		// Load original setlist
		const { data: original } = await supabase
			.from('setlists')
			.select('name, gig_date, venue, target_seconds, transition_seconds')
			.eq('id', id)
			.eq('band_id', params.id)
			.single();

		if (!original) {
			return fail(404, { error: 'Setlist not found' });
		}

		// Create copy (no share_token)
		const { data: newSetlist, error: insertError } = await supabase
			.from('setlists')
			.insert({
				user_id: session.user.id,
				band_id: params.id,
				name: `${original.name} (Copy)`,
				gig_date: original.gig_date,
				venue: original.venue,
				target_seconds: original.target_seconds,
				transition_seconds: original.transition_seconds
			})
			.select('id')
			.single();

		if (insertError || !newSetlist) {
			return fail(500, { error: 'Failed to duplicate setlist' });
		}

		// Copy songs
		const { data: originalSongs } = await supabase
			.from('setlist_songs')
			.select('song_id, position')
			.eq('setlist_id', id)
			.order('position');

		if (originalSongs?.length) {
			const { error: copyError } = await supabase.from('setlist_songs').insert(
				originalSongs.map((s) => ({
					setlist_id: newSetlist.id,
					song_id: s.song_id,
					position: s.position
				}))
			);

			if (copyError) {
				// Don't leave a half-created empty copy behind
				await supabase.from('setlists').delete().eq('id', newSetlist.id);
				return fail(500, { error: 'Failed to duplicate setlist' });
			}
		}

		return { duplicated: true };
	},

	rename: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;
		const name = (formData.get('name') as string)?.trim();

		if (!id || !name) {
			return fail(400, { error: 'ID and name are required' });
		}

		const { data: renamedRows, error } = await supabase
			.from('setlists')
			.update({ name })
			.eq('id', id)
			.eq('band_id', params.id)
			.select('id');

		if (error || !renamedRows?.length) {
			return fail(error ? 500 : 404, { error: 'Failed to rename setlist' });
		}

		return { renamed: true };
	}
};
