import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { PrintSettings } from '$lib/types/database';

type SharedSetlist = {
	name: string;
	gig_date: string | null;
	venue: string | null;
	// Song entries carry title + notes; gap entries carry gap_seconds + gap_label
	songs: Array<{
		title?: string;
		notes?: string | null;
		gap_seconds?: number;
		gap_label?: string | null;
	}>;
	profile: { display_name: string | null; logo_url: string | null } | null;
	print_settings: PrintSettings | null;
};

export const load: PageServerLoad = async ({ params, setHeaders, locals: { supabase } }) => {
	// All share data comes from a token-keyed SECURITY DEFINER RPC that
	// returns only the whitelisted fields. The broad anon RLS policies it
	// replaces let anyone with the public key enumerate profiles, shared
	// setlists, and song notes. An invalid/non-UUID token surfaces as an
	// RPC error or null result -- both 404.
	const { data, error: rpcError } = await supabase.rpc('get_shared_setlist', {
		p_token: params.token
	});

	if (rpcError || !data) {
		throw error(404, 'Setlist not found');
	}

	const shared = data as SharedSetlist;

	// Public, immutable-token page: let the CDN absorb repeat views
	setHeaders({
		'cache-control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300'
	});

	return {
		setlist: {
			name: shared.name,
			gig_date: shared.gig_date,
			venue: shared.venue
		},
		songs: shared.songs ?? [],
		profile: shared.profile,
		printSettings: shared.print_settings ?? null
	};
};
