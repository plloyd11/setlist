import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({
	params,
	url,
	locals: { supabase, safeGetSession }
}) => {
	const { session } = await safeGetSession();
	if (!session) {
		// Redirect to auth with return URL so user comes back after login
		const returnUrl = encodeURIComponent(url.pathname);
		throw redirect(303, `/auth?redirect=${returnUrl}`);
	}

	// Look up invite + band info via RPC (bypasses RLS safely with token check)
	const { data: rows } = await supabase.rpc('get_band_by_invite_token', {
		invite_token: params.token
	});

	const invite = rows?.[0];
	if (!invite) {
		throw error(404, 'This invite link is invalid or has expired.');
	}

	// Check if user is already a member of this band
	const { data: existingMember } = await supabase
		.from('band_members')
		.select('id')
		.eq('band_id', invite.band_id)
		.eq('user_id', session.user.id)
		.single();

	return {
		invite: {
			bandId: invite.band_id,
			bandName: invite.band_name ?? 'Unknown Band',
			bandLogoUrl: invite.band_logo_url ?? null,
			alreadyMember: !!existingMember
		}
	};
};

export const actions: Actions = {
	accept: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		// Atomic accept via RPC: validates the token, inserts the member, and
		// marks the invite used in one transaction. (Direct table access is no
		// longer possible — invite SELECT is owner-only and the token-less
		// self-insert policy was removed.)
		const { data: rows, error: acceptError } = await supabase.rpc('accept_band_invite', {
			invite_token: params.token
		});

		const result = rows?.[0];

		if (acceptError || !result) {
			return fail(500, { error: 'Failed to join band' });
		}

		if (result.status === 'invalid' || !result.band_id) {
			return fail(404, { error: 'Invite expired or already used' });
		}

		throw redirect(303, `/bands/${result.band_id}`);
	}
};
