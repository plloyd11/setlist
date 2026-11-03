import type { SupabaseClient } from '@supabase/supabase-js';

// 6h: outlives any realistic practice session; WaveformPlayer's onloaderror path
// covers the rare mid-session expiry.
export const SIGNED_URL_TTL = 21600;

/**
 * One round-trip signs a whole bucket's worth of paths. Per-path failures (deleted
 * object, revoked access) come back as null and render as unavailable. Goes through
 * the caller's user-scoped client, so RLS gates access before a URL exists.
 */
export async function signAll(
	supabase: SupabaseClient,
	bucket: string,
	paths: string[]
): Promise<Map<string, string | null>> {
	const byPath = new Map<string, string | null>();
	if (paths.length === 0) return byPath;
	const { data: signed } = await supabase.storage
		.from(bucket)
		.createSignedUrls(paths, SIGNED_URL_TTL);
	for (const entry of signed ?? []) {
		if (entry.path) byPath.set(entry.path, entry.error ? null : entry.signedUrl);
	}
	return byPath;
}
