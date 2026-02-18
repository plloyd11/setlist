-- Create songs table for user song libraries
create table public.songs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  duration_seconds integer not null check (duration_seconds > 0),
  notes text,
  created_at timestamptz default now() not null
);

-- Index for RLS policy performance
create index songs_user_id_idx on public.songs(user_id);

-- Index for default alphabetical sort
create index songs_title_idx on public.songs(user_id, title);

-- Enable RLS
alter table public.songs enable row level security;

-- RLS policies: users can only access their own songs
create policy "Users can view their own songs"
  on public.songs for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own songs"
  on public.songs for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own songs"
  on public.songs for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own songs"
  on public.songs for delete
  to authenticated
  using ((select auth.uid()) = user_id);
