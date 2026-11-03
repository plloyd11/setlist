import type { EmailOtpType } from '@supabase/supabase-js';
import { redirect } from '@sveltejs/kit';
import { safeInternalPath } from '#lib/utils/safeRedirect.js';
import type { RequestHandler } from './$types';

// Handles email confirmation links (signup, recovery, email change). The
// Supabase email templates must link here with token_hash + type — see
// the "Confirm signup" template in the dashboard.
export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type') as EmailOtpType | null;

	// `next` is attacker-influenced (it round-trips through the email link).
	// Accept relative paths or same-origin absolute URLs ({{ .RedirectTo }}
	// in the email template expands to the absolute emailRedirectTo value).
	if (tokenHash && type) {
		const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
		if (!error) {
			redirect(303, safeInternalPath(url.searchParams.get('next'), '/dashboard', url.origin));
		}
	}

	redirect(303, '/auth?error=confirm_failed');
};
