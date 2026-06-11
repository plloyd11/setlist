import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { processTrackUpload } from '$lib/server/tracks';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({
	params,
	url,
	locals: { supabase, safeGetSession }
}) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	// One small query powers the folder rows, the breadcrumb walk, and the
	// Move-to dialog tree — folder counts per band are tiny.
	const { data: foldersRaw, error: foldersError } = await supabase
		.from('track_folders')
		.select('id, parent_id, name')
		.eq('band_id', params.id);

	if (foldersError) {
		throw error(500, 'Could not load folders. Please try again.');
	}

	const allFolders = (foldersRaw ?? []).sort((a, b) =>
		a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
	);
	const folderMap = new Map(allFolders.map((f) => [f.id, f]));

	// RLS already scopes the fetch to the member's bands, so "not in the list"
	// covers bogus, foreign, and freshly deleted folder ids alike.
	const folderParam = url.searchParams.get('folder');
	const currentFolder = folderParam ? (folderMap.get(folderParam) ?? null) : null;
	if (folderParam && !currentFolder) {
		throw error(404, 'Folder not found');
	}

	const breadcrumb: { id: string; name: string }[] = [];
	let cursor = currentFolder;
	while (cursor) {
		breadcrumb.unshift({ id: cursor.id, name: cursor.name });
		cursor = cursor.parent_id ? (folderMap.get(cursor.parent_id) ?? null) : null;
	}

	// waveform_peaks intentionally excluded — the list never renders waveforms.
	// All band tracks come back in one query; the current location's tracks and
	// the per-folder recursive counts are derived in memory.
	const { data: tracksRaw, error: tracksError } = await supabase
		.from('tracks')
		.select(
			'id, folder_id, title, description, created_by, created_at, updated_at, track_versions(version_number, duration_seconds, uploaded_by, created_at)'
		)
		.eq('band_id', params.id)
		.order('updated_at', { ascending: false });

	// A failed query must not masquerade as "No tracks yet"
	if (tracksError) {
		throw error(500, 'Could not load tracks. Please try again.');
	}

	const childrenOf = new Map<string | null, typeof allFolders>();
	for (const f of allFolders) {
		const siblings = childrenOf.get(f.parent_id) ?? [];
		siblings.push(f);
		childrenOf.set(f.parent_id, siblings);
	}

	const directTrackCounts = new Map<string, number>();
	for (const t of tracksRaw ?? []) {
		if (t.folder_id) {
			directTrackCounts.set(t.folder_id, (directTrackCounts.get(t.folder_id) ?? 0) + 1);
		}
	}

	// Recursive counts: "Demos (12)" should count everything inside, not read
	// "(0)" because the tracks live in subfolders. Depth is capped at 5.
	const subtreeCount = (folderId: string): number => {
		let total = directTrackCounts.get(folderId) ?? 0;
		for (const child of childrenOf.get(folderId) ?? []) {
			total += subtreeCount(child.id);
		}
		return total;
	};

	const folders = (childrenOf.get(currentFolder?.id ?? null) ?? []).map((f) => ({
		id: f.id,
		name: f.name,
		trackCount: subtreeCount(f.id)
	}));

	const tracks = (tracksRaw ?? [])
		.filter((t) => (t.folder_id ?? null) === (currentFolder?.id ?? null))
		.map((t) => {
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

	// Profiles can't be embedded (FKs point at auth.users) — two-step fetch,
	// restricted to the tracks actually displayed at this location
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
		})),
		folders,
		allFolders,
		currentFolder: currentFolder
			? { id: currentFolder.id, name: currentFolder.name, parent_id: currentFolder.parent_id }
			: null,
		breadcrumb
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
	},

	createFolder: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}
		const formData = await request.formData();
		const name = ((formData.get('name') as string) ?? '').trim();
		const parentId = ((formData.get('parent_id') as string) ?? '').trim();
		if (!name) {
			return fail(400, { error: 'Folder name is required' });
		}
		if (parentId && !UUID_RE.test(parentId)) {
			return fail(400, { error: 'Invalid folder' });
		}

		const { error: rpcError } = await supabase.rpc('create_track_folder', {
			p_band_id: params.id,
			p_parent_id: parentId || null,
			p_name: name
		});
		if (rpcError) {
			// RPC raises carry user-facing messages (duplicate name, depth cap)
			return fail(400, { error: rpcError.message || 'Could not create folder' });
		}
		return { success: true };
	},

	renameFolder: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}
		const formData = await request.formData();
		const folderId = ((formData.get('folder_id') as string) ?? '').trim();
		const name = ((formData.get('name') as string) ?? '').trim();
		if (!UUID_RE.test(folderId)) {
			return fail(400, { error: 'Invalid folder' });
		}
		if (!name) {
			return fail(400, { error: 'Folder name is required' });
		}

		// Plain update: RLS scopes to band members, the column grant restricts
		// to (name, updated_at) — reparenting is move_folder()'s job
		const { data: updated, error: updateError } = await supabase
			.from('track_folders')
			.update({ name, updated_at: new Date().toISOString() })
			.eq('id', folderId)
			.eq('band_id', params.id)
			.select('id');
		if (updateError) {
			if (updateError.code === '23505') {
				return fail(400, { error: 'A folder with that name already exists here' });
			}
			return fail(500, { error: 'Could not rename folder' });
		}
		if (!updated?.length) {
			return fail(404, { error: 'Folder not found' });
		}
		return { success: true };
	},

	moveTrack: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}
		const formData = await request.formData();
		const trackId = ((formData.get('track_id') as string) ?? '').trim();
		const folderId = ((formData.get('folder_id') as string) ?? '').trim(); // '' = root
		if (!UUID_RE.test(trackId) || (folderId && !UUID_RE.test(folderId))) {
			return fail(400, { error: 'Invalid request' });
		}

		const { error: rpcError } = await supabase.rpc('move_track', {
			p_band_id: params.id,
			p_track_id: trackId,
			p_folder_id: folderId || null
		});
		if (rpcError) {
			return fail(400, { error: rpcError.message || 'Could not move track' });
		}
		return { success: true };
	},

	moveFolder: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}
		const formData = await request.formData();
		const folderId = ((formData.get('folder_id') as string) ?? '').trim();
		const parentId = ((formData.get('parent_id') as string) ?? '').trim(); // '' = root
		if (!UUID_RE.test(folderId) || (parentId && !UUID_RE.test(parentId))) {
			return fail(400, { error: 'Invalid request' });
		}

		const { error: rpcError } = await supabase.rpc('move_folder', {
			p_band_id: params.id,
			p_folder_id: folderId,
			p_new_parent_id: parentId || null
		});
		if (rpcError) {
			// Cycle, depth, and duplicate-name raises are all user-facing
			return fail(400, { error: rpcError.message || 'Could not move folder' });
		}
		return { success: true };
	},

	deleteFolder: async ({ params, request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) {
			return fail(401, { error: 'Not authenticated' });
		}
		const formData = await request.formData();
		const folderId = ((formData.get('folder_id') as string) ?? '').trim();
		if (!UUID_RE.test(folderId)) {
			return fail(400, { error: 'Invalid folder' });
		}

		const { error: rpcError } = await supabase.rpc('delete_track_folder', {
			p_band_id: params.id,
			p_folder_id: folderId
		});
		if (rpcError) {
			return fail(400, { error: rpcError.message || 'Could not delete folder' });
		}
		return { success: true };
	}
};
