# Architecture Patterns

**Domain:** Setlist management web app (SvelteKit + Supabase)
**Researched:** 2026-02-17
**Confidence:** MEDIUM (training data, no web verification available)

## Recommended Architecture

```
Browser (Svelte 5 SPA-like experience)
  |
  +-- SvelteKit Routes (SSR + CSR hybrid)
  |     |
  |     +-- +layout.server.ts  (auth guard, session refresh)
  |     +-- +page.server.ts    (load data, form actions)
  |     +-- +page.svelte       (UI + client-side DnD state)
  |
  +-- Supabase Client (two instances)
  |     |
  |     +-- Server client (hooks.server.ts, +page.server.ts)
  |     |     Uses service role or user session for DB access
  |     |
  |     +-- Browser client (components, realtime subscriptions)
  |           Uses anon key + user JWT for direct DB access
  |
  +-- Supabase Backend
        |
        +-- Auth (Google OAuth, JWT sessions)
        +-- Postgres (data storage, RLS policies)
        +-- Storage (not needed for v1)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Auth Layer** (`hooks.server.ts`) | Validate session on every request, refresh tokens, inject user into `locals` | Supabase Auth, all server load functions |
| **Song Library** (routes + components) | CRUD songs for a user/band | Supabase Postgres via server load/actions |
| **Setlist Builder** (routes + components) | Create/edit setlists, drag-and-drop reorder, time calculation | Local Svelte state (optimistic), Supabase for persistence |
| **Band Management** (routes + components) | Create bands, invite members, manage membership | Supabase Postgres + RLS |
| **Public Share** (routes) | Read-only setlist view without auth | Supabase with anon access via RLS |
| **Supabase Client Lib** (`$lib/supabase.ts`) | Create and export typed Supabase clients | All data-accessing components |
| **UI Component Library** (`$lib/components/`) | Reusable presentational components | Parent components only |

### Data Flow

**Page Load (authenticated):**

```
1. Browser requests /setlists/[id]
2. hooks.server.ts intercepts:
   - Reads session from cookies
   - Refreshes token if needed via supabase.auth.getSession()
   - Sets event.locals.supabase (server client)
   - Sets event.locals.session (user session)
3. +layout.server.ts returns session to client
4. +page.server.ts loads setlist data:
   - Creates server supabase client
   - Queries setlist + setlist_songs joined with songs
   - RLS ensures user can only see own/band setlists
   - Returns typed data to page
5. +page.svelte renders with SSR data
6. Client hydrates, DnD becomes interactive
```

**Drag-and-Drop Reorder Flow:**

```
1. User drags song to new position in setlist
2. Client updates local state IMMEDIATELY (optimistic)
   - Svelte 5 $state() rune holds ordered song list
   - Running time recalculates reactively
3. Debounced save triggers (300-500ms after last drag)
4. Client sends new order to server:
   Option A: Form action (SvelteKit native)
   Option B: Direct Supabase client call from browser
5. Server/Supabase updates position values
6. On failure: revert local state, show toast error
```

**Public Share Flow:**

```
1. Browser requests /s/[share_id] (no auth required)
2. +page.server.ts loads setlist by share_id column
3. RLS policy: SELECT allowed where is_public = true
4. Renders read-only view (no DnD, no edit controls)
```

## Data Model

### Core Tables

```sql
-- Users are managed by Supabase Auth (auth.users)
-- This is the public profile table

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now()
);

create table bands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references profiles(id) not null,
  created_at timestamptz default now()
);

create table band_members (
  band_id uuid references bands(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz default now(),
  primary key (band_id, user_id)
);

create table songs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_seconds integer not null check (duration_seconds > 0),
  owner_id uuid references profiles(id) not null,
  band_id uuid references bands(id),  -- null = personal song
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table setlists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references profiles(id) not null,
  band_id uuid references bands(id),  -- null = personal setlist
  share_id text unique default encode(gen_random_bytes(8), 'hex'),
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table setlist_songs (
  id uuid primary key default gen_random_uuid(),
  setlist_id uuid references setlists(id) on delete cascade,
  song_id uuid references songs(id) on delete cascade,
  position integer not null,
  unique (setlist_id, position)  -- enforces no duplicate positions
);
```

### Key Design Decisions

**Position as integer (not float/fractional):** Use integer positions (0, 1, 2...) and renumber on reorder. Simpler than fractional indexing. The maximum setlist is ~40 songs -- renumbering the full list on every reorder is trivial. Send the full ordered array of song IDs to the server and bulk-update positions in a single transaction.

**`share_id` as short random string:** Separate from the UUID primary key. Short enough for URLs (`/s/a1b2c3d4`), random enough to be unguessable. Generated by Postgres `gen_random_bytes`.

**`band_id` nullable on songs and setlists:** When null, the item is personal. When set, it belongs to the band and RLS policies use `band_members` to check access. This avoids a separate "personal library" vs "band library" table split.

**No `set_sections` table for v1:** Per PROJECT.md, sections (Set 1, Set 2, Encore) are out of scope. The flat `setlist_songs` with `position` ordering is sufficient. Adding sections later means adding a `section_id` FK to `setlist_songs` and a `sections` table -- non-breaking migration.

## Row-Level Security (RLS) Strategy

```sql
-- Songs: user sees own songs + songs in their bands
create policy "songs_select" on songs for select using (
  owner_id = auth.uid()
  or band_id in (
    select band_id from band_members where user_id = auth.uid()
  )
);

-- Setlists: user sees own + band setlists
create policy "setlists_select" on setlists for select using (
  owner_id = auth.uid()
  or band_id in (
    select band_id from band_members where user_id = auth.uid()
  )
);

-- Public setlists: anyone can view via share_id
create policy "setlists_public_select" on setlists for select using (
  is_public = true
);

-- Insert/Update/Delete: owner or band admin/owner only
-- (similar patterns, checking ownership or band role)
```

**Critical RLS principle:** Every table has RLS enabled. No table is accessible without a policy. Server-side code uses the user's session (not service role) so RLS is always enforced.

## SvelteKit File Structure

```
src/
  app.d.ts                    # Type augmentation (Locals, PageData)
  app.html                    # HTML shell
  hooks.server.ts             # Auth middleware (Supabase session)

  lib/
    supabase/
      client.ts               # Browser Supabase client (singleton)
      server.ts               # Server Supabase client factory
      types.ts                # Generated DB types (supabase gen types)

    components/
      ui/                     # Generic UI (Button, Input, Modal, Toast)
      songs/                  # Song-related (SongRow, SongForm)
      setlists/               # Setlist-related (SetlistCard, SetlistSongItem)
      dnd/                    # Drag-and-drop primitives (DragList, DragItem)

    stores/                   # Svelte 5 shared state (if needed beyond page scope)
    utils/
      time.ts                 # Duration formatting (seconds -> "3:45")
      validators.ts           # Input validation helpers

  routes/
    +layout.svelte            # Root layout (nav, auth state)
    +layout.server.ts         # Load session, pass to client

    (app)/                    # Route group: authenticated pages
      +layout.svelte          # Auth guard layout (redirect if not logged in)
      +layout.server.ts       # Verify session, redirect to /login if missing

      songs/
        +page.svelte          # Song library list
        +page.server.ts       # Load songs, handle add/edit/delete actions

      setlists/
        +page.svelte          # Setlist list view
        +page.server.ts       # Load setlists, handle create action

        [id]/
          +page.svelte        # Setlist builder (DnD, running time)
          +page.server.ts     # Load setlist + songs, handle reorder/add/remove

      bands/
        +page.svelte          # Band management
        +page.server.ts       # Load bands, handle create/invite

        [id]/
          +page.svelte        # Band detail (members, shared songs/setlists)
          +page.server.ts     # Load band data

    (public)/                 # Route group: no auth required
      login/
        +page.svelte          # Login page (Google OAuth button)
        +page.server.ts       # Redirect if already logged in

      s/[share_id]/
        +page.svelte          # Public read-only setlist view
        +page.server.ts       # Load setlist by share_id (RLS: is_public=true)

    auth/
      callback/
        +server.ts            # OAuth callback handler (exchange code for session)
```

### Route Group Rationale

**`(app)/`** groups all authenticated routes under a single layout that checks for a valid session and redirects to login if missing. This avoids repeating auth checks in every page's server load.

**`(public)/`** groups unauthenticated routes. The login page and public share links live here. No auth guard in this layout.

**`auth/callback/`** is a server-only route (`+server.ts`, no page) that handles the OAuth redirect from Supabase/Google.

## Patterns to Follow

### Pattern 1: Supabase Auth via hooks.server.ts

**What:** Initialize Supabase server client in the hooks, attach to `event.locals`, refresh session cookies automatically.

**When:** Every server-side request.

**Example:**

```typescript
// src/hooks.server.ts
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(
    PUBLIC_SUPABASE_URL,
    PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => event.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            event.cookies.set(name, value, { ...options, path: '/' });
          });
        },
      },
    }
  );

  event.locals.safeGetSession = async () => {
    const { data: { session } } = await event.locals.supabase.auth.getSession();
    if (!session) return { session: null, user: null };

    const { data: { user }, error } = await event.locals.supabase.auth.getUser();
    if (error) return { session: null, user: null };
    return { session, user };
  };

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version';
    },
  });
};
```

**Why `safeGetSession` over `getSession`:** `getSession()` reads from the JWT without verifying it with the Supabase server. `getUser()` actually verifies the token. For server-side auth checks, always verify with `getUser()`.

### Pattern 2: Optimistic DnD with Debounced Persist

**What:** Update UI immediately on drag, batch-save position changes to DB after a short delay.

**When:** Any reorder interaction in the setlist builder.

**Example:**

```typescript
// In setlist builder +page.svelte
let songs = $state<SetlistSong[]>(data.songs); // from server load
let saveTimeout: ReturnType<typeof setTimeout>;

function handleReorder(fromIndex: number, toIndex: number) {
  // Optimistic: reorder immediately in local state
  const item = songs.splice(fromIndex, 1)[0];
  songs.splice(toIndex, 0, item);

  // Debounce: save after 500ms of no more drags
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => persistOrder(), 500);
}

async function persistOrder() {
  const orderedIds = songs.map((s) => s.id);
  const response = await fetch(`/setlists/${setlistId}?/reorder`, {
    method: 'POST',
    body: JSON.stringify({ order: orderedIds }),
  });
  if (!response.ok) {
    // Revert to server state
    songs = structuredClone(data.songs);
    // Show error toast
  }
}
```

### Pattern 3: Server-Side Form Actions for Mutations

**What:** Use SvelteKit form actions (`+page.server.ts` `actions`) for all data mutations (create, update, delete). Not API routes.

**When:** Any data write operation.

**Why:** Form actions work with progressive enhancement (no JS), integrate with SvelteKit's invalidation system (data refreshes automatically after action), and keep mutation logic on the server where RLS is enforced.

```typescript
// src/routes/(app)/songs/+page.server.ts
export const actions = {
  create: async ({ request, locals }) => {
    const form = await request.formData();
    const name = form.get('name') as string;
    const duration = parseInt(form.get('duration') as string);

    const { error } = await locals.supabase
      .from('songs')
      .insert({ name, duration_seconds: duration, owner_id: locals.session.user.id });

    if (error) return fail(400, { error: error.message });
    return { success: true };
  },

  delete: async ({ request, locals }) => {
    const form = await request.formData();
    const id = form.get('id') as string;

    const { error } = await locals.supabase
      .from('songs')
      .delete()
      .eq('id', id);

    if (error) return fail(400, { error: error.message });
    return { success: true };
  },
};
```

### Pattern 4: Derived Time Calculation

**What:** Compute running time totals as a derived value from the song list, not stored in the database.

**When:** Displaying setlist duration.

```typescript
// Svelte 5 reactive derivation
let songs = $state<SetlistSong[]>([]);

let totalSeconds = $derived(
  songs.reduce((sum, s) => sum + s.duration_seconds, 0)
);

let formattedTotal = $derived(formatDuration(totalSeconds));

// Per-song running total for "cumulative time" column
let runningTotals = $derived(
  songs.reduce<number[]>((acc, s) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
    acc.push(prev + s.duration_seconds);
    return acc;
  }, [])
);
```

**Why not store totals:** Duration is always derivable from song data. Storing it creates sync bugs. Calculating on the fly is instant for < 100 songs.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using Supabase Client Directly in Components for Writes

**What:** Importing the browser Supabase client and calling `.insert()` / `.update()` / `.delete()` directly from Svelte components.

**Why bad:** Bypasses SvelteKit's data invalidation. After a mutation, `data` from `+page.server.ts` is stale unless you manually re-fetch. Form actions automatically invalidate and re-run load functions. Also loses progressive enhancement.

**Instead:** Use SvelteKit form actions for mutations. Reserve the browser Supabase client for reads (if doing client-side filtering) or realtime subscriptions (future).

### Anti-Pattern 2: Storing Session in a Svelte Store

**What:** Reading the Supabase session once and storing it in a global Svelte store.

**Why bad:** Session tokens expire. The store becomes stale. Auth state drifts from reality.

**Instead:** Always get session from `+layout.server.ts` load function (runs on every navigation) and pass it down through SvelteKit's data loading. The `hooks.server.ts` refreshes the cookie-based session on every request.

### Anti-Pattern 3: Fractional Indexing for Song Order

**What:** Using float/decimal positions (1.0, 1.5, 1.75) to avoid renumbering on reorder.

**Why bad:** Overkill for setlists (max ~40-50 songs). Creates precision issues over many reorders. Adds complexity. Fractional indexing is for collaborative real-time editors with thousands of items.

**Instead:** Integer positions. Renumber all positions in a single UPDATE statement on reorder. Wrap in a transaction.

### Anti-Pattern 4: Creating API Routes Instead of Form Actions

**What:** Building `/api/songs` REST endpoints instead of using SvelteKit's form actions.

**Why bad:** Duplicates work SvelteKit already handles. Loses automatic data invalidation, progressive enhancement, and type-safe form handling.

**Instead:** Use form actions for mutations triggered by user interaction. Only create `+server.ts` API routes for webhook callbacks (like the auth callback) or endpoints consumed by external clients.

## Supabase Client Architecture

### Two-Client Pattern

The `@supabase/ssr` package provides the pattern for SvelteKit:

**Server Client** (in `hooks.server.ts`, `+page.server.ts`, `+layout.server.ts`):
- Created per-request (not singleton)
- Uses cookies for session (cookie-based auth)
- Has access to the user's JWT for RLS
- Used for all server-side data loading and mutations

**Browser Client** (in `.svelte` components):
- Singleton, created once
- Uses cookies for session (same cookies as server)
- Needed for: auth state listeners (`onAuthStateChange`), potential realtime subscriptions
- NOT for mutations (use form actions instead)

### Type Generation

```bash
npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts
```

This generates TypeScript types from the Postgres schema. Import and pass to `createClient<Database>()` for end-to-end type safety on all queries.

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **Database** | Supabase free tier is fine | Supabase Pro, add indexes on `band_id`, `owner_id` | Connection pooling, read replicas, consider edge functions |
| **Auth** | Supabase handles it | Supabase handles it | Supabase handles it (built for scale) |
| **DnD state sync** | Debounced saves, no issues | Same pattern, no issues | Same pattern, add optimistic locking (updated_at check) |
| **Public share links** | Direct DB query | Add CDN caching headers on public pages | Cache at CDN layer, stale-while-revalidate |
| **Band queries (RLS)** | RLS subqueries are fine | Ensure `band_members` has composite index | Materialize user-band access as a join table with index |

Scaling is not a v1 concern. Supabase + Netlify handle the first 10K users without architecture changes.

## Suggested Build Order

The architecture implies this dependency chain:

```
1. Supabase Project + Auth Setup
   (everything depends on having a database and auth)
   |
   v
2. Auth Flow (hooks.server.ts, login, callback, session)
   (all authenticated features depend on this)
   |
   +-----+-----+
   |           |
   v           v
3. Song       4. Band
   Library       Management
   (CRUD)        (create, invite, members)
   |              |
   +------+------+
          |
          v
5. Setlist Builder
   (depends on songs existing + optional band context)
   |
   v
6. Drag-and-Drop + Time Calculation
   (UI layer on top of setlist data)
   |
   v
7. Public Share Links
   (depends on setlists existing)
```

**Rationale:**
- Auth is foundational -- everything behind login needs it
- Songs before setlists (setlists contain songs)
- Band management can parallel song library (independent CRUD)
- DnD is a UI enhancement on top of working setlist data
- Public sharing is the last feature (needs complete setlists to share)

## Sources

- SvelteKit documentation (file-based routing, form actions, hooks, layouts) -- training data, HIGH confidence
- Supabase SSR documentation (`@supabase/ssr` package pattern) -- training data, MEDIUM confidence
- Supabase RLS documentation (policy patterns for multi-tenant) -- training data, MEDIUM confidence
- Svelte 5 runes (`$state`, `$derived`) -- training data, HIGH confidence
- Common drag-and-drop architectural patterns -- training data, MEDIUM confidence

**Note:** Web search was unavailable during this research. The `@supabase/ssr` integration pattern and SvelteKit hooks patterns should be verified against current Supabase docs before implementation. The core architecture (RLS, form actions, optimistic DnD) is well-established and HIGH confidence.

---

*Architecture research: 2026-02-17*
