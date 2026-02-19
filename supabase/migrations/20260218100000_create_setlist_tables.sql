-- Create profiles table (user-level settings including logo)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  logo_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS on profiles
alter table public.profiles enable row level security;

-- Profiles RLS: owner full CRUD
create policy "Users can manage their own profile"
  on public.profiles for all
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Profiles RLS: anon can read (for shared setlist logo/name display)
create policy "Anyone can view profiles"
  on public.profiles for select
  to anon
  using (true);

-- Create setlists table
create table public.setlists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  gig_date date,
  venue text,
  target_seconds integer check (target_seconds is null or target_seconds > 0),
  transition_seconds integer not null default 0 check (transition_seconds >= 0),
  share_token uuid unique,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Indexes for setlists
create index setlists_user_id_idx on public.setlists(user_id);
create index setlists_share_token_idx on public.setlists(share_token) where share_token is not null;

-- Enable RLS on setlists
alter table public.setlists enable row level security;

-- Setlists RLS: owner SELECT
create policy "Users can view their own setlists"
  on public.setlists for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Setlists RLS: owner INSERT
create policy "Users can insert their own setlists"
  on public.setlists for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Setlists RLS: owner UPDATE
create policy "Users can update their own setlists"
  on public.setlists for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Setlists RLS: owner DELETE
create policy "Users can delete their own setlists"
  on public.setlists for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Setlists RLS: anon can view shared setlists
create policy "Anyone can view shared setlists"
  on public.setlists for select
  to anon
  using (share_token is not null);

-- Create setlist_songs junction table
create table public.setlist_songs (
  id uuid default gen_random_uuid() primary key,
  setlist_id uuid references public.setlists(id) on delete cascade not null,
  song_id uuid references public.songs(id) on delete cascade not null,
  position integer not null check (position >= 0),
  created_at timestamptz default now() not null,
  unique(setlist_id, position)
);

-- Indexes for setlist_songs
create index setlist_songs_setlist_id_idx on public.setlist_songs(setlist_id);
create index setlist_songs_setlist_position_idx on public.setlist_songs(setlist_id, position);

-- Enable RLS on setlist_songs
alter table public.setlist_songs enable row level security;

-- Setlist_songs RLS: owner SELECT
create policy "Users can view songs in their setlists"
  on public.setlist_songs for select
  to authenticated
  using (setlist_id in (select id from public.setlists where user_id = (select auth.uid())));

-- Setlist_songs RLS: owner INSERT
create policy "Users can add songs to their setlists"
  on public.setlist_songs for insert
  to authenticated
  with check (setlist_id in (select id from public.setlists where user_id = (select auth.uid())));

-- Setlist_songs RLS: owner UPDATE
create policy "Users can update songs in their setlists"
  on public.setlist_songs for update
  to authenticated
  using (setlist_id in (select id from public.setlists where user_id = (select auth.uid())))
  with check (setlist_id in (select id from public.setlists where user_id = (select auth.uid())));

-- Setlist_songs RLS: owner DELETE
create policy "Users can remove songs from their setlists"
  on public.setlist_songs for delete
  to authenticated
  using (setlist_id in (select id from public.setlists where user_id = (select auth.uid())));

-- Setlist_songs RLS: anon can view songs in shared setlists
create policy "Anyone can view songs in shared setlists"
  on public.setlist_songs for select
  to anon
  using (setlist_id in (select id from public.setlists where share_token is not null));

-- Storage bucket for logos
insert into storage.buckets (id, name, public)
  values ('logos', 'logos', true);

-- Storage policy: authenticated users can upload to their own folder
create policy "Users can upload their own logo"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'logos' and (select auth.uid())::text = (storage.foldername(name))[1]);

-- Storage policy: authenticated users can update their own logo
create policy "Users can update their own logo"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'logos' and (select auth.uid())::text = (storage.foldername(name))[1]);

-- Storage policy: authenticated users can delete their own logo
create policy "Users can delete their own logo"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'logos' and (select auth.uid())::text = (storage.foldername(name))[1]);

-- Storage policy: anyone can read logos (public bucket)
create policy "Anyone can view logos"
  on storage.objects for select
  to public
  using (bucket_id = 'logos');
