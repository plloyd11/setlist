import { adminClient } from './supabase-admin';

/**
 * Safely delete a row from a table by ID.
 * Wraps the delete in try/catch -- cleanup failures warn but never throw,
 * so stale data does not fail the test run.
 */
export async function safeDelete(table: string, id: string) {
	try {
		const { error } = await adminClient.from(table).delete().eq('id', id);
		if (error) {
			console.warn(`Cleanup warning [${table}/${id}]:`, error.message);
		}
	} catch (e) {
		console.warn(`Cleanup warning [${table}/${id}]:`, e);
	}
}
