-- ============================================================================
-- Rig IRs: the cab IRs a musician uploads, kept with their account
--
-- The rig keeps its files in the browser (IndexedDB), which is right for playing:
-- nothing to fetch when Monitor goes on. But an IR someone hunted down and uploaded
-- shouldn't be stuck on one machine. This is the copy that follows the account: the
-- browser's copy stays the working one, and syncs against these rows.
--
-- Only uploaded IRs come here. Files picked from TONE3000 stay on the device they
-- were picked on: its free tier covers the picker flow, not keeping its files on
-- our storage. Amp models and rig settings stay per browser too.
--
-- The row's id is made in the browser, and is the id the file is kept under there,
-- so a rig's settings point at the same IR on every device.
--
-- Everything is written by the browser through the user-scoped client, so the
-- rules live here rather than in app code: RLS for whose, CHECKs for what.
-- ============================================================================

-- ============================================================================
-- 1. The table
-- ============================================================================
create table public.rig_irs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (btrim(name) <> '' and char_length(name) <= 120),
  -- One object per row, in the owner's own folder: a row can't point anywhere else
  storage_path text not null
    check (storage_path = 'users/' || user_id::text || '/' || id::text || '.wav'),
  -- Mirrors the bucket's file_size_limit and MAX_IR_BYTES in rigStore.ts
  file_size_bytes integer not null check (file_size_bytes > 0 and file_size_bytes <= 2000000),
  created_at timestamptz not null default now()
);

create index rig_irs_user_id_idx on public.rig_irs (user_id);

alter table public.rig_irs enable row level security;

create policy "Owner manages their rig IRs"
  on public.rig_irs for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Grants are required for new tables, and anon gets nothing. A rename is the only
-- change a row ever sees: the file it points at never moves.
revoke all on public.rig_irs from anon, authenticated;
grant select, insert, delete on public.rig_irs to authenticated;
grant update (name) on public.rig_irs to authenticated;
grant select, insert, update, delete on public.rig_irs to service_role;

-- ============================================================================
-- 2. Storage: the private 'rig-irs' bucket, each musician in their own folder
-- ============================================================================
-- Path: users/{user_id}/{ir_id}.wav. 2 MB is far past any cab IR and still allows
-- a long room. WAV only, which is all the rig takes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rig-irs', 'rig-irs', false, 2000000,
  array['audio/wav', 'audio/x-wav', 'audio/wave']
);

create policy "Owner can upload rig IRs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'rig-irs'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "Owner can read rig IRs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'rig-irs'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "Owner can delete rig IRs"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'rig-irs'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

-- No UPDATE policy: an IR is uploaded once under its own id, never replaced.
