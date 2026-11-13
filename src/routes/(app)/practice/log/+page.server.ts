import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { editSession } from '#lib/server/practice.js';
import { loadPracticeLog } from '#lib/server/practiceLog.js';
import { TIME_ZONE_COOKIE, isTimeZone, todayInZone } from '#lib/utils/gigDate.js';
import { isLogDate, isLogRange } from '#lib/utils/practiceLog.js';

export const load: PageServerLoad = async ({
	cookies,
	url,
	locals: { supabase, safeGetSession }
}) => {
	const { session } = await safeGetSession();
	if (!session) throw error(401, 'Not authenticated');

	// A session belongs to the day it started where the musician is, not where this
	// server runs. The page sends its zone if the cookie is missing or stale.
	const zoneCookie = cookies.get(TIME_ZONE_COOKIE);
	const timeZone = isTimeZone(zoneCookie) ? zoneCookie : null;
	const range = url.searchParams.get('range');
	const at = url.searchParams.get('at');

	// RLS already limits these to the caller's own practice
	const [log, { data: todos }] = await Promise.all([
		loadPracticeLog(supabase, {
			range: isLogRange(range) ? range : 'week',
			at: isLogDate(at) ? at : null,
			today: todayInZone(timeZone),
			timeZone
		}),
		supabase
			.from('song_practice')
			.select('song_id, status, note, songs(title)')
			.neq('status', 'solid')
			.order('updated_at', { ascending: false })
	]);
	if (!log) throw error(500, 'Could not load your practice log. Please try again.');

	const { sessions, ...summary } = log;
	return {
		timeZone,
		log: summary,
		sessions,
		todos: (todos ?? [])
			.map((t) => ({
				songId: t.song_id,
				status: t.status as 'learning' | 'needs_work',
				note: t.note as string | null,
				title: (t.songs as unknown as { title: string } | null)?.title ?? null
			}))
			.filter((t): t is typeof t & { title: string } => t.title !== null)
	};
};

export const actions: Actions = {
	/** Corrections to one session: the clock is started by hand, so it's sometimes wrong */
	edit: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session } = await safeGetSession();
		if (!session) return fail(401, { error: 'Not authenticated' });

		const edited = await editSession(supabase, await request.formData());
		if (typeof edited === 'string') return fail(400, { error: edited });
		return { edited };
	}
};
