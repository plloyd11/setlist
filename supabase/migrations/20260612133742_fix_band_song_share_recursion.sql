-- ============================================================================
-- Fix: sharing a song to a band failed with "infinite recursion detected in
-- policy for relation band_songs" (42P17).
--
-- The band_songs INSERT policy (20260610000000 section 2) checks song
-- ownership with an inline subquery on public.songs. Evaluating that
-- subquery applies songs' RLS, and songs' "Band members can view
-- band-linked songs" SELECT policy subqueries band_songs — re-entering
-- band_songs while its own policies are still being expanded. Postgres
-- rejects the cycle at rewrite time, so every share from the band Songs
-- page (and the "Add New Song" link step, which inserts the same row)
-- failed with a 500.
--
-- Fix: move the ownership check into a SECURITY DEFINER helper (same
-- pattern as user_band_ids()) so songs RLS never runs inside the
-- band_songs policy. Semantics are unchanged: the caller must own the
-- song they link.
-- ============================================================================

create or replace function public.user_owns_song(p_song_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.songs
    where id = p_song_id and user_id = auth.uid()
  );
$$;

revoke execute on function public.user_owns_song(uuid) from public, anon;
grant execute on function public.user_owns_song(uuid) to authenticated;

drop policy "Band members can add their own songs to band" on public.band_songs;

create policy "Band members can add their own songs to band"
  on public.band_songs for insert to authenticated
  with check (
    band_id in (select unnest(public.user_band_ids()))
    and public.user_owns_song(song_id)
  );
