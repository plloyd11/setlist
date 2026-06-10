import { fail } from '@sveltejs/kit';
import { parseDuration } from '$lib/utils/duration';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		return { bandSongs: [], personalSongs: [] };
	}

	// Load band songs via junction table
	const { data: bandSongs } = await supabase
		.from('band_songs')
		.select('id, song_id, added_by, songs(id, title, duration_seconds, notes, user_id)')
		.eq('band_id', params.id)
		.order('added_at', { ascending: true });

	// Load user's personal songs for the share picker
	const { data: personalSongs } = await supabase
		.from('songs')
		.select('id, title, duration_seconds')
		.eq('user_id', session.user.id)
		.order('title');

	return {
		bandSongs: bandSongs ?? [],
		personalSongs: personalSongs ?? []
	};
};

export const actions: Actions = {
	shareSong: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const song_id = formData.get('song_id') as string;

		if (!song_id) {
			return fail(400, { error: 'Song ID is required' });
		}

		const { error } = await supabase
			.from('band_songs')
			.insert({ band_id: params.id, song_id, added_by: session.user.id });

		if (error) {
			// Handle unique constraint violation
			if (error.code === '23505') {
				return fail(409, { error: 'Song already in band library' });
			}
			return fail(500, { error: 'Failed to share song' });
		}

		return { shared: true };
	},

	addNew: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const title = formData.get('title') as string;
		const durationRaw = formData.get('duration') as string;
		const notes = (formData.get('notes') as string) || null;

		if (!title?.trim()) {
			return fail(400, { error: 'Title is required' });
		}

		const durationSeconds = parseDuration(durationRaw ?? '');
		if (durationSeconds === null) {
			return fail(400, { error: 'Duration must be in mm:ss format (e.g., 3:45)' });
		}

		// Create the song (owned by the creator)
		const { data: newSong, error: songError } = await supabase
			.from('songs')
			.insert({
				user_id: session.user.id,
				title: title.trim(),
				duration_seconds: durationSeconds,
				notes: notes?.trim() || null
			})
			.select('id')
			.single();

		if (songError || !newSong) {
			return fail(500, { error: 'Failed to create song' });
		}

		// Add to band library
		const { error: linkError } = await supabase
			.from('band_songs')
			.insert({ band_id: params.id, song_id: newSong.id, added_by: session.user.id });

		if (linkError) {
			// Don't leave an orphaned personal song behind
			await supabase.from('songs').delete().eq('id', newSong.id);
			return fail(500, { error: 'Failed to add song to band library' });
		}

		return { added: true };
	},

	removeSong: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const band_song_id = formData.get('band_song_id') as string;

		if (!band_song_id) {
			return fail(400, { error: 'Band song ID is required' });
		}

		// Explicit band scope plus .select() so an RLS-filtered no-op is
		// reported instead of faking success.
		const { data: deletedRows, error } = await supabase
			.from('band_songs')
			.delete()
			.eq('id', band_song_id)
			.eq('band_id', params.id)
			.select('id');

		if (error || !deletedRows?.length) {
			return fail(error ? 500 : 404, { error: 'Failed to remove song from band' });
		}

		return { removed: true };
	},

	updateSong: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const song_id = formData.get('song_id') as string;
		const title = formData.get('title') as string;
		const durationRaw = formData.get('duration') as string;
		const notes = (formData.get('notes') as string) || null;

		if (!song_id) {
			return fail(400, { error: 'Song ID is required' });
		}

		if (!title?.trim()) {
			return fail(400, { error: 'Title is required' });
		}

		const durationSeconds = parseDuration(durationRaw ?? '');
		if (durationSeconds === null) {
			return fail(400, { error: 'Duration must be in mm:ss format (e.g., 3:45)' });
		}

		// Verify the song actually belongs to THIS band's library before
		// editing — RLS alone would let a member edit songs linked to any of
		// their bands through this action.
		const { data: link } = await supabase
			.from('band_songs')
			.select('id')
			.eq('band_id', params.id)
			.eq('song_id', song_id)
			.maybeSingle();

		if (!link) {
			return fail(404, { error: 'Song not found in this band library' });
		}

		const { data: updatedRows, error } = await supabase
			.from('songs')
			.update({
				title: title.trim(),
				duration_seconds: durationSeconds,
				notes: notes?.trim() || null
			})
			.eq('id', song_id)
			.select('id');

		if (error || !updatedRows?.length) {
			return fail(error ? 500 : 404, { error: 'Failed to update song' });
		}

		return { updated: true };
	}
};
