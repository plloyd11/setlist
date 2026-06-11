-- ============================================================================
-- Band dark-logo variant: bands whose primary logo is light/white (drawn for
-- the dark app UI) are invisible on the white printed sheet. logo_dark_url
-- holds a dark version used wherever the background is light -- the print
-- sheet and the public share page fall back to logo_url when it is null.
-- Storage policies need no change: they constrain the bands/{band_id}/ folder,
-- not the filename (the dark variant uploads as logo-dark.{ext}).
-- ============================================================================

alter table public.bands
  add column logo_dark_url text;

-- ============================================================================
-- get_shared_setlist: prefer the dark logo on the (always light) shared sheet.
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
  select s.id, s.name, s.gig_date, s.venue, s.user_id, s.band_id, s.print_settings
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
    select jsonb_build_object(
      'display_name', b.name,
      'logo_url', coalesce(b.logo_dark_url, b.logo_url)
    )
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
    'profile', v_profile,
    'print_settings', v_setlist.print_settings
  );
end;
$$;

revoke execute on function public.get_shared_setlist(uuid) from public;
grant execute on function public.get_shared_setlist(uuid) to anon, authenticated;
