import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The account's copy of the IRs a musician has uploaded, so they follow them to
 * another device (table `rig_irs`, private bucket `rig-irs`). The rig still plays
 * from the browser's own copy (rigStore) and syncs against this one.
 *
 * Everything goes through the user-scoped browser client: RLS says whose, and the
 * table's CHECKs say what, so there's no server code in between. Only uploaded IRs
 * come here. TONE3000's files stay on the device they were picked on, and so do amp
 * models and rig settings.
 */

const BUCKET = 'rig-irs';

export interface CloudIr {
	id: string;
	name: string;
}

export interface RigCloud {
	/** Whose account this is, to tell their IRs from anyone else's in this browser */
	userId: string;
	list(): Promise<CloudIr[]>;
	download(id: string): Promise<ArrayBuffer>;
	/** Safe to repeat: an upload that was cut short picks up where it stopped */
	upload(id: string, name: string, bytes: ArrayBuffer): Promise<void>;
	rename(id: string, name: string): Promise<void>;
	remove(id: string): Promise<void>;
}

/** The object, or the row, is there already: an earlier try got that far */
function alreadyThere(error: { message?: string; statusCode?: string; code?: string }): boolean {
	return (
		error.statusCode === '409' ||
		error.code === '23505' ||
		/already exists|duplicate/i.test(error.message ?? '')
	);
}

export function createRigCloud(supabase: SupabaseClient, userId: string): RigCloud {
	const pathFor = (id: string) => `users/${userId}/${id}.wav`;

	return {
		userId,

		async list() {
			const { data, error } = await supabase
				.from('rig_irs')
				.select('id, name')
				.order('created_at', { ascending: true });
			if (error) throw error;
			return (data ?? []) as CloudIr[];
		},

		async download(id) {
			const { data, error } = await supabase.storage.from(BUCKET).download(pathFor(id));
			if (error || !data) throw error ?? new Error('IR missing from storage');
			return data.arrayBuffer();
		},

		async upload(id, name, bytes) {
			// The file first: a row always has something to point at
			const { error: storageError } = await supabase.storage
				.from(BUCKET)
				.upload(pathFor(id), bytes, { contentType: 'audio/wav' });
			if (storageError && !alreadyThere(storageError)) throw storageError;

			const { error } = await supabase.from('rig_irs').insert({
				id,
				user_id: userId,
				name,
				storage_path: pathFor(id),
				file_size_bytes: bytes.byteLength
			});
			if (error && !alreadyThere(error)) throw error;
		},

		async rename(id, name) {
			// .select() so a change RLS filtered out fails loudly instead of faking success
			const { data, error } = await supabase
				.from('rig_irs')
				.update({ name })
				.eq('id', id)
				.select('id');
			if (error || !data?.length) throw error ?? new Error('IR not found');
		},

		async remove(id) {
			const { error } = await supabase.from('rig_irs').delete().eq('id', id);
			if (error) throw error;
			// Best effort, as with song files: a failure leaves an object nothing points at
			await supabase.storage.from(BUCKET).remove([pathFor(id)]);
		}
	};
}
