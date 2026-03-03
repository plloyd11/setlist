-- Songs table was missing an anonymous read policy, so shared setlist pages
-- showed "Unknown" for every song title (the setlist_songs join to songs was
-- blocked by RLS for unauthenticated viewers).

create policy "Anyone can view songs in shared setlists"
  on public.songs for select
  to anon
  using (
    id in (
      select song_id from public.setlist_songs
      where setlist_id in (
        select id from public.setlists where share_token is not null
      )
    )
  );
