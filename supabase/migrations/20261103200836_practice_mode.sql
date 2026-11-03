-- ============================================================================
-- Practice mode: warm-ups, skills, song status and practice history.
--
-- Practice data is private to the musician, even for band songs: every table is
-- owner-only. Nothing here touches existing tables except one new nullable column
-- on profiles, so the deployed app is unaffected.
--
-- Deleting a user cascades through all of this. Deleting a song, exercise or skill
-- keeps history: session items hold their own copy of the title.
--
-- Since 2026-10-30 Supabase no longer exposes new public tables automatically, so
-- each table grants access explicitly.
-- ============================================================================

set lock_timeout = '5s';

-- ============================================================================
-- 1. What the musician plays, so drills and lessons can be tailored
-- ============================================================================
alter table public.profiles
  add column instrument text
    check (instrument is null or instrument in ('guitar', 'bass', 'keys', 'drums', 'vocals', 'other'));

-- ============================================================================
-- 2. Skills: a named thing to get better at, with an optional lesson and tempo goal
-- ============================================================================
create table public.skills (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  title text not null check (btrim(title) <> ''),
  notes text,
  goal_bpm integer check (goal_bpm is null or goal_bpm between 1 and 400),
  source text not null default 'own' check (source in ('own', 'curated', 'claude')),
  -- Which curated lesson this came from; the lessons themselves ship in the repo
  curated_key text,
  lesson jsonb check (lesson is null or jsonb_typeof(lesson) = 'object'),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create table public.skill_tempo_logs (
  id uuid default gen_random_uuid() primary key,
  skill_id uuid references public.skills(id) on delete cascade not null,
  bpm integer not null check (bpm between 1 and 400),
  note text,
  logged_at timestamptz default now() not null
);

-- ============================================================================
-- 3. Exercises: warm-ups and skill drills, with optional audio and charts
-- ============================================================================
create table public.exercises (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  skill_id uuid references public.skills(id) on delete set null,
  title text not null check (btrim(title) <> ''),
  notes text,
  target_seconds integer not null default 120 check (target_seconds > 0),
  -- Null means it isn't in the warm-up routine
  routine_position integer check (routine_position is null or routine_position >= 0),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Same columns as song_audio and song_files, so the practice panel takes them unchanged
create table public.exercise_audio (
  id uuid default gen_random_uuid() primary key,
  exercise_id uuid references public.exercises(id) on delete cascade not null,
  label text check (label is null or btrim(label) <> ''),
  storage_path text not null
    check (storage_path like 'exercises/' || exercise_id::text || '/%'),
  file_name text not null check (btrim(file_name) <> ''),
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  duration_seconds double precision check (duration_seconds is null or duration_seconds > 0),
  waveform_peaks jsonb check (waveform_peaks is null or jsonb_typeof(waveform_peaks) = 'array'),
  created_at timestamptz default now() not null
);

create table public.exercise_files (
  id uuid default gen_random_uuid() primary key,
  exercise_id uuid references public.exercises(id) on delete cascade not null,
  label text check (label is null or btrim(label) <> ''),
  storage_path text not null
    check (storage_path like 'exercises/' || exercise_id::text || '/%'),
  file_name text not null check (btrim(file_name) <> ''),
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  created_at timestamptz default now() not null
);

-- ============================================================================
-- 4. Where a musician stands with each song. Its own table, because a status must
--    survive later sessions that skip the song.
-- ============================================================================
create table public.song_practice (
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  song_id uuid references public.songs(id) on delete cascade not null,
  status text not null default 'learning' check (status in ('learning', 'needs_work', 'solid')),
  note text,
  updated_at timestamptz default now() not null,
  primary key (user_id, song_id)
);

-- ============================================================================
-- 5. Practice history
-- ============================================================================
create table public.practice_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null default auth.uid(),
  started_at timestamptz default now() not null,
  last_active_at timestamptz default now() not null,
  ended_at timestamptz
);

create table public.practice_session_items (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.practice_sessions(id) on delete cascade not null,
  kind text not null check (kind in ('song', 'exercise', 'skill')),
  song_id uuid references public.songs(id) on delete set null,
  exercise_id uuid references public.exercises(id) on delete set null,
  skill_id uuid references public.skills(id) on delete set null,
  -- A copy of the title, so history still reads correctly after a delete
  label text not null check (btrim(label) <> ''),
  -- Time spent, loops included. This never becomes a song's length.
  practice_seconds integer not null default 0 check (practice_seconds >= 0),
  -- A full measured run, which can update a song's length
  run_seconds integer check (run_seconds is null or run_seconds > 0),
  run_source text check (run_source is null or run_source in ('audio', 'stopwatch')),
  -- The length before a measured run replaced it, so the change can be undone
  length_before_apply integer,
  note text,
  created_at timestamptz default now() not null
);

-- ============================================================================
-- 6. Indexes: every foreign key, plus the history list
-- ============================================================================
create index skills_user_id_idx on public.skills (user_id);
create index skill_tempo_logs_skill_id_idx on public.skill_tempo_logs (skill_id, logged_at desc);
create index exercises_user_id_idx on public.exercises (user_id);
create index exercises_skill_id_idx on public.exercises (skill_id);
create index exercise_audio_exercise_id_idx on public.exercise_audio (exercise_id);
create index exercise_files_exercise_id_idx on public.exercise_files (exercise_id);
create index song_practice_song_id_idx on public.song_practice (song_id);
create index practice_sessions_user_started_idx on public.practice_sessions (user_id, started_at desc);
create index practice_session_items_session_id_idx on public.practice_session_items (session_id);
create index practice_session_items_song_id_idx on public.practice_session_items (song_id);
create index practice_session_items_exercise_id_idx on public.practice_session_items (exercise_id);
create index practice_session_items_skill_id_idx on public.practice_session_items (skill_id);

-- ============================================================================
-- 7. Row level security: everything is owner-only
-- ============================================================================
alter table public.skills enable row level security;
alter table public.skill_tempo_logs enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_audio enable row level security;
alter table public.exercise_files enable row level security;
alter table public.song_practice enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_session_items enable row level security;

create policy "Owner manages their skills"
  on public.skills for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owner manages their skill tempo logs"
  on public.skill_tempo_logs for all to authenticated
  using (skill_id in (select id from public.skills where user_id = (select auth.uid())))
  with check (skill_id in (select id from public.skills where user_id = (select auth.uid())));

create policy "Owner manages their exercises"
  on public.exercises for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (skill_id is null or skill_id in (select id from public.skills where user_id = (select auth.uid())))
  );

create policy "Owner manages their exercise audio"
  on public.exercise_audio for all to authenticated
  using (exercise_id in (select id from public.exercises where user_id = (select auth.uid())))
  with check (exercise_id in (select id from public.exercises where user_id = (select auth.uid())));

create policy "Owner manages their exercise files"
  on public.exercise_files for all to authenticated
  using (exercise_id in (select id from public.exercises where user_id = (select auth.uid())))
  with check (exercise_id in (select id from public.exercises where user_id = (select auth.uid())));

-- The songs subquery applies songs' own RLS, so you can only track songs you can see
create policy "Owner manages their song status"
  on public.song_practice for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and song_id in (select id from public.songs)
  );

create policy "Owner manages their practice sessions"
  on public.practice_sessions for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Owner manages their practice session items"
  on public.practice_session_items for all to authenticated
  using (session_id in (select id from public.practice_sessions where user_id = (select auth.uid())))
  with check (
    session_id in (select id from public.practice_sessions where user_id = (select auth.uid()))
    and (song_id is null or song_id in (select id from public.songs))
    and (exercise_id is null or exercise_id in (select id from public.exercises where user_id = (select auth.uid())))
    and (skill_id is null or skill_id in (select id from public.skills where user_id = (select auth.uid())))
  );

-- ============================================================================
-- 8. Grants: required for new tables, and anon gets nothing
-- ============================================================================
revoke all on
  public.skills, public.skill_tempo_logs, public.exercises, public.exercise_audio,
  public.exercise_files, public.song_practice, public.practice_sessions,
  public.practice_session_items
  from anon;

grant select, insert, update, delete on
  public.skills, public.skill_tempo_logs, public.exercises, public.exercise_audio,
  public.exercise_files, public.song_practice, public.practice_sessions,
  public.practice_session_items
  to authenticated, service_role;

-- ============================================================================
-- 9. Private storage for exercise audio and charts. Client-side direct upload, as
--    with song-audio and song-files. Guitar Pro files have no registered MIME type,
--    hence application/octet-stream: the real gate is the extension check in the app.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'exercise-files', 'exercise-files', false, 52428800,
  array[
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/aac',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/ogg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
);

create policy "Owner can upload exercise files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'exercise-files'
    and (storage.foldername(name))[1] = 'exercises'
    and (storage.foldername(name))[2] in (
      select id::text from public.exercises where user_id = (select auth.uid())
    )
  );

create policy "Owner can read exercise files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'exercise-files'
    and (storage.foldername(name))[1] = 'exercises'
    and (storage.foldername(name))[2] in (
      select id::text from public.exercises where user_id = (select auth.uid())
    )
  );

create policy "Owner can delete exercise files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'exercise-files'
    and (storage.foldername(name))[1] = 'exercises'
    and (storage.foldername(name))[2] in (
      select id::text from public.exercises where user_id = (select auth.uid())
    )
  );
