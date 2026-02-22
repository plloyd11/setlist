---
phase: 02-song-library
plan: 02
subsystem: ui, api
tags: [sveltekit, svelte5, supabase, inline-editing, context-menu, search-filter]

# Dependency graph
requires:
  - phase: 02-song-library
    plan: 01
    provides: Songs table, Song type, duration utilities, Toast component
provides:
  - Song library list page with search, filter, sort
  - Inline editing via SongRow component
  - Context menu (right-click / long-press)
  - Confirm dialog (reusable)
  - Long-press Svelte action
  - Server-side song load and delete action
affects: [03-setlist-builder]

# Tech tracking
tech-stack:
  added: []
  patterns: [client-side filtering with $derived, inline editing with Supabase client update, promise-based confirm dialog, longpress Svelte action, hidden form for server actions]

key-files:
  created:
    - src/routes/(app)/songs/+page.server.ts
    - src/lib/components/songs/SongRow.svelte
    - src/lib/components/songs/SongSearch.svelte
    - src/lib/components/ui/ContextMenu.svelte
    - src/lib/components/ui/ConfirmDialog.svelte
    - src/lib/actions/longpress.ts
  modified:
    - src/routes/(app)/songs/+page.svelte

key-decisions:
  - "Client-side filtering/sorting with $derived for instant UX, server loads all songs"
  - "Inline editing uses Supabase client-side update + invalidateAll() for data refresh"
  - "Single ContextMenu and ConfirmDialog at page level, shared across all song rows"
  - "Hidden form with use:enhance for delete action to leverage SvelteKit form actions"

patterns-established:
  - "Client-side search/filter/sort: server loads full dataset, $derived computes filtered view"
  - "Inline editing: SongRow manages edit state, calls supabase.update(), invalidateAll()"
  - "Promise-based ConfirmDialog: bind:this + exported confirm() returning Promise<boolean>"
  - "Context menu pattern: page-level singleton positioned at event coordinates"
  - "Longpress action: touchstart timer with scroll-cancellation threshold"

requirements-completed: [SONG-02, SONG-03, SONG-04]

# Metrics
duration: 3min
completed: 2026-02-18
---

# Phase 2 Plan 2: Song Library List Page Summary

**Song library list page with real-time search/filter, sort toggles, inline editing, context menu, and delete confirmation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T14:18:04Z
- **Completed:** 2026-02-18T14:20:41Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Server load function fetches user's songs with RLS, delete action with auth guard
- Song library page with real-time title search, duration filter pills (All, <3 min, 3-5 min, >5 min), and sort toggles (title/duration/date with direction)
- Inline editing via tap/click with title, duration (mm:ss), and notes fields, saving directly to Supabase
- Context menu (right-click desktop, long-press mobile) with Edit and Delete options
- Confirmation dialog using native `<dialog>` element with promise-based API
- Empty state CTA and no-results state with clear filters button

## Task Commits

Each task was committed atomically:

1. **Task 1: Create server load/actions, UI components** - `34291e2` (feat)
2. **Task 2: Build SongRow and assemble song library list page** - `9ff7c39` (feat)

## Files Created/Modified
- `src/routes/(app)/songs/+page.server.ts` - Server load (fetch songs) and delete form action
- `src/routes/(app)/songs/+page.svelte` - Full song library page with search, filter, sort, context menu, delete
- `src/lib/components/songs/SongRow.svelte` - Song row with display/edit modes, inline validation, Supabase update
- `src/lib/components/songs/SongSearch.svelte` - Collapsible search input with duration filter pills
- `src/lib/components/ui/ContextMenu.svelte` - Right-click/long-press context menu with boundary checking
- `src/lib/components/ui/ConfirmDialog.svelte` - Native dialog with promise-based confirm()
- `src/lib/actions/longpress.ts` - Svelte action for 500ms touch hold with scroll cancellation

## Decisions Made
- Client-side filtering/sorting via `$derived` for instant feedback -- server loads all user songs at once, which is fine for typical library sizes (< 1000 songs)
- Inline editing calls Supabase directly from the client, then `invalidateAll()` to refresh server data, keeping the pattern simple
- Single ContextMenu and ConfirmDialog instances at the page level, shared across all song rows to avoid DOM bloat
- Hidden form with `use:enhance` for delete action, leveraging SvelteKit's form action pattern for progressive enhancement
- `editingSongId` state at page level allows context menu "Edit" to trigger edit mode on any row

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added session null check in server load function**
- **Found during:** Task 1 (server load implementation)
- **Issue:** Plan did not specify handling unauthenticated requests in the load function
- **Fix:** Added early return with empty songs array when no session
- **Files modified:** `src/routes/(app)/songs/+page.server.ts`
- **Committed in:** `34291e2` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added song ID validation in delete action**
- **Found during:** Task 1 (delete action implementation)
- **Issue:** Plan did not specify validating that song ID is present in form data
- **Fix:** Added null check returning `fail(400)` when ID is missing
- **Files modified:** `src/routes/(app)/songs/+page.server.ts`
- **Committed in:** `34291e2` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 missing critical)
**Impact on plan:** Both auto-fixes necessary for security and error handling. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete song CRUD cycle ready (add, view, edit, delete)
- All Phase 2 requirements (SONG-01 through SONG-04) satisfied
- ConfirmDialog and ContextMenu reusable for Phase 3 (setlist builder)
- Duration utilities proven across add-song form and song list display

---
*Phase: 02-song-library*
*Completed: 2026-02-18*

## Self-Check: PASSED

- All 7 files verified present on disk
- Commit `34291e2` (Task 1) verified in git log
- Commit `9ff7c39` (Task 2) verified in git log
- TypeScript compiles cleanly
- Production build succeeds
