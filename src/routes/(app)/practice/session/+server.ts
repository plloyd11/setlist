import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseProgress, saveProgress } from '#lib/server/practice.js';

/**
 * Saves practice progress from any screen, including as the page closes (keepalive),
 * which rules out a page-specific form action. Saves are idempotent: the tracker sends
 * running totals under ids it generated, so a retry can't double-count.
 */
export const POST: RequestHandler = async ({ request, locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) throw error(401, 'Not authenticated');

	const progress = parseProgress(await request.json().catch(() => null));
	if (!progress) throw error(400, 'Invalid practice data');

	if (!(await saveProgress(supabase, session.user.id, progress))) {
		throw error(500, 'Could not save practice');
	}
	return Response.json({ saved: true });
};
