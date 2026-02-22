-- ============================================================================
-- Band Workspaces: tables, RLS policies, indexes, helper function
-- ============================================================================

-- 1. Security definer helper function: returns band IDs for current user
-- Must be created BEFORE RLS policies that reference it
create or replace function public.user_band_ids()
returns uuid[] as $$
begin
  return array(
    select band_id from public.band_members
    where user_id = (select auth.uid())
  );
end;
$$ language plpgsql security definer stable;

-- ============================================================================
-- 2. Bands table
-- ============================================================================
create table public.bands (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references auth.users(id) on delete restrict not null,
  logo_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.bands enable row level security;

-- Bands RLS: members can view their bands
create policy "Band members can view their bands"
  on public.bands for select to authenticated
  using (id = ANY(public.user_band_ids()));

-- Bands RLS: owners can always view their own bands (needed for post-INSERT
-- select before band_members row exists — fixes chicken-and-egg)
create policy "Band owners can view their own bands"
  on public.bands for select to authenticated
  using ((select auth.uid()) = owner_id);

-- Bands RLS: authenticated users can create bands (must be owner)
create policy "Authenticated users can create bands"
  on public.bands for insert to authenticated
  with check ((select auth.uid()) = owner_id);

-- Bands RLS: owner can update band
create policy "Band owner can update band"
  on public.bands for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Bands RLS: owner can delete band
create policy "Band owner can delete band"
  on public.bands for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- ============================================================================
-- 3. Band members table
-- ============================================================================
create table public.band_members (
  id uuid default gen_random_uuid() primary key,
  band_id uuid references public.bands(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now() not null,
  unique(band_id, user_id)
);

alter table public.band_members enable row level security;

-- Band members RLS: members can view members of their bands
create policy "Band members can view members"
  on public.band_members for select to authenticated
  using (band_id = ANY(public.user_band_ids()));

-- Band members RLS: owner can add members
create policy "Band owner can add members"
  on public.band_members for insert to authenticated
  with check (band_id in (
    select id from public.bands where owner_id = (select auth.uid())
  ));

-- Band members RLS: owner can remove members
create policy "Band owner can remove members"
  on public.band_members for delete to authenticated
  using (band_id in (
    select id from public.bands where owner_id = (select auth.uid())
  ));

-- ============================================================================
-- 4. Band songs table (junction: links songs to bands)
-- ============================================================================
create table public.band_songs (
  id uuid default gen_random_uuid() primary key,
  band_id uuid references public.bands(id) on delete cascade not null,
  song_id uuid references public.songs(id) on delete cascade not null,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz default now() not null,
  unique(band_id, song_id)
);

alter table public.band_songs enable row level security;

-- Band songs RLS: members can view band songs
create policy "Band members can view band songs"
  on public.band_songs for select to authenticated
  using (band_id = ANY(public.user_band_ids()));

-- Band songs RLS: members can add songs to band
create policy "Band members can add songs to band"
  on public.band_songs for insert to authenticated
  with check (band_id = ANY(public.user_band_ids()));

-- Band songs RLS: members can remove songs from band
create policy "Band members can remove songs from band"
  on public.band_songs for delete to authenticated
  using (band_id = ANY(public.user_band_ids()));

-- ============================================================================
-- 5. Band invites table (one-time use tokens)
-- ============================================================================
create table public.band_invites (
  id uuid default gen_random_uuid() primary key,
  band_id uuid references public.bands(id) on delete cascade not null,
  token uuid default gen_random_uuid() unique not null,
  created_by uuid references auth.users(id) on delete set null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz default now() not null,
  expires_at timestamptz default (now() + interval '7 days') not null
);

alter table public.band_invites enable row level security;

-- Band invites RLS: owner can create invites
create policy "Band owner can create invites"
  on public.band_invites for insert to authenticated
  with check (band_id in (
    select id from public.bands where owner_id = (select auth.uid())
  ));

-- Band invites RLS: anyone authenticated can view valid (unused, unexpired) invites
create policy "Anyone can view valid invites"
  on public.band_invites for select to authenticated
  using (used_at is null and expires_at > now());

-- Band invites RLS: invite acceptor can mark as used
create policy "Invite acceptor can mark as used"
  on public.band_invites for update to authenticated
  using (used_at is null and expires_at > now())
  with check (used_by = (select auth.uid()));

-- ============================================================================
-- 6. ALTER setlists: add nullable band_id FK
-- ============================================================================
alter table public.setlists add column band_id uuid references public.bands(id) on delete cascade;

-- Bands RLS: anon can view bands for shared band setlists
-- (placed after ALTER TABLE setlists since it references setlists.band_id)
create policy "Anyone can view bands for shared setlists"
  on public.bands for select to anon
  using (
    id in (
      select band_id from public.setlists
      where share_token is not null and band_id is not null
    )
  );

-- Setlists RLS: band members can view band setlists
create policy "Band members can view band setlists"
  on public.setlists for select to authenticated
  using (band_id = ANY(public.user_band_ids()));

-- Setlists RLS: band members can create band setlists
create policy "Band members can create band setlists"
  on public.setlists for insert to authenticated
  with check (band_id = ANY(public.user_band_ids()));

-- Setlists RLS: band members can update band setlists
create policy "Band members can update band setlists"
  on public.setlists for update to authenticated
  using (band_id = ANY(public.user_band_ids()));

-- Setlists RLS: band members can delete band setlists
create policy "Band members can delete band setlists"
  on public.setlists for delete to authenticated
  using (band_id = ANY(public.user_band_ids()));

-- ============================================================================
-- 7. Additional setlist_songs RLS: band members can manage songs in band setlists
-- ============================================================================
create policy "Band members can manage band setlist songs"
  on public.setlist_songs for all to authenticated
  using (
    setlist_id in (
      select id from public.setlists
      where band_id = ANY(public.user_band_ids())
    )
  );

-- ============================================================================
-- 8. Additional songs table RLS: band members can view/update band-linked songs
-- ============================================================================
create policy "Band members can view band-linked songs"
  on public.songs for select to authenticated
  using (
    id in (
      select song_id from public.band_songs
      where band_id = ANY(public.user_band_ids())
    )
  );

create policy "Band members can update band-linked songs"
  on public.songs for update to authenticated
  using (
    id in (
      select song_id from public.band_songs
      where band_id = ANY(public.user_band_ids())
    )
  );

-- ============================================================================
-- 9. Indexes (critical for RLS performance)
-- ============================================================================
create index band_members_user_id_idx on public.band_members(user_id);
create index band_members_band_id_idx on public.band_members(band_id);
create index band_songs_band_id_idx on public.band_songs(band_id);
create index band_songs_song_id_idx on public.band_songs(song_id);
create index band_invites_token_idx on public.band_invites(token) where used_at is null;
create index setlists_band_id_idx on public.setlists(band_id) where band_id is not null;

-- ============================================================================
-- 10. Storage policy for band logos
-- ============================================================================

-- Band owner can upload to bands/{band_id}/ folder in logos bucket
create policy "Band owner can upload band logo"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = 'bands'
    and (storage.foldername(name))[2] in (
      select id::text from public.bands where owner_id = (select auth.uid())
    )
  );

-- Band owner can update their band logo
create policy "Band owner can update band logo"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = 'bands'
    and (storage.foldername(name))[2] in (
      select id::text from public.bands where owner_id = (select auth.uid())
    )
  );

-- Band owner can delete their band logo
create policy "Band owner can delete band logo"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = 'bands'
    and (storage.foldername(name))[2] in (
      select id::text from public.bands where owner_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 11. Profiles RLS: band members can view bandmates' profiles
-- ============================================================================
-- CRITICAL: Without this, authenticated Supabase queries joining profiles from
-- band_members will return null for all bandmates. The existing
-- "Users can manage their own profile" policy restricts authenticated reads
-- to the user's own row only.
create policy "Band members can view profiles of their bandmates"
  on public.profiles for select to authenticated
  using (id in (
    select user_id from public.band_members
    where band_id = ANY(public.user_band_ids())
  ));
