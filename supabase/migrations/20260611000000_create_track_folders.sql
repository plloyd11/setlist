-- ============================================================================
-- Track folders: nestable, band-shared organization for the tracks section
--
-- Folders are shared workspace structure (not authored content): ANY band
-- member may create, rename, move, and delete folders and move tracks
-- between them. Tracks' UPDATE RLS is creator-or-owner with a column grant
-- excluding folder_id, so "any member can organize" cannot be expressed in
-- plain RLS — structural mutations go through security-definer RPCs below.
--
-- Tree rules (enforced in RPCs, serialized by a band-wide folder row lock):
--   * max nesting depth 5
--   * no cycles (cannot move a folder into its own subtree)
--   * deleting a folder reparents its child folders and tracks to its
--     parent — folder deletion never deletes tracks
--
-- Requires PG15+ (unique index NULLS NOT DISTINCT; ON DELETE SET NULL with
-- a column list).
-- ============================================================================

-- ============================================================================
-- 1. Track folders table
-- ============================================================================
-- unique (id, band_id) exists solely to let same-band composite FKs below
-- pin parent folders (and tracks' folders) to the owning band at the
-- constraint level — no RLS subqueries needed for that invariant.
-- The parent cascade is defense-in-depth: user deletes go through
-- delete_track_folder() which reparents first; the cascade only fires for
-- band deletion (FK cascades run as table owner, unaffected by RLS).
create table public.track_folders (
  id uuid default gen_random_uuid() primary key,
  band_id uuid references public.bands(id) on delete cascade not null,
  parent_id uuid,
  name text not null check (btrim(name) <> ''),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (id, band_id),
  foreign key (parent_id, band_id)
    references public.track_folders (id, band_id) on delete cascade
);

-- One name per location, case-insensitive; NULLS NOT DISTINCT makes the
-- root level (parent_id null) behave like any other location.
create unique index track_folders_unique_name_idx
  on public.track_folders (band_id, parent_id, lower(btrim(name))) nulls not distinct;

alter table public.track_folders enable row level security;

create policy "Band members can view track folders"
  on public.track_folders for select to authenticated
  using (band_id in (select unnest(public.user_band_ids())));

-- Defense-in-depth: the real write path is create_track_folder() (depth
-- cap + friendly duplicate handling); a too-deep direct insert breaks
-- nothing, and same-band parentage is guaranteed by the composite FK.
create policy "Band members can create track folders"
  on public.track_folders for insert to authenticated
  with check (
    band_id in (select unnest(public.user_band_ids()))
    and created_by = (select auth.uid())
  );

create policy "Band members can rename track folders"
  on public.track_folders for update to authenticated
  using (band_id in (select unnest(public.user_band_ids())))
  with check (band_id in (select unnest(public.user_band_ids())));

-- No DELETE policy: reparent-on-delete cannot be expressed declaratively,
-- so all user deletes go through delete_track_folder().

-- Rename is the only direct update; reparenting (parent_id) is impossible
-- outside move_folder() (same pattern as the tracks column grant).
revoke update on table public.track_folders from authenticated;
grant update (name, updated_at) on table public.track_folders to authenticated;

-- ============================================================================
-- 2. tracks.folder_id
-- ============================================================================
-- Composite FK: a track can only reference a folder in its own band.
-- ON DELETE SET NULL (folder_id) is the fallback for folder rows deleted
-- outside the RPC (band cascade); tracks never die with a folder.
alter table public.tracks add column folder_id uuid;

alter table public.tracks
  add constraint tracks_folder_band_fkey
  foreign key (folder_id, band_id) references public.track_folders (id, band_id)
  on delete set null (folder_id);

-- folder_id stays out of the tracks UPDATE column grant (title,
-- description, updated_at — see 20260610120000): moves go through
-- move_track() only.

-- ============================================================================
-- 3. Indexes (FKs and policy-filtered columns)
-- ============================================================================
-- band_id lookups are covered by the unique name index prefix.
create index track_folders_parent_band_idx on public.track_folders(parent_id, band_id);
create index tracks_folder_id_idx on public.tracks(folder_id);

-- ============================================================================
-- 4. RPC: create folder
-- ============================================================================
create or replace function public.create_track_folder(
  p_band_id uuid,
  p_parent_id uuid,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_folder_id uuid;
  v_cursor uuid;
  v_depth integer := 1;
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

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Folder name required';
  end if;

  -- Serialize against concurrent tree mutations (move/delete also lock the
  -- band's folder rows) so the depth walk below reads a stable tree.
  perform 1 from public.track_folders where band_id = p_band_id for update;

  if p_parent_id is not null then
    if not exists (
      select 1 from public.track_folders f
      where f.id = p_parent_id and f.band_id = p_band_id
    ) then
      raise exception 'Folder not found in this band';
    end if;

    v_cursor := p_parent_id;
    while v_cursor is not null loop
      v_depth := v_depth + 1;
      if v_depth > 5 then
        raise exception 'Folder nesting is limited to 5 levels';
      end if;
      select f.parent_id into v_cursor from public.track_folders f where f.id = v_cursor;
    end loop;
  end if;

  begin
    insert into public.track_folders (band_id, parent_id, name, created_by)
    values (p_band_id, p_parent_id, btrim(p_name), v_uid)
    returning id into v_folder_id;
  exception when unique_violation then
    raise exception 'A folder with that name already exists here';
  end;

  return v_folder_id;
end;
$$;

revoke execute on function public.create_track_folder(uuid, uuid, text) from public, anon;
grant execute on function public.create_track_folder(uuid, uuid, text) to authenticated;

-- ============================================================================
-- 5. RPC: move track to a folder (null = root)
-- ============================================================================
-- Does NOT bump tracks.updated_at: organizing the workspace should not
-- reshuffle the "recently worked on" list ordering.
create or replace function public.move_track(
  p_band_id uuid,
  p_track_id uuid,
  p_folder_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
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

  if p_folder_id is not null then
    -- Lock the destination folder so a concurrent delete_track_folder()
    -- (which reparents tracks before deleting) serializes with this move
    -- instead of leaving the track pointing at a dying folder.
    perform 1 from public.track_folders f
    where f.id = p_folder_id and f.band_id = p_band_id
    for update;

    if not found then
      raise exception 'Folder not found in this band';
    end if;
  end if;

  update public.tracks t
  set folder_id = p_folder_id
  where t.id = p_track_id and t.band_id = p_band_id;

  if not found then
    raise exception 'Track not found in this band';
  end if;
end;
$$;

revoke execute on function public.move_track(uuid, uuid, uuid) from public, anon;
grant execute on function public.move_track(uuid, uuid, uuid) to authenticated;

-- ============================================================================
-- 6. RPC: move folder (re-parent; null = root)
-- ============================================================================
create or replace function public.move_folder(
  p_band_id uuid,
  p_folder_id uuid,
  p_new_parent_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_cursor uuid;
  v_depth integer := 0;
  v_height integer;
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

  -- Band-wide folder lock: without it, two concurrent moves (A under B,
  -- B under A) can each pass the cycle check and commit a cycle.
  perform 1 from public.track_folders where band_id = p_band_id for update;

  if not exists (
    select 1 from public.track_folders f
    where f.id = p_folder_id and f.band_id = p_band_id
  ) then
    raise exception 'Folder not found in this band';
  end if;

  if p_new_parent_id is not null then
    if p_new_parent_id = p_folder_id then
      raise exception 'Cannot move a folder into itself';
    end if;

    if not exists (
      select 1 from public.track_folders f
      where f.id = p_new_parent_id and f.band_id = p_band_id
    ) then
      raise exception 'Folder not found in this band';
    end if;

    -- Cycle check: walk up from the new parent; hitting the moved folder
    -- means the destination is inside its own subtree.
    v_cursor := p_new_parent_id;
    while v_cursor is not null loop
      if v_cursor = p_folder_id then
        raise exception 'Cannot move a folder into its own subtree';
      end if;
      v_depth := v_depth + 1;
      select f.parent_id into v_cursor from public.track_folders f where f.id = v_cursor;
    end loop;
  end if;

  -- Depth check: depth(new parent) + height(moved subtree) <= 5.
  with recursive subtree as (
    select f.id, 1 as h from public.track_folders f where f.id = p_folder_id
    union all
    select f.id, s.h + 1
    from public.track_folders f
    join subtree s on f.parent_id = s.id
  )
  select max(h) into v_height from subtree;

  if v_depth + v_height > 5 then
    raise exception 'Folder nesting is limited to 5 levels';
  end if;

  begin
    update public.track_folders f
    set parent_id = p_new_parent_id, updated_at = now()
    where f.id = p_folder_id;
  exception when unique_violation then
    raise exception 'A folder with that name already exists at the destination';
  end;
end;
$$;

revoke execute on function public.move_folder(uuid, uuid, uuid) from public, anon;
grant execute on function public.move_folder(uuid, uuid, uuid) to authenticated;

-- ============================================================================
-- 7. RPC: delete folder, reparenting its contents to its parent
-- ============================================================================
-- Returns the deleted folder's parent_id (null = root) for the UI.
-- If a reparented child folder collides with a sibling name at the
-- destination, the unique index aborts the whole RPC — atomic, nothing is
-- deleted; the user renames one folder and retries.
create or replace function public.delete_track_folder(
  p_band_id uuid,
  p_folder_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_parent uuid;
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

  perform 1 from public.track_folders where band_id = p_band_id for update;

  select f.parent_id into v_parent
  from public.track_folders f
  where f.id = p_folder_id and f.band_id = p_band_id;

  if not found then
    raise exception 'Folder not found in this band';
  end if;

  begin
    update public.track_folders f
    set parent_id = v_parent, updated_at = now()
    where f.parent_id = p_folder_id;
  exception when unique_violation then
    raise exception 'A folder inside has the same name as one at the destination — rename one first';
  end;

  update public.tracks t
  set folder_id = v_parent
  where t.folder_id = p_folder_id;

  delete from public.track_folders f where f.id = p_folder_id;

  return v_parent;
end;
$$;

revoke execute on function public.delete_track_folder(uuid, uuid) from public, anon;
grant execute on function public.delete_track_folder(uuid, uuid) to authenticated;

-- ============================================================================
-- 8. create_track_version: add p_folder_id (new tracks land in a folder)
-- ============================================================================
-- Postgres would treat a changed parameter list as an overload under
-- `create or replace`, leaving the old 9-arg function callable — drop it
-- explicitly first. p_folder_id is ignored when appending a version to an
-- existing track (versions don't move tracks).
drop function public.create_track_version(uuid, uuid, text, text, text, text, bigint, double precision, jsonb);

create function public.create_track_version(
  p_band_id uuid,
  p_track_id uuid,
  p_title text,
  p_storage_path text,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_duration_seconds double precision,
  p_waveform_peaks jsonb,
  p_folder_id uuid
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

    if p_folder_id is not null and not exists (
      select 1 from public.track_folders f
      where f.id = p_folder_id and f.band_id = p_band_id
    ) then
      raise exception 'Folder not found in this band';
    end if;

    insert into public.tracks (band_id, title, created_by, folder_id)
    values (p_band_id, btrim(p_title), v_uid, p_folder_id)
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

revoke execute on function public.create_track_version(uuid, uuid, text, text, text, text, bigint, double precision, jsonb, uuid) from public, anon;
grant execute on function public.create_track_version(uuid, uuid, text, text, text, text, bigint, double precision, jsonb, uuid) to authenticated;
