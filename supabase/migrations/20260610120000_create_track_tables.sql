-- ============================================================================
-- Track sharing: tables, RLS policies, indexes, RPC, private storage bucket
--
-- Band members upload work-in-progress audio ("tracks") to their band
-- workspace. Each upload is a track_version; comments attach to a specific
-- version (timestamps shift between versions). Any band member may upload a
-- new version of any track.
--
-- Storage note: audio uploads go client-side direct to the private 'tracks'
-- bucket (Netlify function body limit ~6MB), then create_track_version()
-- records the metadata row. If the RPC fails after a successful upload the
-- client attempts storage.remove(); a failed cleanup can leave an orphaned
-- object. Accepted v1 tradeoff — bounded by the 50MB per-file bucket limit.
-- ============================================================================

-- ============================================================================
-- 1. Tracks table
-- ============================================================================
create table public.tracks (
  id uuid default gen_random_uuid() primary key,
  band_id uuid references public.bands(id) on delete cascade not null,
  title text not null check (btrim(title) <> ''),
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.tracks enable row level security;

create policy "Band members can view tracks"
  on public.tracks for select to authenticated
  using (band_id in (select unnest(public.user_band_ids())));

create policy "Band members can create tracks"
  on public.tracks for insert to authenticated
  with check (
    band_id in (select unnest(public.user_band_ids()))
    and created_by = (select auth.uid())
  );

create policy "Track creator or band owner can update track"
  on public.tracks for update to authenticated
  using (
    created_by = (select auth.uid())
    or band_id in (select id from public.bands where owner_id = (select auth.uid()))
  )
  with check (
    created_by = (select auth.uid())
    or band_id in (select id from public.bands where owner_id = (select auth.uid()))
  );

create policy "Track creator or band owner can delete track"
  on public.tracks for delete to authenticated
  using (
    created_by = (select auth.uid())
    or band_id in (select id from public.bands where owner_id = (select auth.uid()))
  );

-- Prevent reassigning band_id/created_by via UPDATE (same pattern as the
-- songs column grant in 20260610000000 section 6). The app only renames.
revoke update on table public.tracks from authenticated;
grant update (title, description, updated_at) on table public.tracks to authenticated;

-- ============================================================================
-- 2. Track versions table
-- ============================================================================
create table public.track_versions (
  id uuid default gen_random_uuid() primary key,
  track_id uuid references public.tracks(id) on delete cascade not null,
  version_number integer not null check (version_number >= 1),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  duration_seconds double precision check (duration_seconds is null or duration_seconds > 0),
  waveform_peaks jsonb,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  unique(track_id, version_number)
);

alter table public.track_versions enable row level security;

create policy "Band members can view track versions"
  on public.track_versions for select to authenticated
  using (track_id in (
    select id from public.tracks
    where band_id in (select unnest(public.user_band_ids()))
  ));

-- Defense-in-depth: the real write path is create_track_version() (atomic
-- version numbering); this policy covers direct inserts without weakening
-- authorization. unique(track_id, version_number) guards integrity.
create policy "Band members can add track versions"
  on public.track_versions for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and track_id in (
      select id from public.tracks
      where band_id in (select unnest(public.user_band_ids()))
    )
  );

create policy "Uploader or band owner can delete track versions"
  on public.track_versions for delete to authenticated
  using (
    uploaded_by = (select auth.uid())
    or track_id in (
      select id from public.tracks
      where band_id in (select id from public.bands where owner_id = (select auth.uid()))
    )
  );

-- No UPDATE policy: version rows are immutable once created.

-- ============================================================================
-- 3. Track comments table
-- ============================================================================
-- parent_id: one-level replies only — depth and "replies carry no timestamp"
-- are enforced in the addComment form action, not a trigger.
-- timestamp_seconds null = general (non-timestamped) comment.
-- author_id set null on user deletion = rendered as "Former member".
create table public.track_comments (
  id uuid default gen_random_uuid() primary key,
  version_id uuid references public.track_versions(id) on delete cascade not null,
  parent_id uuid references public.track_comments(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (btrim(body) <> ''),
  timestamp_seconds double precision check (timestamp_seconds is null or timestamp_seconds >= 0),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null
);

alter table public.track_comments enable row level security;

create policy "Band members can view track comments"
  on public.track_comments for select to authenticated
  using (version_id in (
    select v.id from public.track_versions v
    join public.tracks t on t.id = v.track_id
    where t.band_id in (select unnest(public.user_band_ids()))
  ));

create policy "Band members can add track comments"
  on public.track_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and version_id in (
      select v.id from public.track_versions v
      join public.tracks t on t.id = v.track_id
      where t.band_id in (select unnest(public.user_band_ids()))
    )
  );

-- Any band member can resolve/unresolve; the column grant below stops them
-- from editing anyone's comment body.
create policy "Band members can resolve track comments"
  on public.track_comments for update to authenticated
  using (version_id in (
    select v.id from public.track_versions v
    join public.tracks t on t.id = v.track_id
    where t.band_id in (select unnest(public.user_band_ids()))
  ))
  with check (resolved_by is null or resolved_by = (select auth.uid()));

create policy "Author or band owner can delete track comments"
  on public.track_comments for delete to authenticated
  using (
    author_id = (select auth.uid())
    or version_id in (
      select v.id from public.track_versions v
      join public.tracks t on t.id = v.track_id
      where t.band_id in (select id from public.bands where owner_id = (select auth.uid()))
    )
  );

revoke update on table public.track_comments from authenticated;
grant update (resolved_at, resolved_by) on table public.track_comments to authenticated;

-- ============================================================================
-- 4. Indexes (FKs and policy-filtered columns)
-- ============================================================================
create index tracks_band_id_idx on public.tracks(band_id);
create index tracks_created_by_idx on public.tracks(created_by);
create index track_versions_track_id_idx on public.track_versions(track_id);
create index track_versions_uploaded_by_idx on public.track_versions(uploaded_by);
create index track_comments_version_id_idx on public.track_comments(version_id);
create index track_comments_parent_id_idx on public.track_comments(parent_id);
create index track_comments_author_id_idx on public.track_comments(author_id);
create index track_comments_resolved_by_idx on public.track_comments(resolved_by);

-- ============================================================================
-- 5. RPC: atomic create-or-append track version
-- ============================================================================
-- p_track_id null = new track (p_title required). Otherwise appends the next
-- version_number under a row lock on the track (serializes concurrent
-- uploads — coalesce(max+1) without the lock would race).
create or replace function public.create_track_version(
  p_band_id uuid,
  p_track_id uuid,
  p_title text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_duration_seconds double precision,
  p_waveform_peaks jsonb
)
returns table (track_id uuid, version_id uuid, version_number integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_track_id uuid;
  v_version_number integer;
  v_version_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.band_members bm
    where bm.band_id = p_band_id and bm.user_id = v_uid
  ) then
    raise exception 'Not a member of this band';
  end if;

  -- The version row must point inside this band's storage folder; otherwise
  -- a member could reference another band's audio object.
  if p_storage_path is null
     or p_storage_path not like ('bands/' || p_band_id || '/tracks/%') then
    raise exception 'Invalid storage path';
  end if;

  if p_file_name is null or btrim(p_file_name) = '' then
    raise exception 'File name required';
  end if;

  if p_file_size_bytes is null or p_file_size_bytes <= 0 then
    raise exception 'Invalid file size';
  end if;

  if p_waveform_peaks is not null and jsonb_typeof(p_waveform_peaks) <> 'array' then
    raise exception 'Invalid waveform peaks';
  end if;

  if p_track_id is null then
    if p_title is null or btrim(p_title) = '' then
      raise exception 'Title required';
    end if;

    insert into public.tracks (band_id, title, created_by)
    values (p_band_id, btrim(p_title), v_uid)
    returning id into v_track_id;

    v_version_number := 1;
  else
    select t.id into v_track_id
    from public.tracks t
    where t.id = p_track_id and t.band_id = p_band_id
    for update;

    if not found then
      raise exception 'Track not found in this band';
    end if;

    select coalesce(max(tv.version_number), 0) + 1
    into v_version_number
    from public.track_versions tv
    where tv.track_id = v_track_id;

    update public.tracks t set updated_at = now() where t.id = v_track_id;
  end if;

  insert into public.track_versions (
    track_id, version_number, storage_path, file_name, mime_type,
    file_size_bytes, duration_seconds, waveform_peaks, uploaded_by
  )
  values (
    v_track_id, v_version_number, p_storage_path, p_file_name, p_mime_type,
    p_file_size_bytes, p_duration_seconds, p_waveform_peaks, v_uid
  )
  returning id into v_version_id;

  return query select v_track_id, v_version_id, v_version_number;
end;
$$;

revoke execute on function public.create_track_version(uuid, uuid, text, text, text, text, bigint, double precision, jsonb) from public, anon;
grant execute on function public.create_track_version(uuid, uuid, text, text, text, text, bigint, double precision, jsonb) to authenticated;

-- ============================================================================
-- 6. Storage: private 'tracks' bucket + band-member policies
-- ============================================================================
-- Private bucket: playback uses signed URLs created server-side through the
-- user-scoped client (requires the SELECT policy below). Path convention:
-- bands/{band_id}/tracks/{uuid}.{ext}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tracks', 'tracks', false, 52428800,
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

create policy "Band members can upload track audio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'tracks'
    and (storage.foldername(name))[1] = 'bands'
    and (storage.foldername(name))[3] = 'tracks'
    and (storage.foldername(name))[2] in (select unnest(public.user_band_ids())::text)
  );

create policy "Band members can read track audio"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'tracks'
    and (storage.foldername(name))[1] = 'bands'
    and (storage.foldername(name))[3] = 'tracks'
    and (storage.foldername(name))[2] in (select unnest(public.user_band_ids())::text)
  );

-- App-level actions gate WHO triggers deletes (track creator or band owner);
-- this policy gates WHICH band's objects are reachable at all.
create policy "Band members can delete track audio"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'tracks'
    and (storage.foldername(name))[1] = 'bands'
    and (storage.foldername(name))[3] = 'tracks'
    and (storage.foldername(name))[2] in (select unnest(public.user_band_ids())::text)
  );

-- No UPDATE policy: each upload uses a fresh uuid path, never upsert.
