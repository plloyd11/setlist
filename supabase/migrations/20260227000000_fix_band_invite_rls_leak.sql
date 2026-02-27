-- ============================================================================
-- Fix: band invite RLS policy leaks all bands with active invites
-- The old policy allowed ANY authenticated user to see ANY band that had
-- an unused/unexpired invite, regardless of whether they had the token.
-- Replace with a SECURITY DEFINER function that safely returns band info
-- only when given the correct invite token.
-- ============================================================================

-- 1. Drop the overly broad policy
drop policy if exists "Invite holders can view invited band" on public.bands;

-- 2. Create a SECURITY DEFINER function that returns band info for a valid token.
--    This bypasses RLS internally so the invite acceptance page can still
--    show the band name/logo without leaking bands to all users.
create or replace function public.get_band_by_invite_token(invite_token uuid)
returns table (
  invite_id uuid,
  band_id uuid,
  band_name text,
  band_logo_url text
) as $$
begin
  return query
    select
      bi.id as invite_id,
      bi.band_id,
      b.name as band_name,
      b.logo_url as band_logo_url
    from public.band_invites bi
    join public.bands b on b.id = bi.band_id
    where bi.token = invite_token
      and bi.used_at is null
      and bi.expires_at > now()
    limit 1;
end;
$$ language plpgsql security definer stable;
