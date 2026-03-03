/**
 * Manual cleanup script for stale test users.
 * Run via: npx tsx scripts/cleanup-test-users.ts
 *
 * Purges all users with @setlist.test email addresses and their data.
 * Bands are deleted first (RESTRICT constraint), then the user (CASCADE handles rest).
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.test' });

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
	console.error(
		'Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Ensure .env.test is populated.'
	);
	process.exit(1);
}

const admin = createClient(url, serviceRoleKey);

async function main() {
	const {
		data: { users },
		error: listError
	} = await admin.auth.admin.listUsers();

	if (listError) {
		console.error('Failed to list users:', listError.message);
		process.exit(1);
	}

	const testUsers = users.filter((u) => u.email?.endsWith('@setlist.test'));
	console.log(`Found ${testUsers.length} test users to clean up`);

	for (const user of testUsers) {
		try {
			// Delete bands first (RESTRICT constraint on owner_id)
			const { error: bandError } = await admin
				.from('bands')
				.delete()
				.eq('owner_id', user.id);
			if (bandError) {
				console.warn(`Warning: could not delete bands for ${user.email}: ${bandError.message}`);
			}

			// Delete user (CASCADE handles songs, setlists, etc.)
			const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
			if (deleteError) {
				console.warn(`Warning: could not delete ${user.email}: ${deleteError.message}`);
				continue;
			}

			console.log(`Deleted: ${user.email}`);
		} catch (e) {
			console.warn(`Error cleaning up ${user.email}:`, e);
		}
	}

	console.log('Cleanup complete');
}

main();
