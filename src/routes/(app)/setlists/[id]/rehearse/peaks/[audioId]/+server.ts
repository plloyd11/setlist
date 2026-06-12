import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Lazy waveform peaks for one audio variant. The rehearse load deliberately
 * excludes peaks (~10KB per variant adds up fast on long setlists); the page
 * fetches them here only for the variant about to play. RLS gates access the
 * same way the rest of song_audio does (owner + band members of the song).
 */
export const GET: RequestHandler = async ({ params, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) {
		throw error(401, 'Not authenticated');
	}

	const { data, error: queryError } = await supabase
		.from('song_audio')
		.select('waveform_peaks')
		.eq('id', params.audioId)
		.maybeSingle();

	if (queryError || !data) {
		throw error(404, 'Audio not found');
	}

	return json(
		{ peaks: data.waveform_peaks ?? null },
		// Peaks are immutable per variant (uploads never overwrite), so a
		// session-length private cache is safe
		{ headers: { 'cache-control': 'private, max-age=21600' } }
	);
};
