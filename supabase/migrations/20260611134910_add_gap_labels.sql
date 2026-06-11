-- ============================================================================
-- Gap labels: optional name on gap rows ("Tuning break", "Noises", ...).
-- Song rows must keep gap_label null — enforced by the reworked
-- song-or-gap constraint.
-- ============================================================================

alter table public.setlist_songs
  add column gap_label text
  check (gap_label is null or char_length(gap_label) <= 60);

alter table public.setlist_songs drop constraint setlist_songs_song_or_gap;

alter table public.setlist_songs
  add constraint setlist_songs_song_or_gap check (
    (song_id is not null and gap_seconds is null and gap_label is null)
    or (song_id is null and gap_seconds > 0)
  );

-- ============================================================================
-- save_setlist_order: pass gap_label through for new gap rows.
-- ============================================================================

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

  -- New rows must be a song xor a gap
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where e->>'id' is null
      and not (
        (e->>'song_id' is not null and e->>'gap_seconds' is null)
        or (e->>'song_id' is null and (e->>'gap_seconds')::integer > 0)
      )
  ) then
    raise exception 'Invalid item payload';
  end if;

  -- Newly added songs must be visible to the caller (owned or band-linked)
  if exists (
    select 1 from jsonb_array_elements(p_items) e
    where e->>'id' is null
      and e->>'song_id' is not null
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

  -- Insert new rows (songs or gaps) at their slots
  insert into public.setlist_songs (setlist_id, song_id, gap_seconds, gap_label, position)
  select
    p_setlist_id,
    (e.elem->>'song_id')::uuid,
    (e.elem->>'gap_seconds')::integer,
    case when e.elem->>'song_id' is null then nullif(trim(e.elem->>'gap_label'), '') end,
    e.ord - 1
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
-- get_shared_setlist: expose gap labels on the shared/printed sheet.
-- ============================================================================

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
    jsonb_agg(
      case
        when ss.song_id is null then
          jsonb_build_object('gap_seconds', ss.gap_seconds, 'gap_label', ss.gap_label)
        else jsonb_build_object('title', so.title, 'notes', so.notes)
      end
      order by ss.position
    ),
    '[]'::jsonb
  )
  into v_songs
  from public.setlist_songs ss
  left join public.songs so on so.id = ss.song_id
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

revoke execute on function public.get_shared_setlist(uuid) from public;
grant execute on function public.get_shared_setlist(uuid) to anon, authenticated;
