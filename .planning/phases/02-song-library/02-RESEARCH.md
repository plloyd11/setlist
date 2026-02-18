# Phase 2: Song Library - Research

**Researched:** 2026-02-18
**Domain:** Supabase CRUD (Postgres tables, RLS), SvelteKit form actions, song management UI patterns
**Confidence:** HIGH

## Summary

Phase 2 builds a song library CRUD on top of the existing Supabase + SvelteKit auth foundation from Phase 1. The core work involves: (1) creating a `songs` table in Supabase with RLS policies scoped to authenticated users, (2) implementing server-side data loading and form actions for create/update/delete, and (3) building the song list UI with search/filter, inline editing, context menu, and toast notifications.

The existing codebase already has Supabase client setup in `hooks.server.ts`, `+layout.server.ts`, and `+layout.ts` with session management. The songs page placeholder exists at `src/routes/(app)/songs/+page.svelte`. The stack is SvelteKit 2 + Svelte 5 + Tailwind CSS v4 + Supabase JS v2.

**Primary recommendation:** Use SvelteKit form actions (`+page.server.ts`) for all CRUD operations with progressive enhancement via `use:enhance`. Store duration as integer seconds in Postgres for simplicity. Build toast, context menu, and confirm dialog as small custom components -- no library dependencies needed for these simple UI patterns.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Song list layout:** Simple list with details -- one song per row, secondary line for metadata. Each row shows title, duration (mm:ss). Secondary line shows notes field (only displayed when populated, variable row heights). Default sort: alphabetical by title. Sort toggle: alphabetical, duration, date added. Context menu (right-click / long-press) for edit and delete. Song count in library header (e.g., "42 songs").
- **Add song experience:** Separate page with dedicated form. Single text field for duration (mm:ss format). Required fields: title and duration. Notes field: optional. After saving, stay on form (cleared) for batch entry. Toast notification on save ("Song added"). Add button in page header/toolbar alongside search icon.
- **Edit song experience:** Inline editing directly in the list row -- no navigation required. Same fields as add: title, duration, notes.
- **Delete behavior:** Confirmation dialog before deletion. If song is used in setlists: warn which setlists use it, but allow deletion anyway.
- **Search and filter:** Instant filter as you type -- real-time, no submit button. Search bar is collapsible -- hidden behind search icon, expands when tapped. Search matches title only (not notes). Duration filter: filter by duration range (under 3 min, 3-5 min, over 5 min).
- **Empty and loading states:** Empty library: friendly CTA with "Add your first song" button. No search results: "No songs match" with suggestion to clear search. Post-add flow returns to cleared form.

### Claude's Discretion
- Loading skeleton design
- Exact duration filter ranges/UI
- Inline edit interaction pattern (click-to-edit, edit icon, etc.)
- Error state handling
- Exact spacing, typography, animations

### Deferred Ideas (OUT OF SCOPE)
- None specified
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SONG-01 | User can add a song with name and duration | Supabase `insert()` via SvelteKit form action in `+page.server.ts`; dedicated `/songs/new` page with form; duration stored as integer seconds, displayed/input as mm:ss |
| SONG-02 | User can edit a song's name and duration | Inline editing in list row using click-to-edit pattern; Supabase `update().eq('id', id)` via form action or client-side call; same fields as add |
| SONG-03 | User can delete a song from their library | Supabase `delete().eq('id', id)` via form action; confirmation dialog using native `<dialog>` element; future-proofed to warn about setlist usage |
| SONG-04 | User can search/filter song library by title | Client-side filtering with Svelte 5 `$derived` rune on loaded song array; `String.includes()` for title search; duration range filter with preset buckets |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.96.0 | Already installed | Database CRUD via Supabase client |
| `@supabase/ssr` | ^0.8.0 | Already installed | Server-side Supabase client with cookie auth |
| `@sveltejs/kit` | ^2.50.2 | Already installed | Form actions, server load functions, routing |
| `svelte` | ^5.49.2 | Already installed | Reactivity ($state, $derived, $effect), components |
| `tailwindcss` | ^4.1.18 | Already installed | Utility-first styling |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tailwindcss/forms` | ^0.5.11 | Already installed | Form element styling for song input fields |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom toast | `svelte-5-french-toast` | Adds dependency for a single "Song added" message; custom is ~30 lines |
| Custom context menu | `svelte-contextmenu` | Library is Svelte 3/4 era; custom handles both right-click and long-press cleanly |
| Custom confirm dialog | `svelte-dialogs` | Native `<dialog>` element works perfectly for simple confirm/cancel |
| Integer seconds for duration | Postgres `interval` type | Interval has serialization quirks with supabase-js; integer is simpler for math and filtering |
| Supabase CLI types generation | Manual types | CLI `gen types` is ideal but requires Supabase CLI setup; manual types work for a small schema |

**Installation:**
```bash
# No new packages needed -- everything is already installed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── routes/(app)/songs/
│   ├── +page.svelte              # Song library list (search, filter, inline edit)
│   ├── +page.server.ts           # Load songs, handle delete action
│   └── new/
│       ├── +page.svelte          # Add song form
│       └── +page.server.ts       # Handle create action
├── lib/
│   ├── components/
│   │   ├── songs/
│   │   │   ├── SongRow.svelte         # Single song row with inline edit
│   │   │   ├── SongSearch.svelte      # Collapsible search bar
│   │   │   └── DurationFilter.svelte  # Duration range filter
│   │   └── ui/
│   │       ├── Toast.svelte           # Toast notification
│   │       ├── ConfirmDialog.svelte   # Confirmation dialog
│   │       └── ContextMenu.svelte     # Right-click / long-press menu
│   ├── utils/
│   │   └── duration.ts           # mm:ss parsing and formatting
│   └── types/
│       └── database.ts           # Song type definition (manual or generated)
```

### Pattern 1: Server Load Function for Songs
**What:** Load user's songs from Supabase in `+page.server.ts`, passing them to the page component.
**When to use:** Song library list page.
**Example:**
```typescript
// src/routes/(app)/songs/+page.server.ts
// Source: https://supabase.com/docs/guides/getting-started/tutorials/with-sveltekit
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
  const { session } = await safeGetSession();

  const { data: songs, error } = await supabase
    .from('songs')
    .select('*')
    .eq('user_id', session!.user.id)
    .order('title', { ascending: true });

  return { songs: songs ?? [] };
};
```

### Pattern 2: Form Action for Creating a Song
**What:** Handle form submission server-side with validation and Supabase insert.
**When to use:** Add song page form submission.
**Example:**
```typescript
// src/routes/(app)/songs/new/+page.server.ts
// Source: https://svelte.dev/docs/kit/form-actions
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, locals: { supabase, safeGetSession } }) => {
    const { session } = await safeGetSession();
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const durationRaw = formData.get('duration') as string;
    const notes = (formData.get('notes') as string) || null;

    // Validate required fields
    if (!title?.trim()) {
      return fail(400, { title, durationRaw, notes, error: 'Title is required' });
    }

    // Parse mm:ss to seconds
    const seconds = parseDuration(durationRaw);
    if (seconds === null || seconds <= 0) {
      return fail(400, { title, durationRaw, notes, error: 'Duration must be in mm:ss format' });
    }

    const { error } = await supabase.from('songs').insert({
      user_id: session!.user.id,
      title: title.trim(),
      duration_seconds: seconds,
      notes: notes?.trim() || null
    });

    if (error) {
      return fail(500, { title, durationRaw, notes, error: 'Failed to save song' });
    }

    return { success: true };
  }
};
```

### Pattern 3: Inline Edit via Client-Side Supabase Call
**What:** For inline editing, use the browser-side Supabase client directly (avoids full-page form submission for a better UX). Then invalidate data to refresh the list.
**When to use:** Editing a song in the list row.
**Example:**
```svelte
<script lang="ts">
  import { invalidate } from '$app/navigation';

  let { song, supabase } = $props();
  let editing = $state(false);
  let editTitle = $state(song.title);
  let editDuration = $state(formatDuration(song.duration_seconds));
  let editNotes = $state(song.notes ?? '');

  async function save() {
    const seconds = parseDuration(editDuration);
    if (!editTitle.trim() || !seconds) return;

    const { error } = await supabase
      .from('songs')
      .update({
        title: editTitle.trim(),
        duration_seconds: seconds,
        notes: editNotes.trim() || null
      })
      .eq('id', song.id);

    if (!error) {
      editing = false;
      await invalidate('supabase:songs');
    }
  }
</script>
```

### Pattern 4: Duration Utility Functions
**What:** Parse mm:ss strings to integer seconds and format seconds back to mm:ss.
**When to use:** Every duration input/display.
**Example:**
```typescript
// src/lib/utils/duration.ts
export function parseDuration(input: string): number | null {
  const match = input.trim().match(/^(\d{1,3}):([0-5]\d)$/);
  if (!match) return null;
  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  return minutes * 60 + seconds;
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
```

### Pattern 5: Client-Side Search and Filter with $derived
**What:** Filter the loaded song array in the browser for instant results.
**When to use:** Search bar and duration filter on the song list page.
**Example:**
```svelte
<script lang="ts">
  let { data } = $props();
  let searchQuery = $state('');
  let durationFilter = $state<'all' | 'under3' | '3to5' | 'over5'>('all');

  const filteredSongs = $derived(() => {
    let songs = data.songs;

    // Title search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      songs = songs.filter(s => s.title.toLowerCase().includes(q));
    }

    // Duration filter
    if (durationFilter === 'under3') {
      songs = songs.filter(s => s.duration_seconds < 180);
    } else if (durationFilter === '3to5') {
      songs = songs.filter(s => s.duration_seconds >= 180 && s.duration_seconds <= 300);
    } else if (durationFilter === 'over5') {
      songs = songs.filter(s => s.duration_seconds > 300);
    }

    return songs;
  });
</script>
```

### Pattern 6: Database Schema (SQL Migration)
**What:** Supabase migration to create the songs table with RLS.
**When to use:** Before any CRUD operations.
**Example:**
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_create_songs_table.sql
-- Source: https://supabase.com/docs/guides/database/postgres/row-level-security

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
```

### Anti-Patterns to Avoid
- **Client-side CRUD without RLS:** Never skip RLS policies even when doing server-side operations. RLS is the last line of defense.
- **Storing duration as a string:** "3:45" in the database makes filtering and sorting impossible without parsing. Store as integer seconds.
- **Using Postgres `interval` type:** supabase-js has serialization quirks with interval columns; integer seconds is simpler and more reliable.
- **Full form navigation for inline edit:** The user explicitly wants inline editing in the list row. Don't redirect to an edit page.
- **Filtering on the server per keystroke:** For a personal song library (hundreds of songs, not millions), client-side filtering is faster and avoids network requests per keystroke.
- **Using `getSession()` instead of `safeGetSession()`:** Always use the safe pattern established in Phase 1 for server-side session validation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duration parsing | Regex from scratch without validation | Well-tested `parseDuration`/`formatDuration` utility with edge case handling | Edge cases: "0:00", "99:59", leading zeros, invalid input |
| Database access control | Application-level permission checks | Supabase RLS policies | RLS enforced at database level regardless of client behavior |
| Form validation + error display | Custom request handling | SvelteKit `fail()` + `use:enhance` + `$page.form` | Built-in progressive enhancement, error state management |
| UUID generation | `crypto.randomUUID()` in app code | Postgres `gen_random_uuid()` default | Database-generated UUIDs are authoritative and avoid client-trust issues |

**Key insight:** The SvelteKit form actions pattern with `use:enhance` gives you progressive enhancement, automatic data invalidation, and structured error handling for free. Fight the urge to build a custom fetch-based API.

## Common Pitfalls

### Pitfall 1: Duration Input Validation
**What goes wrong:** Users enter "345" or "3.45" or "3m45s" instead of "3:45".
**Why it happens:** mm:ss is intuitive to musicians but the specific format needs guidance.
**How to avoid:** Use `placeholder="0:00"` on the input, validate with a regex (`/^\d{1,3}:[0-5]\d$/`), and show clear error messages. Consider using `inputmode="numeric"` on mobile to bring up the number pad.
**Warning signs:** Songs saved with 0 or incorrect durations.

### Pitfall 2: Form Not Clearing After Save
**What goes wrong:** After adding a song, the form retains the previous values.
**Why it happens:** `use:enhance` by default resets the form on success, but only if you return `{ success: true }` (not `fail()`). Custom enhance callbacks may skip the reset.
**How to avoid:** Return `{ success: true }` from the action on success, and let the default `use:enhance` behavior reset the form. Show the toast in a custom enhance callback before the reset.
**Warning signs:** Duplicate song entries from confused users.

### Pitfall 3: RLS Policy Not Using `(select auth.uid())`
**What goes wrong:** Every row evaluation calls `auth.uid()` separately, causing significant performance degradation.
**Why it happens:** Postgres evaluates `auth.uid()` per row unless wrapped in a subselect.
**How to avoid:** Always write `(select auth.uid()) = user_id` instead of `auth.uid() = user_id` in policies.
**Warning signs:** Slow query performance as song library grows.

### Pitfall 4: Missing Index on user_id
**What goes wrong:** Full table scans when loading a user's songs.
**Why it happens:** Queries filtered by `user_id` need an index. RLS policies also filter by `user_id`.
**How to avoid:** Create `songs_user_id_idx` index on the `user_id` column in the migration.
**Warning signs:** Increasing query latency as the overall songs table grows.

### Pitfall 5: Inline Edit Race Condition
**What goes wrong:** User starts editing a song, another tab deletes it, save fails silently.
**Why it happens:** Client-side edit operates on stale data.
**How to avoid:** Handle errors from the update call. If the song no longer exists, show an error and refresh the list.
**Warning signs:** "0 rows affected" from Supabase update with no error object.

### Pitfall 6: Context Menu Positioning Off-Screen
**What goes wrong:** Context menu appears partially off-screen, especially at the bottom or right edge.
**Why it happens:** Menu positioned at cursor coordinates without boundary checking.
**How to avoid:** After positioning, check if the menu extends beyond `window.innerWidth` or `window.innerHeight` and adjust coordinates.
**Warning signs:** Menu clipped or invisible near screen edges.

### Pitfall 7: Long-Press Interfering with Scroll on Mobile
**What goes wrong:** Attempting to scroll the song list triggers the context menu.
**Why it happens:** `touchstart` timer fires even when the user is scrolling.
**How to avoid:** Cancel the long-press timer on `touchmove` (detect movement beyond a small threshold like 10px). Only trigger context menu if the finger stays still.
**Warning signs:** Users unable to scroll the song list on mobile without triggering menus.

## Code Examples

### Toast Notification Component
```svelte
<!-- src/lib/components/ui/Toast.svelte -->
<script lang="ts">
  let visible = $state(false);
  let message = $state('');
  let timeout: ReturnType<typeof setTimeout>;

  export function show(msg: string, duration = 3000) {
    message = msg;
    visible = true;
    clearTimeout(timeout);
    timeout = setTimeout(() => { visible = false; }, duration);
  }
</script>

{#if visible}
  <div
    class="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-stone-900 px-4 py-2
      text-sm font-medium text-white shadow-lg dark:bg-stone-100 dark:text-stone-900
      md:bottom-6"
    role="status"
    aria-live="polite"
  >
    {message}
  </div>
{/if}
```

### Confirmation Dialog Component
```svelte
<!-- src/lib/components/ui/ConfirmDialog.svelte -->
<script lang="ts">
  let dialog: HTMLDialogElement;
  let resolvePromise: ((value: boolean) => void) | null = null;
  let title = $state('');
  let message = $state('');

  export function confirm(t: string, m: string): Promise<boolean> {
    title = t;
    message = m;
    dialog.showModal();
    return new Promise((resolve) => { resolvePromise = resolve; });
  }

  function handleResponse(confirmed: boolean) {
    dialog.close();
    resolvePromise?.(confirmed);
    resolvePromise = null;
  }
</script>

<dialog bind:this={dialog} class="rounded-xl bg-white p-6 shadow-xl backdrop:bg-black/50
  dark:bg-stone-900 dark:text-stone-100">
  <h2 class="font-display text-lg">{title}</h2>
  <p class="mt-2 text-sm text-stone-600 dark:text-stone-400">{message}</p>
  <div class="mt-4 flex justify-end gap-3">
    <button onclick={() => handleResponse(false)}
      class="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100
        dark:text-stone-400 dark:hover:bg-stone-800">
      Cancel
    </button>
    <button onclick={() => handleResponse(true)}
      class="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white
        hover:bg-red-600">
      Delete
    </button>
  </div>
</dialog>
```

### Context Menu with Right-Click and Long-Press
```svelte
<!-- src/lib/components/ui/ContextMenu.svelte -->
<script lang="ts">
  let { items, x, y, visible, onclose }: {
    items: { label: string; action: () => void }[];
    x: number;
    y: number;
    visible: boolean;
    onclose: () => void;
  } = $props();

  // Close on outside click
  function handleWindowClick() {
    if (visible) onclose();
  }

  // Reposition if off-screen
  const adjustedX = $derived(Math.min(x, window.innerWidth - 160));
  const adjustedY = $derived(Math.min(y, window.innerHeight - items.length * 40 - 16));
</script>

<svelte:window onclick={handleWindowClick} />

{#if visible}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="fixed z-50 min-w-[150px] rounded-lg border border-stone-200 bg-white py-1
      shadow-lg dark:border-stone-700 dark:bg-stone-800"
    style="left: {adjustedX}px; top: {adjustedY}px;"
    onclick|stopPropagation
  >
    {#each items as item}
      <button
        class="w-full px-4 py-2 text-left text-sm text-stone-700 hover:bg-stone-100
          dark:text-stone-300 dark:hover:bg-stone-700"
        onclick={() => { item.action(); onclose(); }}
      >
        {item.label}
      </button>
    {/each}
  </div>
{/if}
```

### Long-Press Action (Svelte Action)
```typescript
// src/lib/actions/longpress.ts
export function longpress(node: HTMLElement, duration = 500) {
  let timer: ReturnType<typeof setTimeout>;
  let startX: number;
  let startY: number;

  function handleTouchStart(e: TouchEvent) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    timer = setTimeout(() => {
      node.dispatchEvent(new CustomEvent('longpress', {
        detail: { x: startX, y: startY }
      }));
    }, duration);
  }

  function handleTouchMove(e: TouchEvent) {
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearTimeout(timer);
    }
  }

  function handleTouchEnd() {
    clearTimeout(timer);
  }

  node.addEventListener('touchstart', handleTouchStart, { passive: true });
  node.addEventListener('touchmove', handleTouchMove, { passive: true });
  node.addEventListener('touchend', handleTouchEnd);

  return {
    destroy() {
      clearTimeout(timer);
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchmove', handleTouchMove);
      node.removeEventListener('touchend', handleTouchEnd);
    }
  };
}
```

### Add Song Form with use:enhance
```svelte
<!-- src/routes/(app)/songs/new/+page.svelte (simplified) -->
<script lang="ts">
  import { enhance } from '$app/forms';

  let { form } = $props();
  let showToast = $state(false);
</script>

<form
  method="POST"
  use:enhance={() => {
    return async ({ result, update }) => {
      if (result.type === 'success') {
        showToast = true;
        setTimeout(() => { showToast = false; }, 3000);
      }
      await update({ reset: result.type === 'success' });
    };
  }}
>
  <label>
    Title
    <input name="title" type="text" required value={form?.title ?? ''} />
  </label>

  <label>
    Duration
    <input name="duration" type="text" required placeholder="3:45"
      inputmode="numeric" pattern="\d{1,3}:[0-5]\d" value={form?.durationRaw ?? ''} />
  </label>

  <label>
    Notes (optional)
    <textarea name="notes">{form?.notes ?? ''}</textarea>
  </label>

  {#if form?.error}
    <p class="text-red-500">{form.error}</p>
  {/if}

  <button type="submit">Add Song</button>
</form>
```

## Claude's Discretion Recommendations

### Loading Skeleton Design
Recommend simple pulsing placeholder rows matching the song row layout:
- A wider bar for title, narrow bar for duration on the right
- 5-6 skeleton rows to fill the viewport
- Use Tailwind `animate-pulse` with `bg-stone-200 dark:bg-stone-800` bars

### Exact Duration Filter Ranges/UI
Recommend three preset buttons (not a slider):
- **All** (default)
- **< 3 min** (under 180s) -- short songs, intros, interludes
- **3-5 min** (180-300s) -- standard song length
- **> 5 min** (over 300s) -- long songs, jams

Display as pill/chip toggle group below the search bar when expanded.

### Inline Edit Interaction Pattern
Recommend **click-to-edit** (tap the row to enter edit mode):
1. Tapping a row transforms the title, duration, and notes text into input fields in-place
2. A small save/cancel button pair appears at the row's right edge
3. Pressing Enter or tapping Save commits the edit
4. Pressing Escape or tapping Cancel reverts
5. Clicking outside the row also cancels (via blur detection with a small delay to allow button clicks)

This is simpler than a separate edit icon and more intuitive on mobile. The context menu remains for delete (and edit as a secondary path).

### Error State Handling
- **Network error on load:** Show a friendly message ("Couldn't load your songs. Check your connection.") with a retry button
- **Save/update failure:** Inline error message below the affected field; form data preserved
- **Delete failure:** Toast with error message ("Couldn't delete song. Try again.")
- **No destructive error states** -- always preserve user input on failure

### Spacing and Typography
- Follow existing patterns from Phase 1: `p-6 md:p-8` page padding, `font-display text-3xl` for page headings
- Song title: `text-base font-medium` (primary)
- Duration: `text-sm text-stone-500` (secondary, right-aligned)
- Notes: `text-sm text-stone-400 dark:text-stone-500` (tertiary, below title)
- Row padding: `px-4 py-3` for comfortable tap targets

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Svelte 4 stores for filtering | Svelte 5 `$derived` rune | 2024 | Simpler reactive derivations; no store subscription boilerplate |
| Custom API routes for CRUD | SvelteKit form actions | SvelteKit 1.0+ (stable) | Progressive enhancement, structured error handling via `fail()` |
| `on:click` event handlers | `onclick` attribute (Svelte 5) | 2024 | Svelte 5 uses lowercase event attributes instead of `on:` directives |
| `export function` from components | Component binding or context | Svelte 5 | Use `bind:this` with methods or Svelte context for cross-component communication |
| `<slot>` for component children | `{@render children()}` snippets | Svelte 5 | Snippets replace slots |

**Deprecated/outdated:**
- `on:click`, `on:contextmenu` directives: Replaced by `onclick`, `oncontextmenu` in Svelte 5
- `export let` for props: Replaced by `$props()` rune in Svelte 5
- `$:` reactive declarations: Replaced by `$derived` and `$effect` runes

## Open Questions

1. **Supabase migration workflow**
   - What we know: Supabase CLI supports `supabase migration new` to generate migration files, and `supabase db push` to apply them to a remote project
   - What's unclear: Whether the user has Supabase CLI set up locally, or prefers to run SQL directly in the Supabase dashboard
   - Recommendation: Provide the SQL migration in the plan. Let the user decide whether to use the CLI or the dashboard SQL editor. Both achieve the same result.

2. **TypeScript types for the songs table**
   - What we know: `supabase gen types` can auto-generate TypeScript types from the database schema. Manual types are also straightforward for a single table.
   - What's unclear: Whether the user has `supabase` CLI installed and a local development setup
   - Recommendation: Define a manual `Song` type interface in `src/lib/types/database.ts` for now. Note how to generate types with the CLI as an optional enhancement.

3. **Setlist usage warning on delete (future-proofing)**
   - What we know: The user wants a warning about which setlists use a song before deletion. Setlists are Phase 3.
   - What's unclear: The setlist_songs join table schema (Phase 3)
   - Recommendation: Build the confirmation dialog now. Add a placeholder comment for the setlist check. When Phase 3 adds the join table, a simple query can be added to the delete action.

## Sources

### Primary (HIGH confidence)
- [Supabase Official: Build a User Management App with SvelteKit](https://supabase.com/docs/guides/getting-started/tutorials/with-sveltekit) -- Server load, form actions, Supabase CRUD patterns
- [SvelteKit Official: Form Actions](https://svelte.dev/docs/kit/form-actions) -- `fail()`, `use:enhance`, named actions, progressive enhancement
- [Supabase Official: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) -- RLS policy patterns, `(select auth.uid())` optimization, role specification
- [Supabase Official: Generating TypeScript Types](https://supabase.com/docs/guides/api/rest/generating-types) -- `supabase gen types` CLI command

### Secondary (MEDIUM confidence)
- [SvelteKit Discussion: Client-Side SDK vs. Form Actions](https://github.com/sveltejs/kit/discussions/15194) -- Tradeoffs of server-side vs. client-side Supabase calls
- [Supabase Discussion: Storing durations with Interval type](https://github.com/orgs/supabase/discussions/7529) -- Issues with interval serialization, integer seconds recommendation
- [Svelte Playground: In Place Editing](https://svelte.dev/playground/29c1026dda3c47a187bd21afa0782df1) -- Official inline edit example
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) -- `(select auth.uid())` caching, index recommendations

### Tertiary (LOW confidence)
- Context menu and long-press patterns -- assembled from multiple community sources and standard web API patterns; no single authoritative Svelte 5 source. The `touchstart`/`touchmove` cancellation pattern is well-established in web development.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed; no new dependencies
- Architecture: HIGH -- patterns directly from official Supabase + SvelteKit documentation
- Database schema: HIGH -- standard Postgres table + RLS from official Supabase docs
- UI components (toast, dialog, context menu): MEDIUM -- custom implementations based on standard web APIs; no single authoritative Svelte 5 source but patterns are well-established
- Pitfalls: HIGH -- documented in official Supabase docs and community discussions

**Research date:** 2026-02-18
**Valid until:** 2026-03-18 (30 days -- Supabase JS v2 and SvelteKit form actions are stable APIs)
