import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
	throw new Error(
		'Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. ' +
			'Ensure .env.test is populated with your Supabase credentials.'
	);
}

/**
 * Service-role Supabase client singleton.
 * Bypasses RLS -- used by factories and cleanup, never by tests themselves.
 */
export const adminClient = createClient(url, serviceRoleKey);
