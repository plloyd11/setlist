import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, url, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		// Redirect to auth with return URL so user comes back after login
		const returnUrl = encodeURIComponent(url.pathname);
		throw redirect(303, `/auth?redirect=${returnUrl}`);
	}

	// Look up invite + band info via RPC (bypasses RLS safely with token check)
	const { data: rows } = await supabase
		.rpc('get_band_by_invite_token', { invite_token: params.token });

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

		// Re-query invite (validate still valid -- someone could accept between load and action)
		const { data: invite } = await supabase
			.from('band_invites')
			.select('id, band_id')
			.eq('token', params.token)
			.is('used_at', null)
			.gt('expires_at', new Date().toISOString())
			.single();

		if (!invite) {
			return fail(404, { error: 'Invite expired or already used' });
		}

		// Check if already a member
		const { data: existingMember } = await supabase
			.from('band_members')
			.select('id')
			.eq('band_id', invite.band_id)
			.eq('user_id', session.user.id)
			.single();

		if (existingMember) {
			throw redirect(303, `/bands/${invite.band_id}`);
		}

		// Insert new member
		const { error: insertError } = await supabase
			.from('band_members')
			.insert({
				band_id: invite.band_id,
				user_id: session.user.id,
				role: 'member'
			});

		if (insertError) {
			// Handle unique constraint violation (23505) -- already a member
			if (insertError.code === '23505') {
				throw redirect(303, `/bands/${invite.band_id}`);
			}
			return fail(500, { error: 'Failed to join band' });
		}

		// Mark invite as used
		await supabase
			.from('band_invites')
			.update({
				used_by: session.user.id,
				used_at: new Date().toISOString()
			})
			.eq('id', invite.id);

		throw redirect(303, `/bands/${invite.band_id}`);
	}
};
