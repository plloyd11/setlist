import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { signAll } from '#lib/server/songMedia.js';
import { safeInternalPath } from '#lib/utils/safeRedirect.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Each take ships its waveform inline. Older ones stay on the demo's own page. */
const MAX_VERSIONS = 10;

export const load: PageServerLoad = async ({
	params,
	url,
	locals: { supabase, safeGetSession }
}) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}
	if (!UUID_RE.test(params.id)) {
		throw error(404, 'Demo not found');
	}

	// No band filter: RLS only returns demos from bands you're in
	const [{ data: track }, { data: versions, error: versionsError }] = await Promise.all([
		supabase.from('tracks').select('id, band_id, title, description').eq('id', params.id).single(),
		supabase
			.from('track_versions')
			.select(
				'id, version_number, storage_path, file_name, mime_type, file_size_bytes, duration_seconds, waveform_peaks, created_at'
			)
			.eq('track_id', params.id)
			.order('version_number', { ascending: false })
			.limit(MAX_VERSIONS)
	]);

	if (!track) {
		throw error(404, 'Demo not found');
	}
	if (versionsError) {
		throw error(500, 'Could not load this demo. Please try again.');
	}
	if (!versions?.length) {
		throw error(404, 'Demo has no versions');
	}

	const urls = await signAll(
		supabase,
		'tracks',
		versions.map((v) => v.storage_path)
	);

	return {
		track,
		variants: versions.map(({ version_number, ...v }, i) => ({
			...v,
			label: i === 0 ? `Version ${version_number} (latest)` : `Version ${version_number}`,
			signedUrl: urls.get(v.storage_path) ?? null
		})),
		backHref: safeInternalPath(url.searchParams.get('from'), '/practice/shed')
	};
};
