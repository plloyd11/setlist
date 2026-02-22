# Phase 4: Band Workspaces - Research

**Researched:** 2026-02-21
**Domain:** Multi-user band workspaces, shared song libraries, team RLS policies, invite links, song sync
**Confidence:** HIGH

## Summary

Phase 4 adds band workspaces on top of the existing personal song library and setlist builder. The core technical challenges are: (1) a database schema that models bands, memberships, and ownership correctly, (2) RLS policies that allow all band members to read/write band-scoped data while keeping personal data private, (3) a song linking mechanism that lets the same underlying song appear in both personal and band contexts with synchronized edits, and (4) one-time invite links for band membership.

The existing codebase uses Supabase with per-user RLS policies (`(select auth.uid()) = user_id`). For bands, the pattern shifts to membership-based access: `band_id in (select band_id from band_members where user_id = (select auth.uid()))`. This subquery pattern is well-documented in Supabase's RLS best practices and performs well with proper indexing. A `security definer` helper function (`user_band_ids()`) is recommended to encapsulate the membership lookup and enable query plan caching.

For song linking, the cleanest architecture avoids duplicating song rows. Instead, a `band_songs` junction table references the original song in the `songs` table. The song remains owned by its creator in the `songs` table, but is "shared" into the band via `band_songs`. Band members see all songs referenced in `band_songs`, and edits to the underlying song are instantly visible everywhere because there is only one row. When a member leaves, their `band_songs` references remain (the band "owns" the references). Songs can also be created directly for the band (no personal library link) by inserting into `songs` with `user_id` of the creator and adding a `band_songs` reference simultaneously.

**Primary recommendation:** Use a junction-table approach for song sharing (no duplication), a `user_band_ids()` security definer function for RLS performance, nested SvelteKit routes under `/bands/[id]/` for the band workspace, and a simple token-based invite link system stored in a `band_invites` table.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Bands appear as a separate nav item alongside Songs and Setlists (not a workspace switcher dropdown)
- Users can be in multiple bands simultaneously -- each band listed separately in the Bands section
- Clicking into a band shows a band dashboard: band name, members list, recent setlists, song count
- Inside a band, sub-navigation shows band-specific tabs: Songs, Setlists, Members -- feels like a distinct workspace
- Members can copy songs from their personal library into the band OR add new songs directly to the band
- Songs copied from personal library stay linked (synced) -- edits to either copy reflect in both
- Any band member can edit or delete any band song -- fully collaborative, no per-song permissions
- When a member leaves the band, their contributed songs stay in the band library -- the band owns them
- Band invitations work via shareable invite links (like Discord), not email
- Invite links are one-time use -- owner generates a new link per invite
- Creator is the band owner -- only owner can invite, remove members, and delete the band
- Members can do everything else (add/edit songs, create/edit setlists)
- Owner can transfer ownership to another member before leaving -- band continues under new owner
- Any band member can create, edit, and delete band setlists -- fully collaborative
- Band setlists pull songs from the band library only (not personal libraries)
- Band setlists get the same share toggle and public link as personal setlists -- any member can share
- Shared band setlists display band name and logo (if set) in the public view instead of personal profile

### Claude's Discretion
- Database schema design for bands, band_members, band_songs tables
- RLS policy structure for band-scoped access
- How song sync/linking is implemented technically
- Band dashboard layout and component structure
- Sub-navigation implementation approach (tabs, nested routes, etc.)
- Invite link generation and validation mechanism

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BAND-01 | User can create a band/group | `bands` table with `owner_id` FK to auth.users; SvelteKit form action to insert band + auto-insert creator as first band_member; new `/bands` route in nav |
| BAND-02 | User can invite members to a band | `band_invites` table with one-time-use token (UUID); owner generates link via form action; invitee visits `/bands/invite/[token]` to accept; acceptance inserts into `band_members` and marks invite as used |
| BAND-03 | Band members share a common song library | `band_songs` junction table linking bands to songs; personal songs shared via junction reference (no duplication); songs created directly for band also go through junction; RLS policies grant access to all band members via membership subquery |
| BAND-04 | Band members can create and edit shared setlists | `band_id` nullable FK on `setlists` table; band setlists have `band_id` set; RLS policies allow band member access; builder page loads band songs (not personal library) when editing a band setlist |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.96.0 | Database client (already installed) | Existing dependency; handles all DB operations including band tables |
| @supabase/ssr | ^0.8.0 | Server-side Supabase client (already installed) | Existing dependency; SSR auth and data loading |
| svelte-dnd-action | ^0.9.69 | Drag-and-drop for band setlist builder (already installed) | Existing dependency; band setlist builder reuses the same DnD pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | - | All needs covered by existing stack | No new dependencies required for Phase 4 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Junction table for song sharing | Duplicate song rows with trigger sync | Triggers add complexity, risk infinite loops, harder to debug. Junction table is simpler, uses standard FK relationships |
| Token-based invite links | Supabase Auth invite emails | User decision specifies Discord-style links, not email invites. Custom tokens are simpler and match the UX requirement |
| Nullable `band_id` on setlists | Separate `band_setlists` table | Nullable FK reuses existing setlist infrastructure (form actions, DnD builder, share toggle). Separate table would duplicate significant code |

**Installation:**
```bash
# No new packages needed -- all dependencies already installed
```

## Architecture Patterns

### Recommended Project Structure
```
supabase/migrations/
└── 20260221000000_create_band_tables.sql   # bands, band_members, band_songs, band_invites + RLS

src/routes/(app)/
├── bands/
│   ├── +page.server.ts          # List user's bands + create band action
│   ├── +page.svelte             # Band list (card grid, like setlists)
│   ├── invite/
│   │   └── [token]/
│   │       ├── +page.server.ts  # Accept invite (validate token, insert member)
│   │       └── +page.svelte     # Accept invite UI (band name, join button)
│   └── [id]/
│       ├── +layout.server.ts    # Load band data + verify membership
│       ├── +layout.svelte       # Band workspace shell with sub-nav tabs
│       ├── +page.server.ts      # Band dashboard data (stats, recent setlists)
│       ├── +page.svelte         # Band dashboard
│       ├── songs/
│       │   ├── +page.server.ts  # Band songs + add/remove actions
│       │   └── +page.svelte     # Band song library (reuse SongRow patterns)
│       ├── setlists/
│       │   ├── +page.server.ts  # Band setlists + create action
│       │   ├── +page.svelte     # Band setlist grid (reuse SetlistCard)
│       │   └── [setlistId]/
│       │       ├── +page.server.ts  # Band setlist builder data
│       │       └── +page.svelte     # Band setlist builder (reuse DnD pattern)
│       └── members/
│           ├── +page.server.ts  # Member list + invite/remove actions
│           └── +page.svelte     # Member management UI

src/lib/
├── types/
│   └── database.ts              # Add Band, BandMember, BandSong, BandInvite types
└── components/
    └── bands/
        ├── BandCard.svelte      # Card for band list grid
        ├── BandNav.svelte       # Sub-navigation tabs (Songs, Setlists, Members)
        └── MemberRow.svelte     # Member row with role badge and actions
```

### Pattern 1: Database Schema for Bands

**What:** Four new tables plus modifications to setlists for band support
**When to use:** Migration file for this phase
**Confidence:** HIGH -- follows established patterns from existing schema

```sql
-- Bands table
create table public.bands (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references auth.users(id) on delete restrict not null,
  logo_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Band members junction table
create table public.band_members (
  id uuid default gen_random_uuid() primary key,
  band_id uuid references public.bands(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz default now() not null,
  unique(band_id, user_id)
);

-- Band songs junction table (links songs to bands)
-- The song lives in public.songs (owned by its creator)
-- This junction makes it visible in the band's library
create table public.band_songs (
  id uuid default gen_random_uuid() primary key,
  band_id uuid references public.bands(id) on delete cascade not null,
  song_id uuid references public.songs(id) on delete cascade not null,
  added_by uuid references auth.users(id) on delete set null,
  added_at timestamptz default now() not null,
  unique(band_id, song_id)
);

-- Band invite links (one-time use tokens)
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

-- Add band_id to setlists (nullable -- null = personal setlist)
alter table public.setlists add column band_id uuid references public.bands(id) on delete cascade;
create index setlists_band_id_idx on public.setlists(band_id) where band_id is not null;

-- Indexes for RLS performance (CRITICAL)
create index band_members_user_id_idx on public.band_members(user_id);
create index band_members_band_id_idx on public.band_members(band_id);
create index band_songs_band_id_idx on public.band_songs(band_id);
create index band_songs_song_id_idx on public.band_songs(song_id);
create index band_invites_token_idx on public.band_invites(token) where used_at is null;
```

### Pattern 2: Security Definer Helper Function for RLS

**What:** A helper function that returns the band IDs for the current user, enabling efficient RLS policies
**When to use:** Migration file, before RLS policies
**Confidence:** HIGH -- recommended by Supabase official docs for team-based RLS

Source: [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)

```sql
-- Security definer function: returns band IDs for current user
-- Used in RLS policies to avoid repeated subqueries
create or replace function public.user_band_ids()
returns uuid[] as $$
begin
  return array(
    select band_id from public.band_members
    where user_id = (select auth.uid())
  );
end;
$$ language plpgsql security definer stable;
```

### Pattern 3: RLS Policies for Band-Scoped Access

**What:** RLS policies that grant access based on band membership
**When to use:** Migration file, after tables and helper function
**Confidence:** HIGH -- follows Supabase recommended patterns

```sql
-- Bands: members can view; owner can update/delete
alter table public.bands enable row level security;

create policy "Band members can view their bands"
  on public.bands for select to authenticated
  using (id = any((select public.user_band_ids())));

create policy "Authenticated users can create bands"
  on public.bands for insert to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "Band owner can update band"
  on public.bands for update to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

create policy "Band owner can delete band"
  on public.bands for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Band members: members can view; owner manages
alter table public.band_members enable row level security;

create policy "Band members can view members"
  on public.band_members for select to authenticated
  using (band_id = any((select public.user_band_ids())));

create policy "Band owner can add members"
  on public.band_members for insert to authenticated
  with check (band_id in (
    select id from public.bands where owner_id = (select auth.uid())
  ));

create policy "Band owner can remove members"
  on public.band_members for delete to authenticated
  using (band_id in (
    select id from public.bands where owner_id = (select auth.uid())
  ));

-- Band songs: all members can CRUD
alter table public.band_songs enable row level security;

create policy "Band members can view band songs"
  on public.band_songs for select to authenticated
  using (band_id = any((select public.user_band_ids())));

create policy "Band members can add songs to band"
  on public.band_songs for insert to authenticated
  with check (band_id = any((select public.user_band_ids())));

create policy "Band members can remove songs from band"
  on public.band_songs for delete to authenticated
  using (band_id = any((select public.user_band_ids())));

-- Songs table: add policy for band members to view/edit linked songs
create policy "Band members can view band-linked songs"
  on public.songs for select to authenticated
  using (
    id in (
      select song_id from public.band_songs
      where band_id = any((select public.user_band_ids()))
    )
  );

create policy "Band members can update band-linked songs"
  on public.songs for update to authenticated
  using (
    id in (
      select song_id from public.band_songs
      where band_id = any((select public.user_band_ids()))
    )
  );

-- Band invites: owner can create; anyone authenticated can view (to accept)
alter table public.band_invites enable row level security;

create policy "Band owner can create invites"
  on public.band_invites for insert to authenticated
  with check (band_id in (
    select id from public.bands where owner_id = (select auth.uid())
  ));

create policy "Anyone can view valid invites"
  on public.band_invites for select to authenticated
  using (used_at is null and expires_at > now());

create policy "Invite acceptor can mark as used"
  on public.band_invites for update to authenticated
  using (used_at is null and expires_at > now())
  with check (used_by = (select auth.uid()));

-- Setlists: add band member access policies
create policy "Band members can view band setlists"
  on public.setlists for select to authenticated
  using (band_id = any((select public.user_band_ids())));

create policy "Band members can create band setlists"
  on public.setlists for insert to authenticated
  with check (
    band_id is null and (select auth.uid()) = user_id
    or band_id = any((select public.user_band_ids()))
  );

create policy "Band members can update band setlists"
  on public.setlists for update to authenticated
  using (band_id = any((select public.user_band_ids())));

create policy "Band members can delete band setlists"
  on public.setlists for delete to authenticated
  using (band_id = any((select public.user_band_ids())));

-- Setlist songs: add band member access for band setlists
create policy "Band members can manage band setlist songs"
  on public.setlist_songs for all to authenticated
  using (
    setlist_id in (
      select id from public.setlists
      where band_id = any((select public.user_band_ids()))
    )
  );

-- Shared band setlists: anon can view (existing share pattern)
-- The existing anon policy already covers this (share_token is not null)

-- Band profiles visible to anon for shared setlist headers
-- bands table needs anon SELECT for shared band setlist views
create policy "Anyone can view bands for shared setlists"
  on public.bands for select to anon
  using (
    id in (
      select band_id from public.setlists
      where share_token is not null and band_id is not null
    )
  );
```

### Pattern 4: Song Linking via Junction Table (No Duplication)

**What:** Songs live in `public.songs` with their original `user_id`. The `band_songs` junction table links them to bands. No rows are duplicated.
**When to use:** When a band member "copies" a song from their personal library to the band
**Confidence:** HIGH -- standard relational pattern, avoids sync complexity

```
Personal Library        Band Library
┌──────────────┐       ┌──────────────┐
│ songs        │       │ band_songs   │
│ ─────────    │       │ ────────     │
│ id: uuid     │◄──────│ song_id: uuid│
│ user_id: uuid│       │ band_id: uuid│
│ title: text  │       │ added_by     │
│ duration     │       └──────────────┘
│ notes        │
└──────────────┘

User A sees:                    Band sees:
- "Bohemian Rhapsody" (own)     - "Bohemian Rhapsody" (via band_songs)
- "Stairway to Heaven" (own)    - "Stairway to Heaven" (via band_songs)
                                - "Free Bird" (User B's song, via band_songs)

Editing "Bohemian Rhapsody" in EITHER context updates the SAME row.
No triggers, no sync, no duplication.
```

**Server-side: sharing a song to a band:**
```typescript
// In /bands/[id]/songs/+page.server.ts
shareSong: async ({ params, request, locals: { supabase, safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) return fail(401, { error: 'Not authenticated' });

  const formData = await request.formData();
  const song_id = formData.get('song_id') as string;

  // Insert junction row (unique constraint prevents duplicates)
  const { error } = await supabase.from('band_songs').insert({
    band_id: params.id,
    song_id,
    added_by: session.user.id
  });

  if (error?.code === '23505') {
    return fail(409, { error: 'Song already in band library' });
  }
  if (error) return fail(500, { error: 'Failed to add song to band' });
  return { shared: true };
}
```

**Band setlist builder: load band songs instead of personal songs:**
```typescript
// In /bands/[id]/setlists/[setlistId]/+page.server.ts
// Load band songs via the junction table
const { data: bandSongs } = await supabase
  .from('band_songs')
  .select('song_id, songs(id, title, duration_seconds, notes)')
  .eq('band_id', params.id)
  .order('songs(title)');
```

### Pattern 5: Band Workspace Sub-Navigation with Nested Layout

**What:** Band workspace uses a nested `+layout.svelte` under `/bands/[id]/` with tab navigation
**When to use:** All band workspace pages
**Confidence:** HIGH -- standard SvelteKit pattern for nested layouts

Source: [SvelteKit Advanced Routing](https://svelte.dev/docs/kit/advanced-routing)

```svelte
<!-- src/routes/(app)/bands/[id]/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
  import BandNav from '$lib/components/bands/BandNav.svelte';

  let { data, children } = $props();

  let bandId = $derived($page.params.id);
</script>

<div class="flex h-full flex-col">
  <!-- Band header -->
  <div class="border-b border-stone-200 px-6 py-4 dark:border-stone-700">
    <h1 class="font-display text-2xl text-stone-900 dark:text-stone-100">
      {data.band.name}
    </h1>
  </div>

  <!-- Sub-navigation tabs -->
  <BandNav {bandId} />

  <!-- Tab content -->
  <div class="flex-1 overflow-y-auto">
    {@render children()}
  </div>
</div>
```

```svelte
<!-- src/lib/components/bands/BandNav.svelte -->
<script lang="ts">
  import { page } from '$app/stores';

  interface Props { bandId: string; }
  let { bandId }: Props = $props();

  const tabs = [
    { href: `/bands/${bandId}`, label: 'Dashboard', exact: true },
    { href: `/bands/${bandId}/songs`, label: 'Songs' },
    { href: `/bands/${bandId}/setlists`, label: 'Setlists' },
    { href: `/bands/${bandId}/members`, label: 'Members' }
  ];

  function isActive(pathname: string, href: string, exact: boolean): boolean {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }
</script>

<nav class="flex border-b border-stone-200 px-6 dark:border-stone-700">
  {#each tabs as tab}
    <a
      href={tab.href}
      class="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors
        {isActive($page.url.pathname, tab.href, tab.exact ?? false)
          ? 'border-amber-500 text-amber-600 dark:text-amber-400'
          : 'border-transparent text-stone-500 hover:text-stone-700 dark:text-stone-400'}"
    >
      {tab.label}
    </a>
  {/each}
</nav>
```

### Pattern 6: Invite Link Generation and Acceptance

**What:** Owner generates a one-time invite link; authenticated user visits link to join band
**When to use:** Member management page and invite acceptance page
**Confidence:** HIGH -- simple token pattern with database validation

```typescript
// Generate invite (owner only) -- in /bands/[id]/members/+page.server.ts
createInvite: async ({ params, locals: { supabase, safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) return fail(401, { error: 'Not authenticated' });

  const { data: invite, error } = await supabase
    .from('band_invites')
    .insert({
      band_id: params.id,
      created_by: session.user.id
    })
    .select('token')
    .single();

  if (error) return fail(500, { error: 'Failed to create invite' });

  const origin = 'https://your-app.com'; // or from request headers
  const inviteUrl = `${origin}/bands/invite/${invite.token}`;
  return { inviteUrl };
}

// Accept invite -- in /bands/invite/[token]/+page.server.ts
export const actions: Actions = {
  accept: async ({ params, locals: { supabase, safeGetSession } }) => {
    const { session } = await safeGetSession();
    if (!session) return fail(401, { error: 'Not authenticated' });

    // Load invite
    const { data: invite } = await supabase
      .from('band_invites')
      .select('id, band_id')
      .eq('token', params.token)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!invite) return fail(404, { error: 'Invalid or expired invite' });

    // Add user to band
    const { error: memberError } = await supabase
      .from('band_members')
      .insert({
        band_id: invite.band_id,
        user_id: session.user.id,
        role: 'member'
      });

    if (memberError?.code === '23505') {
      // Already a member -- just redirect
      throw redirect(303, `/bands/${invite.band_id}`);
    }
    if (memberError) return fail(500, { error: 'Failed to join band' });

    // Mark invite as used
    await supabase
      .from('band_invites')
      .update({ used_by: session.user.id, used_at: new Date().toISOString() })
      .eq('id', invite.id);

    throw redirect(303, `/bands/${invite.band_id}`);
  }
};
```

### Pattern 7: Ownership Transfer

**What:** Band owner transfers ownership to another member before leaving
**When to use:** Member management page
**Confidence:** HIGH -- simple two-step update in a single action

```typescript
// Transfer ownership -- in /bands/[id]/members/+page.server.ts
transferOwnership: async ({ params, request, locals: { supabase, safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) return fail(401, { error: 'Not authenticated' });

  const formData = await request.formData();
  const newOwnerId = formData.get('new_owner_id') as string;

  // Update band owner
  const { error: bandError } = await supabase
    .from('bands')
    .update({ owner_id: newOwnerId })
    .eq('id', params.id)
    .eq('owner_id', session.user.id); // Only current owner can transfer

  if (bandError) return fail(500, { error: 'Failed to transfer ownership' });

  // Update member roles
  await supabase
    .from('band_members')
    .update({ role: 'owner' })
    .eq('band_id', params.id)
    .eq('user_id', newOwnerId);

  await supabase
    .from('band_members')
    .update({ role: 'member' })
    .eq('band_id', params.id)
    .eq('user_id', session.user.id);

  return { transferred: true };
}
```

### Pattern 8: Shared Band Setlist Public View

**What:** When a band setlist is shared, the public view shows band name and logo instead of personal profile
**When to use:** Modify the existing `/share/[token]/+page.server.ts`
**Confidence:** HIGH -- extends existing pattern

```typescript
// Modified share route load function
export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  const { data: setlist } = await supabase
    .from('setlists')
    .select('id, name, gig_date, venue, user_id, band_id')
    .eq('share_token', params.token)
    .single();

  if (!setlist) throw error(404, 'Setlist not found');

  // ... load songs as before ...

  // Load band OR personal profile depending on context
  let displayProfile = null;
  if (setlist.band_id) {
    const { data: band } = await supabase
      .from('bands')
      .select('name, logo_url')
      .eq('id', setlist.band_id)
      .single();
    displayProfile = band ? { display_name: band.name, logo_url: band.logo_url } : null;
  } else {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, logo_url')
      .eq('id', setlist.user_id)
      .maybeSingle();
    displayProfile = profile;
  }

  return {
    setlist: { name: setlist.name, gig_date: setlist.gig_date, venue: setlist.venue },
    songs: /* ... */,
    profile: displayProfile
  };
};
```

### Anti-Patterns to Avoid
- **Duplicating song rows for band sharing:** Creates sync nightmare. Use junction table instead -- one row, multiple contexts.
- **Using JWT custom claims for band membership:** Band membership changes frequently (join/leave). JWT claims are only refreshed on token refresh. Use database lookups with `security definer` functions instead.
- **Separate `band_setlists` table:** Duplicates all setlist logic (CRUD, DnD, share toggle). Use nullable `band_id` on existing `setlists` table.
- **Checking ownership in application code instead of RLS:** All access control must be enforced at the database level via RLS. Application code can add UX-level checks but must not be the sole enforcement.
- **Missing indexes on `band_members.user_id`:** This column is hit by every RLS policy evaluation. Without an index, queries degrade badly with scale.
- **Using `for all` RLS policies where different roles have different permissions:** The owner vs member distinction requires separate policies per operation (select, insert, update, delete) since the owner has extra powers (invite, remove, delete band).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Song synchronization | Trigger-based bidirectional sync between personal and band copies | Junction table (`band_songs`) referencing single song row | Zero sync complexity, zero trigger recursion risk, zero data inconsistency |
| Invite token generation | Custom random string generator | Postgres `gen_random_uuid()` via default column value | Cryptographically secure, collision-proof, standard format |
| Membership-based RLS | Application-level access checks in every server route | Supabase RLS policies with `user_band_ids()` function | Database-level enforcement, cannot be bypassed, tested patterns |
| Band workspace layout | Custom layout switching logic | SvelteKit nested `+layout.svelte` under `/bands/[id]/` | Framework provides layout inheritance, data loading, navigation |
| Invite link expiration | Cron job to clean up expired invites | `expires_at` column with check in query `WHERE expires_at > now()` | No background process needed; expired invites simply fail validation |

**Key insight:** The song linking decision ("synced edits reflect in both") is perfectly served by NOT copying data. A junction table approach means there is literally one source of truth -- the original song row. "Sync" is automatic because there is nothing to sync.

## Common Pitfalls

### Pitfall 1: Existing RLS Policies Blocking Band Access to Songs
**What goes wrong:** Band members can't see or edit songs shared to the band because existing `songs` table policies only allow `user_id = auth.uid()`.
**Why it happens:** The original songs RLS policies are strictly per-user. Band members who didn't create a song can't access it even if it's shared to their band.
**How to avoid:** Add new RLS policies on `songs` that grant SELECT and UPDATE to authenticated users where `id in (select song_id from band_songs where band_id = any(user_band_ids()))`. Keep existing per-user policies intact -- they work in parallel (OR logic).
**Warning signs:** "Permission denied" errors when band members try to view or edit band songs they didn't create.

### Pitfall 2: Band Setlist Builder Loading Personal Songs
**What goes wrong:** The setlist builder at `/bands/[id]/setlists/[setlistId]` loads the user's personal song library instead of the band's shared library.
**Why it happens:** The existing builder loads songs with `.eq('user_id', session.user.id)`. Band context requires loading via `band_songs` junction instead.
**How to avoid:** The band setlist builder's `+page.server.ts` must detect band context (from the URL or setlist's `band_id`) and load songs via `band_songs.select('song_id, songs(*)').eq('band_id', bandId)`.
**Warning signs:** Band setlist shows personal songs; songs added to band library don't appear in band setlist builder.

### Pitfall 3: Invite Link Reuse
**What goes wrong:** A used invite link works again, allowing unauthorized people to join.
**Why it happens:** Not checking `used_at` in the acceptance query.
**How to avoid:** Always query invites with `.is('used_at', null)` and `.gt('expires_at', now())`. Mark as used (set `used_at` and `used_by`) in the same action that inserts the member.
**Warning signs:** Multiple users joining from the same link; invite count doesn't match member count.

### Pitfall 4: Navigation Breaking When Switching Between Personal and Band Contexts
**What goes wrong:** Sidebar highlights wrong item; breadcrumbs confused; "Add Song" links to personal library from band context.
**Why it happens:** Personal routes (`/songs`, `/setlists`) and band routes (`/bands/[id]/songs`, `/bands/[id]/setlists`) are separate paths but look similar.
**How to avoid:** Use `$page.url.pathname` to determine context. Band pages should never link to personal routes. The `isActive()` helper in Sidebar/BottomNav must correctly match `/bands` as a top-level section.
**Warning signs:** "Add Song" in band context navigates to `/songs/new` instead of band song add; sidebar shows "Songs" as active when viewing band songs.

### Pitfall 5: Deleting a Song That's in a Band Library
**What goes wrong:** User deletes a personal song that's also shared in a band. The `band_songs` reference breaks, or the band loses the song.
**Why it happens:** `songs.id` CASCADE delete removes both the personal song AND the `band_songs` junction row.
**How to avoid:** This is actually the desired behavior per the schema (`on delete cascade`). However, the UX should warn the user: "This song is shared in [Band Name]. Deleting it will also remove it from the band library." Add a check before delete that queries `band_songs` for the song ID.
**Warning signs:** Songs silently disappearing from band libraries after personal deletion without warning.

### Pitfall 6: Owner Leaving Without Transferring Ownership
**What goes wrong:** Band owner leaves the band, and no one can manage it (invite, remove members, delete band).
**Why it happens:** No enforcement that owner must transfer before leaving.
**How to avoid:** The "leave band" action for the owner must require ownership transfer first. Block the owner from removing themselves until they've transferred ownership. If the owner is the last member, allow them to delete the band instead.
**Warning signs:** Orphaned bands with no owner; members unable to invite others or manage the band.

### Pitfall 7: RLS Policy Performance with Multiple Bands
**What goes wrong:** Page loads become slow as users join more bands because `user_band_ids()` is called in every RLS policy evaluation.
**Why it happens:** Without the `security definer` function, each policy does its own subquery. Even with the function, missing indexes cause sequential scans.
**How to avoid:** Use the `user_band_ids()` security definer function (allows Postgres to cache the result per statement). Index `band_members(user_id)` and `band_members(band_id)`. The function is marked `stable` so Postgres knows it can cache within a single query.
**Warning signs:** Slow page loads proportional to number of bands; increasing latency as membership grows.

## Code Examples

### Creating a Band with Auto-Membership
```typescript
// In /bands/+page.server.ts
create: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) return fail(401, { error: 'Not authenticated' });

  const formData = await request.formData();
  const name = (formData.get('name') as string)?.trim();
  if (!name) return fail(400, { error: 'Band name is required' });

  // Create band
  const { data: band, error: bandError } = await supabase
    .from('bands')
    .insert({ name, owner_id: session.user.id })
    .select('id')
    .single();

  if (bandError || !band) return fail(500, { error: 'Failed to create band' });

  // Add creator as owner member
  await supabase.from('band_members').insert({
    band_id: band.id,
    user_id: session.user.id,
    role: 'owner'
  });

  throw redirect(303, `/bands/${band.id}`);
}
```

### Loading Band Dashboard Data
```typescript
// In /bands/[id]/+layout.server.ts
export const load = async ({ params, locals: { supabase, safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) throw error(401, 'Not authenticated');

  // Load band (RLS ensures user is a member)
  const { data: band } = await supabase
    .from('bands')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!band) throw error(404, 'Band not found');

  // Load membership to determine role
  const { data: membership } = await supabase
    .from('band_members')
    .select('role')
    .eq('band_id', params.id)
    .eq('user_id', session.user.id)
    .single();

  return { band, isOwner: membership?.role === 'owner' };
};
```

### Adding Bands to Navigation
```typescript
// Sidebar.svelte navItems -- add Bands
const navItems = [
  { href: '/', label: 'Home', icon: '...' },
  { href: '/songs', label: 'Songs', icon: '...' },
  { href: '/setlists', label: 'Setlists', icon: '...' },
  { href: '/bands', label: 'Bands', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { href: '/settings', label: 'Settings', icon: '...' }
];
```

### Band TypeScript Types
```typescript
// In src/lib/types/database.ts
export interface Band {
  id: string;
  name: string;
  owner_id: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BandMember {
  id: string;
  band_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface BandSong {
  id: string;
  band_id: string;
  song_id: string;
  added_by: string | null;
  added_at: string;
}

export interface BandInvite {
  id: string;
  band_id: string;
  token: string;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
  expires_at: string;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JWT custom claims for team membership | Database lookups with `security definer` functions | Supabase best practices (2025) | JWT claims don't update in real-time; DB lookups with caching are more reliable for mutable membership |
| Duplicate rows with trigger sync | Junction tables referencing single source | Standard relational design | Eliminates sync bugs, reduces storage, simplifies queries |
| `auth.uid() = user_id` in every policy | `(select auth.uid())` wrapped in SELECT | Supabase RLS performance guide (2025) | Up to 95% faster due to initPlan caching |
| `EXISTS (subquery)` per-row in policies | `= any((select function()))` with security definer | Supabase RLS troubleshooting guide | 10-100x faster on large tables due to single function evaluation |

**Deprecated/outdated:**
- `on:event` syntax in svelte-dnd-action: Use `onevent` (no colon) for Svelte 5 (already adopted in Phase 3)
- Storing membership in JWT `app_metadata`: Works for static roles but not for frequently changing band membership

## Open Questions

1. **Song deletion warning UX**
   - What we know: CASCADE delete on `songs` will remove `band_songs` references. User should be warned.
   - What's unclear: Exact UX flow -- modal warning? Inline text? Blocking deletion?
   - Recommendation: Check `band_songs` before delete; show confirm dialog with band name(s) if song is shared. Non-blocking (user can still delete).

2. **Band logo upload reuse**
   - What we know: Settings page already has `LogoUpload` component for personal profile logos. Bands need logos too.
   - What's unclear: Whether to reuse the same storage bucket with band-scoped folders, or create a separate bucket.
   - Recommendation: Reuse the `logos` bucket. Use folder path `bands/{band_id}/logo.{ext}` alongside existing `{user_id}/logo.{ext}`. Add storage RLS policy for band owner uploads.

3. **Existing personal setlist RLS policy conflicts**
   - What we know: Current setlist policies check `(select auth.uid()) = user_id`. Adding `band_id` to setlists means band setlists have a `user_id` (creator) that differs from other band members.
   - What's unclear: Whether the existing `user_id`-based policies will interfere with band setlist access.
   - Recommendation: Band setlists should set `user_id` to the creator BUT access is controlled by the band membership policies. The existing personal policies continue to work for personal setlists (`band_id is null`). New band policies handle band setlists (`band_id is not null`). Policies are ORed together by Postgres -- no conflict.

4. **Personal library songs RLS for band member editing**
   - What we know: When User A shares a song to the band, User B needs to be able to UPDATE that song. But the existing songs UPDATE policy only allows `user_id = auth.uid()`.
   - What's unclear: Whether the new band-scoped UPDATE policy will conflict with the existing one.
   - Recommendation: Add a new UPDATE policy for band-linked songs. Postgres ORs all policies for the same operation -- if ANY policy passes, access is granted. The existing personal policy still works, and the new band policy adds band member access. Test thoroughly.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `supabase/migrations/`, `src/routes/`, `src/lib/` -- established patterns for RLS, form actions, page structure
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- policy syntax, `(select auth.uid())` pattern, role-based access
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) -- `security definer` function pattern, index requirements, `user_teams()` example
- [Supabase Triggers Docs](https://supabase.com/docs/guides/database/postgres/triggers) -- trigger function syntax (evaluated but NOT recommended for song sync)
- [SvelteKit Advanced Routing](https://svelte.dev/docs/kit/advanced-routing) -- route groups, nested layouts

### Secondary (MEDIUM confidence)
- [Supabase RLS Best Practices (MakerKit)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices) -- team membership patterns, security definer optimization
- [Multi-Tenant RLS (AntStack)](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) -- tenant_id pattern adapted for band_id
- [Supabase RLS Performance Discussion #14576](https://github.com/orgs/supabase/discussions/14576) -- real-world performance data with subqueries

### Tertiary (LOW confidence)
- PostgreSQL bidirectional trigger sync research -- evaluated and rejected in favor of junction table approach (confirmed by multiple sources as overly complex for this use case)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies; all patterns use existing libraries
- Architecture: HIGH -- schema design follows established Supabase multi-tenant patterns; junction table approach is standard relational design; SvelteKit nested routes are well-documented
- Pitfalls: HIGH -- RLS policy conflicts identified from codebase analysis; performance patterns verified against Supabase official docs; song deletion cascade identified from schema inspection

**Research date:** 2026-02-21
**Valid until:** 2026-03-21 (stable domain; all technologies mature)
