-- ============================================================================
-- Song files: charts & tabs (PDF, Word, Guitar Pro) attached to library songs
--
-- A song can carry reference documents — chord charts, tabs, lyric sheets —
-- alongside its rehearsal audio (song_audio). Same authorization model: the
-- song owner uploads/manages; anyone who can see the song (owner, or band
-- members when the song is band-linked via band_songs) can read/download.
--
-- MIME note: Guitar Pro files (.gp/.gp3/.gp4/.gp5/.gpx) have no registered
-- MIME type — browsers report them as empty or application/octet-stream, so
-- the bucket allowlist must include application/octet-stream. Real validation
-- is extension-based in src/lib/server/songFiles.ts (client sets the
-- content-type itself on the signed-URL PUT). The allowlist still blocks the
-- threat that matters: text/html served from a signed URL (stored XSS).
--
-- Storage note: uploads go client-side direct to the private 'song-files'
-- bucket (Netlify function body limit ~6MB), then the uploadFile form action
-- records the metadata row — same flow as song-audio.
-- ============================================================================

-- ============================================================================
-- 1. Song files table
-- ============================================================================
create table public.song_files (
  id uuid default gen_random_uuid() primary key,
  song_id uuid references public.songs(id) on delete cascade not null,
  label text check (label is null or btrim(label) <> ''),
  -- Path<->song consistency is declarative: a row can only reference an
  -- object inside its own song's folder (uuid text has no like wildcards).
  storage_path text not null
    check (storage_path like 'songs/' || song_id::text || '/%'),
  file_name text not null check (btrim(file_name) <> ''),
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  created_at timestamptz default now() not null
);

alter table public.song_files enable row level security;

create policy "Song owner and band members can view song files"
  on public.song_files for select to authenticated
  using (
    song_id in (select id from public.songs where user_id = (select auth.uid()))
    or song_id in (
      select bs.song_id from public.band_songs bs
      where bs.band_id in (select unnest(public.user_band_ids()))
    )
  );

create policy "Song owner can add song files"
  on public.song_files for insert to authenticated
  with check (
    song_id in (select id from public.songs where user_id = (select auth.uid()))
  );

create policy "Song owner can update song files"
  on public.song_files for update to authenticated
  using (
    song_id in (select id from public.songs where user_id = (select auth.uid()))
  )
  with check (
    song_id in (select id from public.songs where user_id = (select auth.uid()))
  );

create policy "Song owner can delete song files"
  on public.song_files for delete to authenticated
  using (
    song_id in (select id from public.songs where user_id = (select auth.uid()))
  );

-- Label rename is the only mutation; file metadata is immutable once created
-- (same column-grant pattern as song_audio).
revoke update on table public.song_files from authenticated;
grant update (label) on table public.song_files to authenticated;

create index song_files_song_id_idx on public.song_files(song_id);

-- ============================================================================
-- 2. Storage: private 'song-files' bucket + owner/band-member policies
-- ============================================================================
-- Private bucket: downloads use signed URLs created through the user-scoped
-- client (requires the SELECT policy below). Path convention:
-- songs/{song_id}/{uuid}.{ext} — (storage.foldername(name))[2] is the song id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'song-files', 'song-files', false, 26214400,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/octet-stream'
  ]
);

create policy "Song owner can upload song files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'song-files'
    and (storage.foldername(name))[1] = 'songs'
    and (storage.foldername(name))[2] in (
      select id::text from public.songs where user_id = (select auth.uid())
    )
  );

create policy "Song owner and band members can read song files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'song-files'
    and (storage.foldername(name))[1] = 'songs'
    and (
      (storage.foldername(name))[2] in (
        select id::text from public.songs where user_id = (select auth.uid())
      )
      or (storage.foldername(name))[2] in (
        select bs.song_id::text from public.band_songs bs
        where bs.band_id in (select unnest(public.user_band_ids()))
      )
    )
  );

create policy "Song owner can delete song files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'song-files'
    and (storage.foldername(name))[1] = 'songs'
    and (storage.foldername(name))[2] in (
      select id::text from public.songs where user_id = (select auth.uid())
    )
  );

-- No UPDATE policy: each upload uses a fresh uuid path, never upsert.
