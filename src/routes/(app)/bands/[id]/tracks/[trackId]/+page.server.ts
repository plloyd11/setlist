import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { processTrackUpload } from '$lib/server/tracks';

const SIGNED_URL_TTL = 21600; // 6h — outlives any realistic listening session

export const load: PageServerLoad = async ({
	params,
	url,
	locals: { supabase, safeGetSession }
}) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	const { data: track } = await supabase
		.from('tracks')
		.select('*')
		.eq('id', params.trackId)
		.eq('band_id', params.id)
		.single();

	if (!track) {
		throw error(404, 'Track not found');
	}

	const { data: versionsRaw, error: versionsError } = await supabase
		.from('track_versions')
		.select('*')
		.eq('track_id', track.id)
		.order('version_number', { ascending: false });

	if (versionsError) {
		throw error(500, 'Could not load track versions. Please try again.');
	}

	const versions = versionsRaw ?? [];
	if (versions.length === 0) {
		throw error(404, 'Track has no versions');
	}

	const requested = Number(url.searchParams.get('version'));
	const selectedVersion = versions.find((v) => v.version_number === requested) ?? versions[0];

	const [{ data: signed }, { data: commentsRaw, error: commentsError }] = await Promise.all([
		supabase.storage.from('tracks').createSignedUrl(selectedVersion.storage_path, SIGNED_URL_TTL),
		supabase
			.from('track_comments')
			.select('*')
			.eq('version_id', selectedVersion.id)
			.order('created_at')
	]);

	// A failed query must not masquerade as "No feedback yet" — the band's
	// comments would silently appear deleted
	if (commentsError) {
		throw error(500, 'Could not load feedback. Please try again.');
	}

	const comments = commentsRaw ?? [];

	// Profiles can't be embedded (FKs point at auth.users) — two-step fetch
	const userIds = [
		...new Set(
			[
				track.created_by,
				...versions.map((v) => v.uploaded_by),
				...comments.flatMap((c) => [c.author_id, c.resolved_by])
			].filter((id): id is string => !!id)
		)
	];
	const { data: profiles } = userIds.length
		? await supabase.from('profiles').select('id, display_name, logo_url').in('id', userIds)
		: { data: [] };

	return {
		track,
		// Peaks are only rendered for the selected version — drop the rest to
		// keep the payload small
		versions: versions.map((v) =>
			v.id === selectedVersion.id ? v : { ...v, waveform_peaks: null }
		),
		selectedVersion,
		signedUrl: signed?.signedUrl ?? null,
		comments,
		profiles: Object.fromEntries((profiles ?? []).map((p) => [p.id, p])),
		currentUserId: session.user.id
	};
};

export const actions: Actions = {
	uploadVersion: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}
		return processTrackUpload(supabase, request, params.id, params.trackId);
	},

	deleteTrack: async ({ params, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		// Collect storage paths before the version rows cascade away
		const { data: versions } = await supabase
			.from('track_versions')
			.select('storage_path')
			.eq('track_id', params.trackId);

		// RLS restricts deletion to the track creator or band owner;
		// .select() reports an RLS-filtered no-op as a failure
		const { data: deletedRows, error: deleteError } = await supabase
			.from('tracks')
			.delete()
			.eq('id', params.trackId)
			.eq('band_id', params.id)
			.select('id, folder_id');

		if (deleteError || !deletedRows?.length) {
			return fail(deleteError ? 500 : 403, { error: 'Failed to delete track' });
		}

		const folderId = deletedRows[0].folder_id;

		// Best-effort audio cleanup — DB rows are already gone, so a failure
		// here only leaves orphaned storage objects (accepted tradeoff)
		const paths = (versions ?? []).map((v) => v.storage_path);
		if (paths.length) {
			const { error: storageError } = await supabase.storage.from('tracks').remove(paths);
			if (storageError) {
				console.warn(`Failed to remove track audio for ${params.trackId}:`, storageError.message);
			}
		}

		// Land back in the folder the track lived in, not at the root
		throw redirect(303, `/bands/${params.id}/tracks${folderId ? `?folder=${folderId}` : ''}`);
	},

	addComment: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const body = ((formData.get('body') as string) ?? '').trim();
		const versionId = formData.get('version_id') as string;
		const parentId = ((formData.get('parent_id') as string) || null) as string | null;
		const timestampRaw = (formData.get('timestamp_seconds') as string) || null;

		if (!body) {
			return fail(400, { error: 'Comment cannot be empty' });
		}
		if (!versionId) {
			return fail(400, { error: 'Version ID is required' });
		}

		// Scope the version to this route's track
		const { data: version } = await supabase
			.from('track_versions')
			.select('id, duration_seconds')
			.eq('id', versionId)
			.eq('track_id', params.trackId)
			.single();

		if (!version) {
			return fail(404, { error: 'Version not found' });
		}

		let timestamp: number | null = null;
		if (timestampRaw) {
			const parsed = Number(timestampRaw);
			if (!Number.isFinite(parsed) || parsed < 0) {
				return fail(400, { error: 'Invalid timestamp' });
			}
			if (version.duration_seconds != null && parsed > version.duration_seconds) {
				return fail(400, { error: 'Timestamp is beyond the end of the track' });
			}
			timestamp = parsed;
		}

		if (parentId) {
			const { data: parent } = await supabase
				.from('track_comments')
				.select('id, parent_id, version_id')
				.eq('id', parentId)
				.single();

			if (!parent || parent.version_id !== versionId) {
				return fail(400, { error: 'Invalid parent comment' });
			}
			// One-level threading: replies to replies are not allowed, and
			// replies inherit context from their parent instead of a timestamp
			if (parent.parent_id) {
				return fail(400, { error: 'Replies cannot be nested further' });
			}
			timestamp = null;
		}

		const { error: insertError } = await supabase.from('track_comments').insert({
			version_id: versionId,
			parent_id: parentId,
			author_id: session.user.id,
			body,
			timestamp_seconds: timestamp
		});

		if (insertError) {
			return fail(500, { error: 'Failed to post comment' });
		}

		return { commented: true };
	},

	resolveComment: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const commentId = formData.get('comment_id') as string;
		if (!commentId) {
			return fail(400, { error: 'Comment ID is required' });
		}

		const { data: updatedRows, error: updateError } = await supabase
			.from('track_comments')
			.update({ resolved_at: new Date().toISOString(), resolved_by: session.user.id })
			.eq('id', commentId)
			.select('id');

		if (updateError || !updatedRows?.length) {
			return fail(updateError ? 500 : 404, { error: 'Failed to resolve comment' });
		}

		return { resolved: true };
	},

	unresolveComment: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const commentId = formData.get('comment_id') as string;
		if (!commentId) {
			return fail(400, { error: 'Comment ID is required' });
		}

		const { data: updatedRows, error: updateError } = await supabase
			.from('track_comments')
			.update({ resolved_at: null, resolved_by: null })
			.eq('id', commentId)
			.select('id');

		if (updateError || !updatedRows?.length) {
			return fail(updateError ? 500 : 404, { error: 'Failed to reopen comment' });
		}

		return { unresolved: true };
	},

	deleteComment: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}

		const formData = await request.formData();
		const commentId = formData.get('comment_id') as string;
		if (!commentId) {
			return fail(400, { error: 'Comment ID is required' });
		}

		// RLS restricts deletion to the comment author or band owner
		const { data: deletedRows, error: deleteError } = await supabase
			.from('track_comments')
			.delete()
			.eq('id', commentId)
			.select('id');

		if (deleteError || !deletedRows?.length) {
			return fail(deleteError ? 500 : 403, { error: 'Failed to delete comment' });
		}

		return { deleted: true };
	}
};
