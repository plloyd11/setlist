import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const SESSIONS_SHOWN = 30;

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session } = await safeGetSession();
	if (!session) throw error(401, 'Not authenticated');

	// RLS already limits these to the caller's own practice
	const [{ data: sessions, error: sessionsError }, { data: todos }] = await Promise.all([
		supabase
			.from('practice_sessions')
			.select(
				'id, started_at, practice_session_items(id, kind, label, practice_seconds, run_seconds, song_id, exercise_id, skill_id)'
			)
			.order('started_at', { ascending: false })
			.limit(SESSIONS_SHOWN),
		supabase
			.from('song_practice')
			.select('song_id, status, note, songs(title)')
			.neq('status', 'solid')
			.order('updated_at', { ascending: false })
	]);
	if (sessionsError) throw error(500, 'Could not load your practice log. Please try again.');

	return {
		sessions: (sessions ?? []).map((s) => ({
			id: s.id,
			startedAt: s.started_at,
			items: s.practice_session_items
		})),
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
