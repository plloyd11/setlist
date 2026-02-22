# Phase 3: Setlist Builder - Research

**Researched:** 2026-02-18
**Domain:** Drag-and-drop setlist builder, Supabase schema design, public sharing, image uploads
**Confidence:** HIGH

## Summary

Phase 3 introduces the core product feature: building timed setlists from a song library via drag-and-drop, with public sharing via link. The technical domain spans four areas: (1) database schema for setlists with ordered songs, (2) drag-and-drop with cross-panel support, (3) Supabase Storage for band logo uploads, and (4) anonymous/public access for shared setlist views.

The existing codebase (Svelte 5, SvelteKit 2, Supabase, Tailwind 4) provides solid foundations. The songs table and RLS patterns from Phase 2 serve as templates. The auth guard in `hooks.server.ts` needs modification to allow unauthenticated access to shared setlist routes. The `svelte-dnd-action` library is the clear choice for drag-and-drop, offering mature Svelte 5 support, cross-container drag, drag handles, and accessibility.

**Primary recommendation:** Use `svelte-dnd-action` for drag-and-drop, a `share_token` UUID column on setlists for public sharing, Supabase Storage public bucket for logos, and a dedicated `/share/[token]` route outside the `(app)` group for anonymous access.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two-panel side-by-side on desktop: song library panel on left, setlist panel on right
- Drag songs from library panel into specific positions in the setlist (cross-panel drag)
- Drag handle on each setlist row with smooth animated reordering
- Mobile: tab/toggle switch between "Library" and "Setlist" views (tap song in library to add)
- Setlist header section: band logo at top, date and venue name below logo, above song listings
- Logo is set at user/band level (not per-setlist) — applied to all setlists automatically
- Sticky header/footer bar always visible showing total time, target time, and over/under
- Progress bar visual for over/under indicator — fills toward target, changes color when over
- Each song row shows only its own duration (no cumulative running time)
- Transition time (global gap between songs) configured via input/stepper in the sticky timing bar
- "All setlists" view uses card grid layout (name, date, venue, song count, total time per card)
- Quick-create flow: click "New Setlist", enter name, land in builder. Add date/venue/target later.
- Duplicate action available (creates copy with "(Copy)" suffix)
- Single set per setlist (no multi-set support — create separate setlists for Set 1, Set 2)
- Per-setlist fields: name (required), gig date (optional), venue name (optional), target time (optional)
- Toggle sharing on/off per setlist — generates public link when enabled, revokes when disabled
- Shared view is a clean performance view: logo, band/user name, date, venue, numbered song titles
- No durations or timing details in shared view (backstage info stays private)
- Print-optimized stylesheet for shared view — clean layout, no nav chrome, looks good on paper

### Claude's Discretion
- Exact drag-and-drop library choice and implementation approach
- Loading states, error handling, and empty state designs
- Card grid responsive breakpoints and exact card layout
- Progress bar styling and animation details
- How to handle the logo upload (storage, sizing, format)

### Deferred Ideas (OUT OF SCOPE)
- Multi-set support (Set 1, Set 2, Encore within one setlist) — potential future enhancement
- Per-setlist logo override — currently using user/band-level logo only
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SET-01 | User can create a new setlist with a name | DB schema: `setlists` table with name field; SvelteKit form action pattern from Phase 2 |
| SET-02 | User can drag songs from their library into a setlist | `svelte-dnd-action` cross-container drag with shared type; library panel as source zone |
| SET-03 | User can reorder songs in a setlist via drag-and-drop | `svelte-dnd-action` single-container reorder with drag handles; `position` column for ordering |
| SET-04 | User can remove a song from a setlist | Delete from `setlist_songs` junction table; button on each setlist row |
| SET-05 | User can see a live-updating running time total for their setlist | Client-side `$derived` computation from song durations + transition gaps |
| SET-06 | User can set a target time and see over/under indicator | `target_seconds` column on setlists; progress bar component with color thresholds |
| SET-07 | User can set a global transition time between songs that adds to the total | `transition_seconds` column on setlists; stepper input in sticky timing bar |
| SET-08 | User can duplicate an existing setlist | Server action: copy setlist row + all setlist_songs rows; append "(Copy)" to name |
| SET-09 | User can delete a setlist | Server action with cascade delete of setlist_songs; confirm dialog pattern from Phase 2 |
| SET-10 | User can edit a setlist's name | Inline editing pattern from Phase 2 SongRow; client-side Supabase update |
| SHARE-01 | User can generate a read-only shareable link for a setlist | `share_token` UUID column; toggle generates/revokes token; RLS policy for anon SELECT |
| SHARE-02 | Anyone with the link can view the setlist without an account | `/share/[token]` route outside `(app)` group; auth guard exemption in hooks.server.ts |
| UX-01 | App is fully usable on mobile devices (responsive design) | Tab toggle for library/setlist views on mobile; touch support via svelte-dnd-action; responsive card grid |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| svelte-dnd-action | ^0.9.69 | Drag-and-drop (reorder + cross-container) | 40K+ weekly npm downloads, mature Svelte 5 support, accessibility built-in, touch + keyboard support, drag handles, cross-container drag. The most battle-tested DnD library in the Svelte ecosystem. |
| @supabase/supabase-js | ^2.96.0 | Database + Storage client (already installed) | Already in the project; provides Storage API for logo uploads |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none needed) | - | - | All other needs covered by existing stack (Tailwind, SvelteKit, Supabase) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| svelte-dnd-action | @thisux/sveltednd | Svelte 5-native with runes, but v0.0.20, last published a year ago, ~496 GitHub stars vs svelte-dnd-action's maturity. Too risky for production. |
| svelte-dnd-action | HTML5 Drag API (native) | Zero dependencies but no touch support, no accessibility, no animation, much more code to write. |
| svelte-dnd-action | SortableJS | Framework-agnostic but no official Svelte 5 wrapper; would require custom integration. |

**Installation:**
```bash
pnpm add -D svelte-dnd-action
```

## Architecture Patterns

### Recommended Project Structure
```
src/routes/
├── (app)/
│   ├── setlists/
│   │   ├── +page.server.ts      # List all setlists (load + delete/duplicate actions)
│   │   ├── +page.svelte          # Card grid view of all setlists
│   │   └── [id]/
│   │       ├── +page.server.ts   # Load single setlist with songs + user's song library
│   │       └── +page.svelte      # Builder view (two-panel / mobile toggle)
│   └── settings/
│       └── +page.svelte          # Logo upload lives here (user-level setting)
├── share/
│   └── [token]/
│       ├── +page.server.ts       # Load shared setlist by share_token (no auth required)
│       └── +page.svelte          # Clean performance view + print styles
└── ...

src/lib/
├── components/
│   ├── setlists/
│   │   ├── SetlistCard.svelte        # Card for the grid view
│   │   ├── SetlistSongRow.svelte     # Row in the builder (drag handle, duration, remove)
│   │   ├── LibrarySongRow.svelte     # Row in library panel (draggable into setlist)
│   │   ├── TimingBar.svelte          # Sticky bar: total time, target, progress, transition stepper
│   │   └── SetlistHeader.svelte      # Logo + date + venue header
│   └── ui/
│       ├── ProgressBar.svelte        # Over/under indicator
│       └── LogoUpload.svelte         # Image upload component
├── types/
│   └── database.ts                   # Add Setlist, SetlistSong types
└── utils/
    └── duration.ts                   # Already exists; may need formatMinutes for total display
```

### Pattern 1: Database Schema Design
**What:** Three new tables plus a user profile extension for the logo
**When to use:** Migration file for this phase

```sql
-- User profiles for logo storage (user-level, not per-setlist)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  logo_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Setlists table
create table public.setlists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  gig_date date,
  venue text,
  target_seconds integer check (target_seconds is null or target_seconds > 0),
  transition_seconds integer not null default 0 check (transition_seconds >= 0),
  share_token uuid unique,  -- null = not shared; populated = shared
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Junction table: songs in a setlist with ordering
create table public.setlist_songs (
  id uuid default gen_random_uuid() primary key,
  setlist_id uuid references public.setlists(id) on delete cascade not null,
  song_id uuid references public.songs(id) on delete cascade not null,
  position integer not null check (position >= 0),
  created_at timestamptz default now() not null,
  unique(setlist_id, position)  -- enforce unique positions within a setlist
);

-- Indexes
create index setlists_user_id_idx on public.setlists(user_id);
create index setlists_share_token_idx on public.setlists(share_token) where share_token is not null;
create index setlist_songs_setlist_id_idx on public.setlist_songs(setlist_id);
create index setlist_songs_position_idx on public.setlist_songs(setlist_id, position);
```

### Pattern 2: RLS Policies for Owner + Public Sharing
**What:** Owner has full CRUD; anyone can read shared setlists via share_token
**When to use:** In the same migration file

```sql
-- Setlists: owner full access
alter table public.setlists enable row level security;

create policy "Users can view their own setlists"
  on public.setlists for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert their own setlists"
  on public.setlists for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own setlists"
  on public.setlists for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own setlists"
  on public.setlists for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Public sharing: anon can read setlists with a share_token
-- (the token acts as the access credential)
create policy "Anyone can view shared setlists"
  on public.setlists for select to anon
  using (share_token is not null);

-- Setlist songs: owner access via setlist ownership
alter table public.setlist_songs enable row level security;

create policy "Users can manage songs in their setlists"
  on public.setlist_songs for all to authenticated
  using (
    setlist_id in (select id from public.setlists where user_id = (select auth.uid()))
  );

-- Public sharing: anon can read songs in shared setlists
create policy "Anyone can view songs in shared setlists"
  on public.setlist_songs for select to anon
  using (
    setlist_id in (select id from public.setlists where share_token is not null)
  );

-- Profiles: owner access + anon read for shared views (to show logo/name)
alter table public.profiles enable row level security;

create policy "Users can manage their own profile"
  on public.profiles for all to authenticated
  using ((select auth.uid()) = id);

create policy "Anyone can view profiles"
  on public.profiles for select to anon
  using (true);
```

### Pattern 3: svelte-dnd-action Cross-Container Drag (Svelte 5)
**What:** Library panel songs can be dragged into setlist panel; setlist panel supports reordering
**When to use:** Builder page component

```svelte
<script lang="ts">
  import { dndzone, SHADOW_ITEM_MARKER_PROPERTY_NAME } from 'svelte-dnd-action';

  let libraryItems = $state(data.songs.map(s => ({ ...s, id: s.id })));
  let setlistItems = $state(data.setlistSongs.map(s => ({ ...s, id: s.id })));

  const flipDurationMs = 200;

  // Library zone: copy-on-drag (songs stay in library)
  function handleLibraryConsider(e: CustomEvent) {
    libraryItems = e.detail.items;
  }
  function handleLibraryFinalize(e: CustomEvent) {
    // Reset library to original (copy-on-drag pattern)
    libraryItems = data.songs.map(s => ({ ...s, id: s.id }));
  }

  // Setlist zone: receives items and allows reorder
  function handleSetlistConsider(e: CustomEvent) {
    setlistItems = e.detail.items;
  }
  function handleSetlistFinalize(e: CustomEvent) {
    setlistItems = e.detail.items;
    // Persist new order to database
    saveOrder(setlistItems);
  }
</script>

<!-- Library panel -->
<div
  use:dndzone={{
    items: libraryItems,
    flipDurationMs,
    type: 'setlist-songs',
    dropFromOthersDisabled: true
  }}
  onconsider={handleLibraryConsider}
  onfinalize={handleLibraryFinalize}
>
  {#each libraryItems as song (song.id)}
    <div>{song.title}</div>
  {/each}
</div>

<!-- Setlist panel -->
<div
  use:dndzone={{
    items: setlistItems,
    flipDurationMs,
    type: 'setlist-songs',
    dragDisabled: false
  }}
  onconsider={handleSetlistConsider}
  onfinalize={handleSetlistFinalize}
>
  {#each setlistItems as song (song.id)}
    <div>{song.title} - {formatDuration(song.duration_seconds)}</div>
  {/each}
</div>
```

### Pattern 4: Auth Guard Exemption for Share Routes
**What:** Modify hooks.server.ts to allow unauthenticated access to `/share/*` routes
**When to use:** hooks.server.ts modification

```typescript
// In hooks.server.ts - modify the auth guard
if (!event.url.pathname.startsWith('/auth') && !event.url.pathname.startsWith('/share')) {
  const { session } = await event.locals.safeGetSession();
  if (!session) {
    throw redirect(303, '/auth');
  }
}
```

### Pattern 5: Timing Calculations with $derived
**What:** All timing is computed client-side from song data
**When to use:** Builder page or TimingBar component

```typescript
let totalSongSeconds = $derived(
  setlistItems.reduce((sum, song) => sum + song.duration_seconds, 0)
);

let totalTransitionSeconds = $derived(
  setlistItems.length > 1
    ? (setlistItems.length - 1) * setlist.transition_seconds
    : 0
);

let totalSeconds = $derived(totalSongSeconds + totalTransitionSeconds);

let overUnderSeconds = $derived(
  setlist.target_seconds ? totalSeconds - setlist.target_seconds : 0
);

let progressPercent = $derived(
  setlist.target_seconds
    ? Math.min((totalSeconds / setlist.target_seconds) * 100, 150)
    : 0
);

let isOver = $derived(
  setlist.target_seconds ? totalSeconds > setlist.target_seconds : false
);
```

### Pattern 6: Logo Upload with Supabase Storage
**What:** Public bucket for logos; upload from settings page; serve via public URL
**When to use:** Settings page + profile data

```typescript
// Upload logo
async function uploadLogo(file: File) {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/logo.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('logos')
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('logos').getPublicUrl(filePath);

  // Save URL to profile
  await supabase.from('profiles').upsert({
    id: userId,
    logo_url: data.publicUrl
  });
}
```

### Anti-Patterns to Avoid
- **Storing sort order only in client state:** Always persist `position` to DB after reorder. Use optimistic updates but ensure server sync.
- **Cumulative position integers (1,2,3...):** When reordering, update all positions in a batch rather than trying to insert "between" positions. The `unique(setlist_id, position)` constraint requires careful ordering of updates.
- **Loading full song data in the shared view:** The shared view only needs title + position. Don't expose duration, notes, or user data in the anon query.
- **Making the share route a layout group child of (app):** The `/share/[token]` route must be outside the `(app)` group to avoid inheriting the authenticated layout (sidebar, nav).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-and-drop reordering | Custom drag event handlers | svelte-dnd-action | Touch support, accessibility (keyboard nav, screen readers), animation, shadow items, auto-scroll — enormous complexity |
| Cross-container drag | Custom drag-enter/leave logic | svelte-dnd-action `type` system | Shared type between zones handles all the coordination; copy-on-drag is a built-in pattern |
| UUID generation for share tokens | Custom random string generation | `gen_random_uuid()` in Postgres | Cryptographically random, no collisions, standard UUID format |
| Image resizing | Server-side image processing | Supabase Storage image transforms OR client-side resize before upload | Supabase handles transforms via URL params; or use canvas resize on client. Avoid adding sharp/jimp dependencies. |
| Print stylesheets | Complex JS print handling | Tailwind `print:` variant + `@media print` | Built into Tailwind 4; use `print:hidden` to hide nav, `print:block` to show print-only elements |

**Key insight:** The drag-and-drop interaction is by far the most complex piece of this phase. Rolling custom DnD code would consume the majority of development time and still miss edge cases (touch devices, accessibility, animations, scroll containers).

## Common Pitfalls

### Pitfall 1: svelte-dnd-action with $state Reactivity
**What goes wrong:** Items stored with `$state` can cause issues with certain versions of svelte-dnd-action due to Svelte 5's proxy-based reactivity.
**Why it happens:** svelte-dnd-action mutates the items array internally; Svelte 5's `$state` wraps arrays in proxies which can interfere.
**How to avoid:** Use version 0.9.69+ (which includes fixes). If issues persist, spread items when passing to the zone: `items: [...myItems]`. Test thoroughly after setup.
**Warning signs:** Items disappearing during drag, console errors about proxies, drag animations not working.

### Pitfall 2: Position Gaps After Delete/Reorder
**What goes wrong:** Deleting a song from position 3 of 5 leaves positions [0,1,3,4]. Future inserts or reorders can conflict with the unique constraint.
**Why it happens:** Not re-normalizing positions after mutations.
**How to avoid:** After any delete or reorder, send the full ordered array of `{song_id, position}` pairs to the server. Use a single transaction to delete all existing `setlist_songs` for that setlist and re-insert with clean sequential positions.
**Warning signs:** Unique constraint violations, songs appearing out of order.

### Pitfall 3: Auth Guard Blocking Shared Views
**What goes wrong:** The current `hooks.server.ts` redirects ALL non-`/auth` routes to login, including `/share/[token]`.
**Why it happens:** The auth guard was written in Phase 1 to protect everything.
**How to avoid:** Add `/share` to the path exemption check in hooks.server.ts before any code touches the share route. This is a prerequisite for SHARE-02.
**Warning signs:** Shared links redirect to login page.

### Pitfall 4: Copy-on-Drag Duplicating IDs
**What goes wrong:** When dragging from library to setlist, svelte-dnd-action creates a copy of the item. If the same song is added twice, there are duplicate `id` values in the setlist items array.
**Why it happens:** svelte-dnd-action requires unique `id` on each item in a zone.
**How to avoid:** When a song is finalized into the setlist, generate a new unique ID for the setlist entry (e.g., a UUID for the `setlist_songs.id`). The `song_id` is a foreign key, but the item's `id` in the DnD zone should be the `setlist_songs.id`.
**Warning signs:** Drag operations affecting wrong items, items disappearing, console warnings about duplicate keys.

### Pitfall 5: Supabase Storage Bucket Not Created
**What goes wrong:** Logo uploads fail with 404 or permission errors.
**Why it happens:** The storage bucket must be created (either via Supabase dashboard, SQL migration, or programmatically) before uploads work.
**How to avoid:** Include bucket creation in the migration or document it as a setup step. Create a `logos` public bucket with `allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']` and reasonable `maxFileSize` (e.g., 2MB).
**Warning signs:** Storage API returning "Bucket not found" or 403 errors.

### Pitfall 6: Share Token Leaking Private Data
**What goes wrong:** The shared view query returns duration, notes, or other backstage data.
**Why it happens:** Using the same query/view for both owner and shared access.
**How to avoid:** Use separate queries for the shared view that only select `title` and `position` from setlist_songs joined with songs. The shared route's load function should be purpose-built.
**Warning signs:** Duration or notes visible in shared view; sensitive data in network responses.

## Code Examples

### Loading a Setlist with Songs for the Builder
```typescript
// src/routes/(app)/setlists/[id]/+page.server.ts
export const load: PageServerLoad = async ({ params, locals: { supabase, safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) return { setlist: null, setlistSongs: [], songs: [] };

  // Load the setlist
  const { data: setlist } = await supabase
    .from('setlists')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', session.user.id)
    .single();

  // Load setlist songs with song details, ordered by position
  const { data: setlistSongs } = await supabase
    .from('setlist_songs')
    .select('id, position, song_id, songs(id, title, duration_seconds)')
    .eq('setlist_id', params.id)
    .order('position', { ascending: true });

  // Load user's full song library for the library panel
  const { data: songs } = await supabase
    .from('songs')
    .select('*')
    .eq('user_id', session.user.id)
    .order('title', { ascending: true });

  return { setlist, setlistSongs: setlistSongs ?? [], songs: songs ?? [] };
};
```

### Loading a Shared Setlist (No Auth)
```typescript
// src/routes/share/[token]/+page.server.ts
export const load: PageServerLoad = async ({ params, locals: { supabase } }) => {
  // Load setlist by share_token (anon role, RLS allows this)
  const { data: setlist } = await supabase
    .from('setlists')
    .select('name, gig_date, venue, user_id')
    .eq('share_token', params.token)
    .single();

  if (!setlist) return { status: 404, setlist: null, songs: [], profile: null };

  // Load song titles only (no durations — backstage info)
  const { data: songs } = await supabase
    .from('setlist_songs')
    .select('position, songs(title)')
    .eq('setlist_id', setlist.id)  // Need setlist id from a subquery or join
    .order('position', { ascending: true });

  // Load profile for logo and display name
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, logo_url')
    .eq('id', setlist.user_id)
    .single();

  return { setlist, songs: songs ?? [], profile };
};
```

Note: The shared view query needs refinement since `setlist.id` won't be available from the first query as shown. The actual implementation should either: (a) query setlists including `id` but not expose it to the client, or (b) use a Postgres function/view that joins everything by share_token.

### Duplicate Setlist Action
```typescript
// In setlists/+page.server.ts actions
duplicate: async ({ request, locals: { supabase, safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (!session) return fail(401, { error: 'Not authenticated' });

  const formData = await request.formData();
  const id = formData.get('id') as string;

  // Load original
  const { data: original } = await supabase
    .from('setlists')
    .select('name, gig_date, venue, target_seconds, transition_seconds')
    .eq('id', id)
    .eq('user_id', session.user.id)
    .single();

  if (!original) return fail(404, { error: 'Setlist not found' });

  // Create copy (no share_token — starts unshared)
  const { data: newSetlist, error: insertError } = await supabase
    .from('setlists')
    .insert({
      user_id: session.user.id,
      name: `${original.name} (Copy)`,
      gig_date: original.gig_date,
      venue: original.venue,
      target_seconds: original.target_seconds,
      transition_seconds: original.transition_seconds
    })
    .select('id')
    .single();

  if (insertError || !newSetlist) return fail(500, { error: 'Failed to duplicate' });

  // Copy songs
  const { data: originalSongs } = await supabase
    .from('setlist_songs')
    .select('song_id, position')
    .eq('setlist_id', id)
    .order('position');

  if (originalSongs?.length) {
    await supabase.from('setlist_songs').insert(
      originalSongs.map(s => ({
        setlist_id: newSetlist.id,
        song_id: s.song_id,
        position: s.position
      }))
    );
  }

  return { duplicated: true };
}
```

### Toggle Share Token
```typescript
async function toggleSharing(setlistId: string, currentlyShared: boolean) {
  if (currentlyShared) {
    // Revoke sharing
    await supabase
      .from('setlists')
      .update({ share_token: null })
      .eq('id', setlistId);
  } else {
    // Enable sharing — Postgres generates the UUID
    await supabase.rpc('enable_setlist_sharing', { setlist_id: setlistId });
    // Or use client-generated UUID:
    // await supabase.from('setlists').update({ share_token: crypto.randomUUID() }).eq('id', setlistId);
  }
}
```

### Print-Optimized Shared View
```svelte
<!-- src/routes/share/[token]/+page.svelte -->
<div class="mx-auto max-w-2xl p-8 print:max-w-none print:p-0">
  <!-- Header -->
  <div class="text-center">
    {#if profile?.logo_url}
      <img src={profile.logo_url} alt="" class="mx-auto mb-4 h-24 w-auto" />
    {/if}
    <h1 class="font-display text-3xl">{setlist.name}</h1>
    {#if profile?.display_name}
      <p class="mt-1 text-lg text-stone-600">{profile.display_name}</p>
    {/if}
    {#if setlist.gig_date || setlist.venue}
      <p class="mt-2 text-stone-500">
        {setlist.venue}{setlist.venue && setlist.gig_date ? ' — ' : ''}{setlist.gig_date}
      </p>
    {/if}
  </div>

  <!-- Song list -->
  <ol class="mt-8 space-y-2">
    {#each songs as song, i}
      <li class="flex items-baseline gap-3 border-b border-stone-200 py-2">
        <span class="w-8 text-right text-sm text-stone-400">{i + 1}.</span>
        <span class="text-lg">{song.songs.title}</span>
      </li>
    {/each}
  </ol>
</div>

<style>
  @media print {
    :global(body) {
      background: white !important;
      color: black !important;
    }
    :global(nav), :global(aside), :global(.no-print) {
      display: none !important;
    }
  }
</style>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| svelte-dnd-action `on:consider` / `on:finalize` | `onconsider` / `onfinalize` (no colon) | Svelte 5 (2024) | Must use new event syntax in Svelte 5 |
| Svelte stores for reactive state | `$state` / `$derived` runes | Svelte 5 (2024) | All new code should use runes, not stores |
| Tailwind v3 `@apply` / `purge` config | Tailwind v4 `@import 'tailwindcss'` / CSS-first config | Tailwind 4 (2025) | Project already on v4; use `@theme` and `@custom-variant` |
| Supabase anon key + custom tokens for sharing | RLS policies with `to anon` role | Supabase standard | Use built-in anon role for public access; no custom auth needed |

**Deprecated/outdated:**
- `on:consider` / `on:finalize` event syntax: Still works in svelte-dnd-action but prefer `onconsider` / `onfinalize` for Svelte 5
- Supabase Storage `createSignedUrl` for public sharing: Use public buckets with `getPublicUrl` instead for logos that should always be accessible

## Open Questions

1. **Position update strategy for reordering**
   - What we know: `setlist_songs` has a unique constraint on `(setlist_id, position)`. Batch updates need to avoid constraint violations.
   - What's unclear: Whether to use delete-all-reinsert or carefully ordered updates.
   - Recommendation: Use delete-all-reinsert within a single server action. Simpler to implement, avoids constraint ordering issues. The number of songs in a setlist is small (typically <30), so performance is not a concern.

2. **Supabase Storage bucket creation**
   - What we know: Buckets can be created via dashboard, SQL, or API. The project uses Supabase migrations.
   - What's unclear: Whether Supabase SQL migrations can create storage buckets (it's a separate API, not a regular table).
   - Recommendation: Create the bucket via the Supabase dashboard or via a Supabase management API call during setup. Document as a manual setup step if not automatable via migration. Alternatively, use `insert into storage.buckets` in a migration (this works in Supabase).

3. **Shared view: querying by token without exposing setlist ID**
   - What we know: The share route has the token, not the setlist ID. Need to join setlist_songs via the setlist's share_token.
   - What's unclear: Best way to structure this query given Supabase client limitations.
   - Recommendation: Either (a) select setlist with `id` included in the server load (it's server-side, not exposed to client), or (b) create a Postgres view/function that joins by share_token. Option (a) is simpler.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `src/routes/(app)/songs/+page.server.ts`, `src/hooks.server.ts`, `supabase/migrations/` - established patterns for RLS, auth, form actions
- [svelte-dnd-action GitHub](https://github.com/isaacHagoel/svelte-dnd-action) - feature list, Svelte 5 event syntax, cross-container drag support
- [svelte-dnd-action release notes](https://github.com/isaacHagoel/svelte-dnd-action/blob/master/release-notes.md) - v0.9.66+ Svelte 5 runes fix, v0.9.69 latest
- [Supabase Storage docs](https://supabase.com/docs/guides/storage) - upload API, public URLs, image transforms
- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security) - anon role, policy syntax

### Secondary (MEDIUM confidence)
- [npm trends: svelte-dnd-action](https://npmtrends.com/svelte-dnd-action) - 40K+ weekly downloads, community adoption metrics
- [Tailwind print: variant](https://tailwindcss.com/docs/breakpoints) - print media query support built into Tailwind
- [Supabase image transformations](https://supabase.com/docs/guides/storage/serving/image-transformations) - resize via URL params (Pro plan+ for on-the-fly; client-side resize as fallback)

### Tertiary (LOW confidence)
- [@thisux/sveltednd](https://github.com/thisuxhq/sveltednd) - considered as alternative, v0.0.20, assessed as too immature (last published 1 year ago)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - svelte-dnd-action is clearly the standard; verified via npm downloads, GitHub activity, and official Svelte blog mentions
- Architecture: HIGH - schema patterns follow established Supabase + SvelteKit conventions from Phase 1-2; RLS patterns verified against official docs
- Pitfalls: HIGH - $state compatibility issues documented in release notes; position ordering and auth guard issues derived from codebase analysis

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (stable domain; svelte-dnd-action is mature)
