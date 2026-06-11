import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// The four queries are independent — run them concurrently instead of as
	// a 4-deep waterfall. The setlist result still gates the 404.
	const [{ data: setlist }, { data: setlistSongs }, { data: songs }, { data: profile }] =
		await Promise.all([
			supabase
				.from('setlists')
				.select('*')
				.eq('id', params.id)
				.eq('user_id', session.user.id)
				.single(),
			supabase
				.from('setlist_songs')
				.select(
					'id, position, song_id, gap_seconds, gap_label, songs(id, title, duration_seconds, notes)'
				)
				.eq('setlist_id', params.id)
				.order('position'),
			supabase
				.from('songs')
				.select('id, user_id, title, duration_seconds, notes, created_at')
				.eq('user_id', session.user.id)
				.order('title'),
			supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
		]);

	if (!setlist) {
		throw error(404, 'Setlist not found');
	}

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

		let items: Array<{
			id?: string;
			song_id: string | null;
			gap_seconds?: number | null;
			gap_label?: string | null;
			position: number;
		}>;
		try {
			items = JSON.parse(itemsJson);
		} catch {
			return fail(400, { error: 'Invalid items data' });
		}

		// Atomic reorder via RPC: applies position changes, removals, and new
		// rows in one transaction (the old delete-all/re-insert could wipe the
		// setlist on partial failure) and keeps existing row IDs stable.
		const { data: savedRows, error: saveError } = await supabase.rpc('save_setlist_order', {
			p_setlist_id: params.id,
			p_items: items.map((item) => ({
				id: item.id ?? null,
				song_id: item.song_id ?? null,
				gap_seconds: item.gap_seconds ?? null,
				gap_label: item.gap_label ?? null
			}))
		});

		if (saveError) return fail(500, { error: 'Failed to save order' });

		return { saved: true, items: savedRows ?? [] };
	},

	addSong: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const song_id = formData.get('song_id') as string;
		if (!song_id) return fail(400, { error: 'Song ID is required' });

		// Read-max-then-insert races with concurrent adds on the
		// unique(setlist_id, position) constraint — retry on 23505.
		for (let attempt = 0; attempt < 3; attempt++) {
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
				.select('id, position, song_id, gap_seconds, songs(id, title, duration_seconds, notes)')
				.single();

			if (!insertError) return { added: true, setlistSong: newRow };
			if (insertError.code !== '23505') break;
		}

		return fail(500, { error: 'Failed to add song' });
	},

	addGap: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const gap_seconds = parseInt(formData.get('gap_seconds') as string, 10) || 30;

		// Same read-max-then-insert retry as addSong (unique setlist_id, position)
		for (let attempt = 0; attempt < 3; attempt++) {
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
					song_id: null,
					gap_seconds,
					position: nextPosition
				})
				.select('id, position, song_id, gap_seconds, gap_label')
				.single();

			if (!insertError) return { added: true, setlistSong: newRow };
			if (insertError.code !== '23505') break;
		}

		return fail(500, { error: 'Failed to add gap' });
	},

	updateGap: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		const setlist_song_id = formData.get('setlist_song_id') as string;
		if (!setlist_song_id) return fail(400, { error: 'Invalid gap data' });

		const updates: Record<string, unknown> = {};
		if (formData.has('gap_seconds')) {
			const gap_seconds = parseInt(formData.get('gap_seconds') as string, 10);
			if (!gap_seconds || gap_seconds <= 0) return fail(400, { error: 'Invalid gap data' });
			updates.gap_seconds = gap_seconds;
		}
		if (formData.has('gap_label')) {
			const gap_label = ((formData.get('gap_label') as string) ?? '').trim().slice(0, 60);
			updates.gap_label = gap_label || null;
		}
		if (Object.keys(updates).length === 0) return fail(400, { error: 'Invalid gap data' });

		// .is('song_id', null) restricts to gap rows; .select() so an
		// RLS-filtered no-op is reported instead of faking success.
		const { data: updatedRows, error: updateError } = await supabase
			.from('setlist_songs')
			.update(updates)
			.eq('id', setlist_song_id)
			.is('song_id', null)
			.select('id');

		if (updateError || !updatedRows?.length) {
			return fail(404, { error: 'Gap not found' });
		}

		return { updated: true };
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

		// Delete the single row -- no re-normalization needed.
		// Positions can have gaps; the client assigns contiguous positions from array index on next save.
		// .select() so an RLS-filtered no-op is reported instead of faking success.
		const { data: deletedRows, error: deleteError } = await supabase
			.from('setlist_songs')
			.delete()
			.eq('id', setlist_song_id)
			.select('id');

		if (deleteError || !deletedRows?.length) {
			return fail(404, { error: 'Song not found in setlist' });
		}

		return { removed: true };
	}
};
