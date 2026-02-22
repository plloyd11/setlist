---
phase: 04-band-workspaces
plan: 03
subsystem: ui
tags: [svelte, sveltekit, bands, songs, junction-table, sharing]

# Dependency graph
requires:
  - phase: 04-band-workspaces
    plan: 01
    provides: band_songs junction table with RLS, BandSong TypeScript type
  - phase: 04-band-workspaces
    plan: 02
    provides: Band workspace shell with nested layout, BandNav sub-navigation
  - phase: 02-song-library
    provides: songs table, SongRow inline editing pattern, duration utilities
provides:
  - /bands/[id]/songs page with full band song management
  - Band song sharing from personal library via junction table
  - Add-new-song directly to band (creates song + junction row)
  - Inline song editing within band context (edits sync to personal library)
  - Remove song from band (junction row delete, song preserved)
affects: [04-04, 04-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Junction table song sharing: no duplication, edits sync via single source of truth"
    - "Share picker with deduplication: filter personal songs by existing band_song_ids"
    - "Inline form actions for CRUD: use:enhance with toast feedback on all operations"

key-files:
  created:
    - src/routes/(app)/bands/[id]/songs/+page.server.ts
    - src/routes/(app)/bands/[id]/songs/+page.svelte
  modified: []

key-decisions:
  - "Inline share picker panel (not modal) toggled from header button, with search filter and deduplication"
  - "Inline add-new-song form (not separate page) since band songs page is the primary context"
  - "Edit via form action (updateSong) rather than client-side Supabase update for consistency with other band actions"
  - "Remove button visible on each row (no context menu) for quick band song management"

patterns-established:
  - "Band song list uses flattened $derived mapping from junction table nested select"
  - "Share picker filters out already-shared songs using Set of band song IDs"
  - "Band CRUD actions all use server-side form actions with use:enhance progressive enhancement"

requirements-completed: [BAND-03]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 4 Plan 3: Band Song Library Summary

**Band song library page with share-from-personal picker, add-new form, inline editing, and remove -- all via junction table (no duplication, edits sync automatically)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T00:50:37Z
- **Completed:** 2026-02-22T00:53:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Server routes with 4 form actions: shareSong, addNew, removeSong, updateSong with proper validation and error handling
- Band songs page with inline editing matching the personal songs pattern (click to edit title/duration/notes)
- Share-from-library panel with search filter and automatic deduplication (excludes already-shared songs)
- Add-new-song inline form creating both song row and junction row in single action
- Remove button on each row deleting only the junction row (preserving the song in personal library)
- Empty state with CTA buttons for both share and add workflows
- Client-side search filter on band songs list

## Task Commits

Each task was committed atomically:

1. **Task 1: Create band songs server routes with share, add, remove, update actions** - `bf81999` (feat)
2. **Task 2: Build band songs page UI with share picker, add form, and song list** - `25b3913` (feat)

## Files Created/Modified
- `src/routes/(app)/bands/[id]/songs/+page.server.ts` - Server load (band songs via junction + personal songs) and 4 form actions (share, addNew, remove, update)
- `src/routes/(app)/bands/[id]/songs/+page.svelte` - Band song library page with share picker, add form, inline editing, remove, search, and empty state

## Decisions Made
- Used inline share picker panel (toggled from header) instead of modal for faster interaction and visibility of both personal and band songs
- Add-new-song is an inline form on the same page rather than navigating to a separate /new route, since the band songs page is the working context
- Edit uses server-side form action (updateSong) rather than the client-side Supabase update pattern used in personal SongRow, for consistency with other band form actions
- Remove button is always visible on each row (no context menu needed) since band song management is collaborative and frequent

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing svelte-check error in SongRow.svelte (`onlongpress` property) -- not related to this plan's changes, not fixed per scope boundary rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Band songs page fully functional, ready for integration with band setlists in Plan 04
- Songs shared to band are accessible via junction table for setlist builder queries
- BandNav "Songs" tab now resolves to working route (was 404 before this plan)

## Self-Check: PASSED

- All 2 created files verified on disk
- Both task commits verified in git history (bf81999, 25b3913)
- All must_have artifact patterns confirmed present in output files

---
*Phase: 04-band-workspaces*
*Completed: 2026-02-22*
