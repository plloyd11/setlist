import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw redirect(303, '/auth');
	}

	// Load user's bands with all three counts embedded — one query instead of
	// 1 + 2N (two count round-trips per band).
	const { data: bands } = await supabase
		.from('bands')
		.select('*, band_members(count), band_songs(count), setlists(count)')
		.order('created_at', { ascending: false });

	const enrichedBands = (bands ?? []).map((band) => ({
		id: band.id,
		name: band.name,
		owner_id: band.owner_id,
		logo_url: band.logo_url,
		created_at: band.created_at,
		updated_at: band.updated_at,
		member_count: band.band_members?.[0]?.count ?? 0,
		song_count: band.band_songs?.[0]?.count ?? 0,
		setlist_count: band.setlists?.[0]?.count ?? 0,
		isOwner: band.owner_id === session.user.id
	}));

	return { bands: enrichedBands };
};

export const actions: Actions = {
	create: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const name = (formData.get('name') as string)?.trim();

		if (!name) {
			return fail(400, { error: 'Band name is required' });
		}

		// Create band
		const { data: band, error: bandError } = await supabase
			.from('bands')
			.insert({ name, owner_id: session.user.id })
			.select('id')
			.single();

		if (bandError || !band) {
			return fail(500, { error: 'Failed to create band' });
		}

		// Add creator as owner member
		const { error: memberError } = await supabase.from('band_members').insert({
			band_id: band.id,
			user_id: session.user.id,
			role: 'owner'
		});

		if (memberError) {
			// Don't leave a band behind that has no member rows
			await supabase.from('bands').delete().eq('id', band.id);
			return fail(500, { error: 'Failed to create band' });
		}

		throw redirect(303, `/bands/${band.id}`);
	}
};
