import { adminClient } from './supabase-admin';
import { faker } from '@faker-js/faker';

/**
 * Create a test user via Supabase admin API.
 * Email format: test-worker{N}-{timestamp}@setlist.test
 */
export async function createTestUser(workerIndex: number) {
	const email = `test-worker${workerIndex}-${Date.now()}@setlist.test`;
	const password = faker.internet.password({ length: 20 });

	const { data, error } = await adminClient.auth.admin.createUser({
		email,
		password,
		email_confirm: true
	});

	if (error) {
		throw new Error(`Failed to create test user: ${error.message}`);
	}

	return { id: data.user.id, email, password };
}

/**
 * Delete a test user and all associated data.
 * Bands must be deleted first due to ON DELETE RESTRICT on bands.owner_id.
 * Cleanup failures warn but never throw -- stale data should not fail the test run.
 */
export async function deleteTestUser(userId: string) {
	// Delete bands first (owner_id has ON DELETE RESTRICT)
	const { error: bandError } = await adminClient.from('bands').delete().eq('owner_id', userId);
	if (bandError) {
		console.warn(
			`Cleanup warning: failed to delete bands for user ${userId}:`,
			bandError.message
		);
	}

	// Delete user (CASCADE handles songs, setlists, profiles, band_members)
	const { error } = await adminClient.auth.admin.deleteUser(userId);
	if (error) {
		console.warn(`Cleanup warning: failed to delete user ${userId}:`, error.message);
	}
}
