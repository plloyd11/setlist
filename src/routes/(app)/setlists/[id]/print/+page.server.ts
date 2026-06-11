import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { normalizePrintSettings } from '$lib/utils/printSettings';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// No user_id/band_id filter: RLS authorizes the owner and band members
	// (via user_band_ids()), so this one route serves both setlist flavors.
	const [{ data: setlist }, { data: setlistSongs }, { data: ownProfile }] = await Promise.all([
		supabase.from('setlists').select('*').eq('id', params.id).single(),
		supabase
			.from('setlist_songs')
			.select('position, song_id, gap_seconds, gap_label, songs(title, notes)')
			.eq('setlist_id', params.id)
			.order('position'),
		supabase
			.from('profiles')
			.select('display_name, logo_url')
			.eq('id', session.user.id)
			.maybeSingle()
	]);

	if (!setlist) {
		throw error(404, 'Setlist not found');
	}

	// Band setlists print with the band identity, personal ones with the
	// owner's profile -- the same branch get_shared_setlist takes. The sheet
	// is always light, so the dark logo variant wins when present.
	let profile = ownProfile ?? null;
	if (setlist.band_id) {
		const { data: band } = await supabase
			.from('bands')
			.select('name, logo_url, logo_dark_url')
			.eq('id', setlist.band_id)
			.maybeSingle();
		profile = band
			? { display_name: band.name, logo_url: band.logo_dark_url ?? band.logo_url }
			: null;
	}

	// Same entry shape as the get_shared_setlist payload, so PrintableSheet
	// renders identically here and on the public share page.
	const entries = (setlistSongs ?? []).map((row) => {
		// supabase-js types the many-to-one join as an array; at runtime it's an object
		const song = row.songs as unknown as { title: string; notes: string | null } | null;
		return row.song_id
			? { title: song?.title ?? '', notes: song?.notes ?? null }
			: { gap_seconds: row.gap_seconds, gap_label: row.gap_label };
	});

	return {
		setlist,
		entries,
		profile,
		backHref: setlist.band_id
			? `/bands/${setlist.band_id}/setlists/${setlist.id}`
			: `/setlists/${setlist.id}`
	};
};

export const actions: Actions = {
	updatePrintSettings: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const formData = await request.formData();
		let parsed: unknown;
		try {
			parsed = JSON.parse(formData.get('print_settings') as string);
		} catch {
			return fail(400, { error: 'Invalid settings data' });
		}

		// Whitelist/clamp before writing -- the column is free-form JSONB.
		// .select() so an RLS-filtered no-op is reported instead of faking success.
		const { data: updatedRows, error: updateError } = await supabase
			.from('setlists')
			.update({ print_settings: normalizePrintSettings(parsed) })
			.eq('id', params.id)
			.select('id');

		if (updateError || !updatedRows?.length) {
			return fail(404, { error: 'Setlist not found' });
		}

		return { updated: true };
	}
};
