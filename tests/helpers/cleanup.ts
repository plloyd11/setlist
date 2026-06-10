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

/**
 * Remove all uploaded track audio for a band from the 'tracks' storage bucket.
 * Storage objects do not cascade with DB rows, so band/track deletion leaves
 * them behind. Warn-not-throw, like all cleanup helpers.
 */
export async function cleanupTrackAudio(bandId: string) {
	const prefix = `bands/${bandId}/tracks`;
	try {
		const { data: objects, error } = await adminClient.storage.from('tracks').list(prefix);
		if (error) {
			console.warn(`Cleanup warning [tracks storage/${bandId}]:`, error.message);
			return;
		}
		if (objects?.length) {
			const { error: removeError } = await adminClient.storage
				.from('tracks')
				.remove(objects.map((o) => `${prefix}/${o.name}`));
			if (removeError) {
				console.warn(`Cleanup warning [tracks storage/${bandId}]:`, removeError.message);
			}
		}
	} catch (e) {
		console.warn(`Cleanup warning [tracks storage/${bandId}]:`, e);
	}
}
