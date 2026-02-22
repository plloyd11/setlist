import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw redirect(303, '/auth');
	}

	// Load user's bands with member counts
	const { data: bands } = await supabase
		.from('bands')
		.select('*, band_members(count)')
		.order('created_at', { ascending: false });

	const bandList = bands ?? [];

	// Enrich with song counts and setlist counts
	const enrichedBands = await Promise.all(
		bandList.map(async (band) => {
			const { count: songCount } = await supabase
				.from('band_songs')
				.select('*', { count: 'exact', head: true })
				.eq('band_id', band.id);

			const { count: setlistCount } = await supabase
				.from('setlists')
				.select('*', { count: 'exact', head: true })
				.eq('band_id', band.id);

			const memberCount = band.band_members?.[0]?.count ?? 0;

			return {
				id: band.id,
				name: band.name,
				owner_id: band.owner_id,
				logo_url: band.logo_url,
				created_at: band.created_at,
				updated_at: band.updated_at,
				member_count: memberCount,
				song_count: songCount ?? 0,
				setlist_count: setlistCount ?? 0,
				isOwner: band.owner_id === session.user.id
			};
		})
	);

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
		await supabase.from('band_members').insert({
			band_id: band.id,
			user_id: session.user.id,
			role: 'owner'
		});

		throw redirect(303, `/bands/${band.id}`);
	}
};
