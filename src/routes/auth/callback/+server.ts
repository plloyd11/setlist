import { redirect } from '@sveltejs/kit';
import { safeInternalPath } from '#lib/utils/safeRedirect.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, cookies, locals: { supabase } }) => {
	const code = url.searchParams.get('code');

	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code);
		if (error) {
			// Exchange failed — send back to auth page
			redirect(303, '/auth?error=auth_exchange_failed');
		}
	}

	// Read redirect target from cookie (set before OAuth flow started). The
	// value is attacker-influenced via the ?redirect= query param on /auth.
	const redirectTo = cookies.get('auth_redirect');
	if (redirectTo) {
		cookies.delete('auth_redirect', { path: '/' });
	}

	redirect(303, safeInternalPath(redirectTo));
};
