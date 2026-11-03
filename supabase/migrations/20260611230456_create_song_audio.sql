-- ============================================================================
-- Song audio: rehearsal audio variants attached to library songs
--
-- A song can carry multiple audio files ("variants"), each with an optional
-- free-text label — e.g. "Full mix", "No guitar" — so a player can rehearse
-- to a mix without their own instrument. Audio attaches to the song (not a
-- setlist), so every setlist containing the song gets it.
--
-- Authorization mirrors song visibility: the song owner uploads/manages;
-- anyone who can already see the song (owner, or band members when the song
-- is band-linked via band_songs) can listen. Linking/unlinking a song to a
-- band therefore grants/revokes member playback with no storage churn.
--
-- Storage note: uploads go client-side direct to the private 'song-audio'
-- bucket (Netlify function body limit ~6MB), then the uploadAudio form action
-- records the metadata row. If the action fails after a successful upload the
-- client attempts storage.remove(); a failed cleanup can leave an orphaned
-- object. Accepted tradeoff — bounded by the 50MB per-file bucket limit.
-- ============================================================================

-- ============================================================================
-- 1. Song audio table
-- ============================================================================
create table public.song_audio (
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
  duration_seconds double precision check (duration_seconds is null or duration_seconds > 0),
  waveform_peaks jsonb check (waveform_peaks is null or jsonb_typeof(waveform_peaks) = 'array'),
  created_at timestamptz default now() not null
);

alter table public.song_audio enable row level security;

create policy "Song owner and band members can view song audio"
  on public.song_audio for select to authenticated
  using (
    song_id in (select id from public.songs where user_id = (select auth.uid()))
    or song_id in (
      select bs.song_id from public.band_songs bs
      where bs.band_id in (select unnest(public.user_band_ids()))
    )
  );

create policy "Song owner can add song audio"
  on public.song_audio for insert to authenticated
  with check (
    song_id in (select id from public.songs where user_id = (select auth.uid()))
  );

create policy "Song owner can update song audio"
  on public.song_audio for update to authenticated
  using (
    song_id in (select id from public.songs where user_id = (select auth.uid()))
  )
  with check (
    song_id in (select id from public.songs where user_id = (select auth.uid()))
  );

create policy "Song owner can delete song audio"
  on public.song_audio for delete to authenticated
  using (
    song_id in (select id from public.songs where user_id = (select auth.uid()))
  );

-- Label rename is the only mutation; file metadata is immutable once created
-- (same column-grant pattern as the songs grant in 20260610000000 section 6).
revoke update on table public.song_audio from authenticated;
grant update (label) on table public.song_audio to authenticated;

create index song_audio_song_id_idx on public.song_audio(song_id);

-- ============================================================================
-- 2. Storage: private 'song-audio' bucket + owner/band-member policies
-- ============================================================================
-- Private bucket: playback uses signed URLs created server-side through the
-- user-scoped client (requires the SELECT policy below). Path convention:
-- songs/{song_id}/{uuid}.{ext} — (storage.foldername(name))[2] is the song id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'song-audio', 'song-audio', false, 52428800,
  array[
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'audio/m4a',
    'audio/aac',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/ogg'
  ]
);

create policy "Song owner can upload song audio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'song-audio'
    and (storage.foldername(name))[1] = 'songs'
    and (storage.foldername(name))[2] in (
      select id::text from public.songs where user_id = (select auth.uid())
    )
  );

create policy "Song owner and band members can read song audio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'song-audio'
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

create policy "Song owner can delete song audio"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'song-audio'
    and (storage.foldername(name))[1] = 'songs'
    and (storage.foldername(name))[2] in (
      select id::text from public.songs where user_id = (select auth.uid())
    )
  );

-- No UPDATE policy: each upload uses a fresh uuid path, never upsert.
