import { fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Song, SongAudio, SongFile } from '$lib/types/database';
import { parseDuration } from '$lib/utils/duration';
import { processSongAudioDelete, processSongAudioUpload } from '$lib/server/songAudio';
import { processSongFileDelete, processSongFileUpload } from '$lib/server/songFiles';

export type SongWithAudio = Song & {
	song_audio: Omit<SongAudio, 'waveform_peaks'>[];
	song_files: SongFile[];
};

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		return { songs: [] as SongWithAudio[] };
	}

	// Embed audio variants and charts; peaks excluded to keep the list payload small
	const { data: songs } = await supabase
		.from('songs')
		.select(
			'*, song_audio(id, song_id, label, storage_path, file_name, mime_type, file_size_bytes, duration_seconds, created_at), song_files(*)'
		)
		.eq('user_id', session.user.id)
		.order('title', { ascending: true })
		.order('created_at', { referencedTable: 'song_audio', ascending: true })
		.order('created_at', { referencedTable: 'song_files', ascending: true });

	return { songs: (songs ?? []) as SongWithAudio[] };
};

export const actions: Actions = {
	delete: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Song ID is required' });
		}

		// Cleanup order keeps every failure mode consistent: attachment ROWS go
		// first (a later failure leaves the song attachment-less but never
		// pointing at deleted objects), then OBJECTS (the storage delete policy
		// authorizes via the songs table, so this must precede the song row —
		// afterwards the objects would be unreachable forever), then the song.
		const { data: audioRows } = await supabase
			.from('song_audio')
			.delete()
			.eq('song_id', id)
			.select('storage_path');
		if (audioRows?.length) {
			const { error: storageError } = await supabase.storage
				.from('song-audio')
				.remove(audioRows.map((r) => r.storage_path));
			if (storageError) {
				console.warn('song-audio cleanup failed:', storageError.message);
			}
		}

		const { data: fileRows } = await supabase
			.from('song_files')
			.delete()
			.eq('song_id', id)
			.select('storage_path');
		if (fileRows?.length) {
			const { error: storageError } = await supabase.storage
				.from('song-files')
				.remove(fileRows.map((r) => r.storage_path));
			if (storageError) {
				console.warn('song-files cleanup failed:', storageError.message);
			}
		}

		// Explicit user_id scope plus .select() so an RLS-filtered no-op is
		// reported instead of faking success.
		const { data: deletedRows, error } = await supabase
			.from('songs')
			.delete()
			.eq('id', id)
			.eq('user_id', session.user.id)
			.select('id');

		if (error || !deletedRows?.length) {
			return fail(error ? 500 : 404, { error: 'Failed to delete song' });
		}

		return { deleted: true };
	},

	updateSong: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const song_id = formData.get('song_id') as string;
		const title = (formData.get('title') as string) ?? '';
		const durationRaw = (formData.get('duration') as string) ?? '';
		const notes = (formData.get('notes') as string) || null;

		if (!song_id) {
			return fail(400, { error: 'Song ID is required' });
		}
		if (!title.trim()) {
			return fail(400, { error: 'Title is required' });
		}
		const durationSeconds = parseDuration(durationRaw);
		if (durationSeconds === null) {
			return fail(400, { error: 'Duration must be in mm:ss format (e.g., 3:45)' });
		}

		// Explicit user_id scope plus .select() so an RLS-filtered no-op is
		// reported instead of faking success.
		const { data: updatedRows, error } = await supabase
			.from('songs')
			.update({
				title: title.trim(),
				duration_seconds: durationSeconds,
				notes: notes?.trim() || null
			})
			.eq('id', song_id)
			.eq('user_id', session.user.id)
			.select('id');

		if (error || !updatedRows?.length) {
			return fail(error ? 500 : 404, { error: 'Failed to update song' });
		}

		return { updated: true };
	},

	uploadAudio: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		return processSongAudioUpload(supabase, request);
	},

	deleteAudio: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		return processSongAudioDelete(supabase, request);
	},

	uploadFile: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		return processSongFileUpload(supabase, request);
	},

	deleteFile: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		return processSongFileDelete(supabase, request);
	}
};
