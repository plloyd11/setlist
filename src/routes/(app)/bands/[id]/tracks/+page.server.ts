import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { processTrackUpload } from '$lib/server/tracks';

export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// waveform_peaks intentionally excluded — the list never renders waveforms
	const { data: tracksRaw, error: tracksError } = await supabase
		.from('tracks')
		.select(
			'id, title, description, created_by, created_at, updated_at, track_versions(version_number, duration_seconds, uploaded_by, created_at)'
		)
		.eq('band_id', params.id)
		.order('updated_at', { ascending: false });

	// A failed query must not masquerade as "No tracks yet"
	if (tracksError) {
		throw error(500, 'Could not load tracks. Please try again.');
	}

	const tracks = (tracksRaw ?? []).map((t) => {
		const versions = [...(t.track_versions ?? [])].sort(
			(a, b) => b.version_number - a.version_number
		);
		const latest = versions[0] ?? null;
		return {
			id: t.id,
			title: t.title,
			description: t.description,
			created_by: t.created_by,
			created_at: t.created_at,
			updated_at: t.updated_at,
			versionCount: versions.length,
			latestVersion: latest
		};
	});

	// Profiles can't be embedded (FKs point at auth.users) — two-step fetch
	const userIds = [
		...new Set(
			tracks
				.flatMap((t) => [t.created_by, t.latestVersion?.uploaded_by])
				.filter((id): id is string => !!id)
		)
	];
	const { data: profiles } = userIds.length
		? await supabase.from('profiles').select('id, display_name, logo_url').in('id', userIds)
		: { data: [] };

	const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

	return {
		tracks: tracks.map((t) => ({
			...t,
			uploaderProfile: t.latestVersion?.uploaded_by
				? (profileMap.get(t.latestVersion.uploaded_by) ?? null)
				: null
		}))
	};
};

export const actions: Actions = {
	upload: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}
		// List page only ever creates new tracks (trackId null); new versions go
		// through the detail page's uploadVersion action.
		return processTrackUpload(supabase, request, params.id, null);
	}
};
