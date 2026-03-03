import { redirect } from '@sveltejs/kit';
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

	// Read redirect target from cookie (set before OAuth flow started)
	const redirectTo = cookies.get('auth_redirect');
	if (redirectTo) {
		cookies.delete('auth_redirect', { path: '/' });
		redirect(303, decodeURIComponent(redirectTo));
	}

	redirect(303, '/dashboard');
};
