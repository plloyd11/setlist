-- ============================================================================
-- Security & integrity fixes (full-codebase audit, 2026-06-10)
--
-- 1. Band invites: any authenticated user could read ALL invite tokens, and
--    could join ANY band with an outstanding invite without holding a token.
--    Token reads are now owner-only and joining goes through an atomic
--    SECURITY DEFINER RPC keyed by the token.
-- 2. band_songs: linking no longer accepts arbitrary song_ids — the caller
--    must own the song (prevents hijacking read/write access to other users'
--    songs via the band-linked-song policies).
-- 3. Anon exposure: the share page previously relied on broad `to anon`
--    policies that let anyone with the public key enumerate all profiles,
--    all shared setlists (incl. tokens), and song notes. Those policies are
--    dropped; share data is served by a token-keyed SECURITY DEFINER RPC.
-- 4. band_members: members can now actually leave bands (self-delete policy),
--    and ownership transfer works via an atomic RPC (previously blocked by
--    RLS with errors silently discarded).
-- 5. setlist reorder: delete-all + re-insert was non-atomic and could wipe a
--    setlist on partial failure. Replaced by an atomic RPC that also keeps
--    existing row IDs stable.
-- 6. songs: column-level UPDATE grant prevents reassigning user_id (a band
--    member could previously steal ownership of a band-linked song).
-- 7. RLS initplan: user_band_ids() calls wrapped in uncorrelated subqueries
--    so they evaluate once per statement instead of per row.
-- 8. search_path pinned on existing SECURITY DEFINER functions.
-- 9. Missing index on setlist_songs(song_id) (FK with ON DELETE CASCADE).
-- ============================================================================

-- ============================================================================
-- 1. Band invites: close the token-enumeration and token-less-join holes
-- ============================================================================

drop policy "Anyone can view valid invites" on public.band_invites;
drop policy "Invite acceptor can mark as used" on public.band_invites;
drop policy "Users with valid invite can join band" on public.band_members;

-- Owners still need to read invites they created (createInvite does
-- insert ... select('token')).
create policy "Band owner can view invites"
  on public.band_invites for select to authenticated
  using (band_id in (
    select id from public.bands where owner_id = (select auth.uid())
  ));

-- Atomic, token-gated invite acceptance. Validates the token, inserts the
-- member, and marks the invite used in one transaction.
create or replace function public.accept_band_invite(invite_token uuid)
returns table (status text, band_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_invite public.band_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_invite
  from public.band_invites bi
  where bi.token = invite_token
    and bi.used_at is null
    and bi.expires_at > now()
  for update;

  if not found then
    return query select 'invalid'::text, null::uuid;
    return;
  end if;

  if exists (
    select 1 from public.band_members bm
    where bm.band_id = v_invite.band_id and bm.user_id = v_uid
  ) then
    return query select 'already_member'::text, v_invite.band_id;
    return;
  end if;

  insert into public.band_members (band_id, user_id, role)
  values (v_invite.band_id, v_uid, 'member');

  update public.band_invites bi
  set used_by = v_uid, used_at = now()
  where bi.id = v_invite.id;

  return query select 'joined'::text, v_invite.band_id;
end;
$$;

revoke execute on function public.accept_band_invite(uuid) from public, anon;
grant execute on function public.accept_band_invite(uuid) to authenticated;

-- ============================================================================
-- 2. band_songs: caller must own the song they link to a band
-- ============================================================================

drop policy "Band members can add songs to band" on public.band_songs;

create policy "Band members can add their own songs to band"
  on public.band_songs for insert to authenticated
  with check (
    band_id in (select unnest(public.user_band_ids()))
    and song_id in (
      select id from public.songs where user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 3. Anon exposure: drop broad anon policies, serve share data via RPC
-- ============================================================================

drop policy "Anyone can view profiles" on public.profiles;
drop policy "Anyone can view shared setlists" on public.setlists;
drop policy "Anyone can view songs in shared setlists" on public.setlist_songs;
drop policy "Anyone can view songs in shared setlists" on public.songs;
drop policy "Anyone can view bands for shared setlists" on public.bands;

-- Returns exactly the whitelisted share-page payload for a valid token, or
-- NULL when the token doesn't match. Also fixes a pre-existing bug where
-- logged-in users could not view other people's share links (the old
-- policies were anon-only).
create or replace function public.get_shared_setlist(p_token uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public, pg_temp
as $$
declare
  v_setlist record;
  v_songs jsonb;
  v_profile jsonb;
begin
  select s.id, s.name, s.gig_date, s.venue, s.user_id, s.band_id
  into v_setlist
  from public.setlists s
  where s.share_token = p_token;

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(jsonb_build_object('title', so.title) order by ss.position),
    '[]'::jsonb
  )
  into v_songs
  from public.setlist_songs ss
  join public.songs so on so.id = ss.song_id
  where ss.setlist_id = v_setlist.id;

  if v_setlist.band_id is not null then
    select jsonb_build_object('display_name', b.name, 'logo_url', b.logo_url)
    into v_profile
    from public.bands b
    where b.id = v_setlist.band_id;
  else
    select jsonb_build_object('display_name', p.display_name, 'logo_url', p.logo_url)
    into v_profile
    from public.profiles p
    where p.id = v_setlist.user_id;
  end if;

  return jsonb_build_object(
    'name', v_setlist.name,
    'gig_date', v_setlist.gig_date,
    'venue', v_setlist.venue,
    'songs', v_songs,
    'profile', v_profile
  );
end;
$$;

grant execute on function public.get_shared_setlist(uuid) to anon, authenticated;

-- ============================================================================
-- 4. band_members: self-leave policy + atomic ownership transfer
-- ============================================================================

create policy "Members can leave bands they do not own"
  on public.band_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    and band_id not in (
      select id from public.bands where owner_id = (select auth.uid())
    )
  );

-- Ownership transfer touches bands.owner_id plus two band_members roles;
-- impossible to express safely with RLS policies alone (the bands UPDATE
-- WITH CHECK rejects rows the caller no longer owns), so it runs atomically
-- here with explicit authorization checks.
create or replace function public.transfer_band_ownership(p_band_id uuid, p_new_owner_id uuid)
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

  -- Lock the band row to serialize concurrent transfers
  perform 1 from public.bands b
  where b.id = p_band_id and b.owner_id = v_uid
  for update;

  if not found then
    raise exception 'Only the band owner can transfer ownership';
  end if;

  if p_new_owner_id = v_uid then
    raise exception 'Already the band owner';
  end if;

  if not exists (
    select 1 from public.band_members bm
    where bm.band_id = p_band_id and bm.user_id = p_new_owner_id
  ) then
    raise exception 'New owner must be a member of the band';
  end if;

  update public.bands b
  set owner_id = p_new_owner_id
  where b.id = p_band_id;

  update public.band_members bm
  set role = 'owner'
  where bm.band_id = p_band_id and bm.user_id = p_new_owner_id;

  update public.band_members bm
  set role = 'member'
  where bm.band_id = p_band_id and bm.user_id = v_uid;
end;
$$;

revoke execute on function public.transfer_band_ownership(uuid, uuid) from public, anon;
grant execute on function public.transfer_band_ownership(uuid, uuid) to authenticated;

-- ============================================================================
-- 5. Atomic setlist reorder with stable row IDs
-- ============================================================================
-- p_items is an ordered jsonb array of {id, song_id}; id null/absent means a
-- new row (dragged in from the library). Array order defines position.

create or replace function public.save_setlist_order(p_setlist_id uuid, p_items jsonb)
returns setof public.setlist_songs
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_keep_ids uuid[];
  v_shift integer;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Invalid items payload';
  end if;

  -- Caller must own the setlist or be a member of its band
  if not exists (
    select 1 from public.setlists s
    where s.id = p_setlist_id
      and (
        s.user_id = v_uid
        or (s.band_id is not null and s.band_id = any (public.user_band_ids()))
      )
  ) then
    raise exception 'Setlist not found or not authorized';
  end if;

  -- Serialize concurrent saves on the same setlist
  perform 1 from public.setlists s where s.id = p_setlist_id for update;

  -- Newly added songs must be visible to the caller (owned or band-linked)
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where e->>'id' is null
      and not exists (
        select 1 from public.songs s
        where s.id = (e->>'song_id')::uuid
          and (
            s.user_id = v_uid
            or s.id in (
              select bs.song_id from public.band_songs bs
              where bs.band_id = any (public.user_band_ids())
            )
          )
      )
  ) then
    raise exception 'Song not found or not accessible';
  end if;

  select coalesce(array_agg((e->>'id')::uuid), '{}')
  into v_keep_ids
  from jsonb_array_elements(p_items) e
  where e->>'id' is not null;

  -- Remove rows no longer present
  delete from public.setlist_songs ss
  where ss.setlist_id = p_setlist_id
    and not (ss.id = any (v_keep_ids));

  -- Shift surviving rows clear of unique(setlist_id, position) before
  -- applying the new ordering
  select coalesce(max(ss.position), 0) + 1000000
  into v_shift
  from public.setlist_songs ss
  where ss.setlist_id = p_setlist_id;

  update public.setlist_songs ss
  set position = ss.position + v_shift
  where ss.setlist_id = p_setlist_id;

  -- Final positions for surviving rows (array order = position)
  update public.setlist_songs ss
  set position = x.ord - 1
  from (
    select (e.elem->>'id')::uuid as item_id, e.ord
    from jsonb_array_elements(p_items) with ordinality as e(elem, ord)
    where e.elem->>'id' is not null
  ) x
  where ss.id = x.item_id
    and ss.setlist_id = p_setlist_id;

  -- Insert new rows at their slots
  insert into public.setlist_songs (setlist_id, song_id, position)
  select p_setlist_id, (e.elem->>'song_id')::uuid, e.ord - 1
  from jsonb_array_elements(p_items) with ordinality as e(elem, ord)
  where e.elem->>'id' is null;

  return query
  select ss.*
  from public.setlist_songs ss
  where ss.setlist_id = p_setlist_id
  order by ss.position;
end;
$$;

revoke execute on function public.save_setlist_order(uuid, jsonb) from public, anon;
grant execute on function public.save_setlist_order(uuid, jsonb) to authenticated;

-- ============================================================================
-- 6. songs: prevent user_id reassignment via column-level UPDATE grant
-- ============================================================================
-- "Band members can update band-linked songs" has no WITH CHECK beyond its
-- USING clause, so a member could previously UPDATE a band-linked song's
-- user_id to themselves. The app only ever updates these three columns.

revoke update on table public.songs from authenticated;
grant update (title, duration_seconds, notes) on table public.songs to authenticated;

-- ============================================================================
-- 7. RLS initplan: evaluate user_band_ids() once per statement, not per row
-- ============================================================================
-- `band_id = ANY(public.user_band_ids())` calls the function per row in a
-- seq-scan filter. An uncorrelated IN-subquery is planned as a single-eval
-- subplan.

alter policy "Band members can view their bands" on public.bands
  using (id in (select unnest(public.user_band_ids())));

alter policy "Band members can view members" on public.band_members
  using (band_id in (select unnest(public.user_band_ids())));

alter policy "Band members can view band songs" on public.band_songs
  using (band_id in (select unnest(public.user_band_ids())));

alter policy "Band members can remove songs from band" on public.band_songs
  using (band_id in (select unnest(public.user_band_ids())));

alter policy "Band members can view band setlists" on public.setlists
  using (band_id in (select unnest(public.user_band_ids())));

alter policy "Band members can create band setlists" on public.setlists
  with check (band_id in (select unnest(public.user_band_ids())));

alter policy "Band members can update band setlists" on public.setlists
  using (band_id in (select unnest(public.user_band_ids())));

alter policy "Band members can delete band setlists" on public.setlists
  using (band_id in (select unnest(public.user_band_ids())));

alter policy "Band members can manage band setlist songs" on public.setlist_songs
  using (setlist_id in (
    select id from public.setlists
    where band_id in (select unnest(public.user_band_ids()))
  ));

alter policy "Band members can view band-linked songs" on public.songs
  using (id in (
    select song_id from public.band_songs
    where band_id in (select unnest(public.user_band_ids()))
  ));

alter policy "Band members can update band-linked songs" on public.songs
  using (id in (
    select song_id from public.band_songs
    where band_id in (select unnest(public.user_band_ids()))
  ));

alter policy "Band members can view profiles of their bandmates" on public.profiles
  using (id in (
    select user_id from public.band_members
    where band_id in (select unnest(public.user_band_ids()))
  ));

-- ============================================================================
-- 8. search_path hardening for existing SECURITY DEFINER functions
-- ============================================================================

alter function public.user_band_ids() set search_path = public, pg_temp;
alter function public.get_band_by_invite_token(uuid) set search_path = public, pg_temp;

-- ============================================================================
-- 9. Missing index: setlist_songs.song_id (FK with ON DELETE CASCADE —
--    song deletes otherwise seq-scan setlist_songs)
-- ============================================================================

create index if not exists setlist_songs_song_id_idx on public.setlist_songs(song_id);
