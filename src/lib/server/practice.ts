import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 100;
const MAX_SECONDS = 86_400;
const MAX_LABEL_LENGTH = 200;
const MAX_NOTE_LENGTH = 2000;

type Kind = 'song' | 'exercise' | 'skill';

export interface ProgressItem {
	id: string;
	kind: Kind;
	ref_id: string | null;
	label: string;
	practice_seconds: number;
	run_seconds: number | null;
	run_source: 'audio' | 'stopwatch' | null;
	length_before_apply: number | null;
	note: string | null;
}

export interface Progress {
	session: { id: string; started_at: string; last_active_at: string };
	items: ProgressItem[];
}

const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

function seconds(v: unknown): number | null {
	if (v === null || v === undefined) return null;
	const n = Number(v);
	return Number.isInteger(n) && n >= 0 && n <= MAX_SECONDS ? n : null;
}

function timestamp(v: unknown): string | null {
	if (typeof v !== 'string') return null;
	const time = Date.parse(v);
	// A client clock can be a little ahead, but not a day ahead
	return Number.isFinite(time) && time < Date.now() + MAX_SECONDS * 1000
		? new Date(time).toISOString()
		: null;
}

/** Validate what the practice tracker sends. Null means the whole payload is bad. */
export function parseProgress(body: unknown): Progress | null {
	if (!body || typeof body !== 'object') return null;
	const { session, items } = body as { session?: Record<string, unknown>; items?: unknown };
	if (!session || !isUuid(session.id) || !Array.isArray(items) || items.length > MAX_ITEMS) {
		return null;
	}
	const startedAt = timestamp(session.started_at);
	const lastActiveAt = timestamp(session.last_active_at);
	if (!startedAt || !lastActiveAt) return null;

	const parsed: ProgressItem[] = [];
	for (const raw of items as Record<string, unknown>[]) {
		const label = typeof raw?.label === 'string' ? raw.label.trim() : '';
		const practice = seconds(raw?.practice_seconds);
		if (
			!isUuid(raw?.id) ||
			!['song', 'exercise', 'skill'].includes(raw?.kind as string) ||
			!label ||
			label.length > MAX_LABEL_LENGTH ||
			practice === null
		) {
			return null;
		}
		const run = seconds(raw.run_seconds);
		parsed.push({
			id: raw.id,
			kind: raw.kind as Kind,
			ref_id: isUuid(raw.ref_id) ? raw.ref_id : null,
			label,
			practice_seconds: practice,
			run_seconds: run && run > 0 ? run : null,
			run_source:
				raw.run_source === 'stopwatch' || raw.run_source === 'audio' ? raw.run_source : null,
			length_before_apply: seconds(raw.length_before_apply),
			note: typeof raw.note === 'string' ? raw.note.slice(0, MAX_NOTE_LENGTH) : null
		});
	}
	return {
		session: { id: session.id, started_at: startedAt, last_active_at: lastActiveAt },
		items: parsed
	};
}

/** Ids the caller can still see. RLS decides, so a song deleted or unshared since the
 * session started just loses its link, rather than failing the whole save. */
async function visibleIds(supabase: SupabaseClient, table: string, ids: string[]) {
	if (ids.length === 0) return new Set<string>();
	const { data } = await supabase.from(table).select('id').in('id', ids);
	return new Set((data ?? []).map((row) => row.id as string));
}

export async function saveProgress(
	supabase: SupabaseClient,
	userId: string,
	progress: Progress
): Promise<boolean> {
	const refs = (kind: Kind) =>
		progress.items.filter((i) => i.kind === kind && i.ref_id).map((i) => i.ref_id as string);
	const [songs, exercises, skills] = await Promise.all([
		visibleIds(supabase, 'songs', refs('song')),
		visibleIds(supabase, 'exercises', refs('exercise')),
		visibleIds(supabase, 'skills', refs('skill'))
	]);

	const { error: sessionError } = await supabase
		.from('practice_sessions')
		.upsert({ ...progress.session, user_id: userId }, { onConflict: 'id' });
	if (sessionError) return false;
	if (progress.items.length === 0) return true;

	const { error: itemsError } = await supabase.from('practice_session_items').upsert(
		progress.items.map((item) => ({
			id: item.id,
			session_id: progress.session.id,
			kind: item.kind,
			song_id: item.kind === 'song' && songs.has(item.ref_id ?? '') ? item.ref_id : null,
			exercise_id:
				item.kind === 'exercise' && exercises.has(item.ref_id ?? '') ? item.ref_id : null,
			skill_id: item.kind === 'skill' && skills.has(item.ref_id ?? '') ? item.ref_id : null,
			label: item.label,
			practice_seconds: item.practice_seconds,
			run_seconds: item.run_seconds,
			run_source: item.run_source,
			length_before_apply: item.length_before_apply,
			note: item.note
		})),
		{ onConflict: 'id' }
	);
	return !itemsError;
}
