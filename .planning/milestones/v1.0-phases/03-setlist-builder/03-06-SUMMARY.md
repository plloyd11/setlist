---
phase: 03-setlist-builder
plan: 06
subsystem: ui
tags: [svelte, dnd, optimistic-ui, supabase]

# Dependency graph
requires:
  - phase: 03-setlist-builder
    provides: "Upsert-based saveOrder action with server ID return (plan 05)"
provides:
  - "Working library-to-setlist drag persistence with server ID sync"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isNew flag pattern for new-item detection in DnD flows"
    - "Server response parsing for ID sync after form action fetch"

key-files:
  created: []
  modified:
    - src/routes/(app)/setlists/[id]/+page.svelte

key-decisions:
  - "Used isNew boolean flag instead of heuristic song_id check for new-item detection"
  - "Parse raw fetch response text for SvelteKit action data instead of using invalidateAll"

patterns-established:
  - "isNew flag on optimistic items: explicit boolean beats heuristic field checks for detecting new DnD items"

requirements-completed: [SET-02]

# Metrics
duration: 1min
completed: 2026-02-20
---

# Phase 3 Plan 06: Library Drag Persistence Fix Summary

**Fixed SET-02 regression: isNew flag for new-item detection and server UUID sync in persistOrder**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-20T21:36:00Z
- **Completed:** 2026-02-20T21:36:55Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed new-item detection in persistOrder using explicit isNew flag instead of broken heuristic
- Added server response parsing to sync real UUIDs back into client state after save
- Library-to-setlist drag now persists correctly across page refresh

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix new-item detection and server ID sync in persistOrder** - `48910d7` (fix)

**Plan metadata:** [pending] (docs: complete plan)

## Files Created/Modified
- `src/routes/(app)/setlists/[id]/+page.svelte` - Added isNew flag to SetlistItem type, set it in handleSetlistFinalize, used it in persistOrder, added server response parsing for UUID sync

## Decisions Made
- Used explicit `isNew` boolean flag on SetlistItem rather than the heuristic `!item.song_id || item.id === item.song_id` check, which broke after plan 05's upsert migration
- Parse SvelteKit action response via `response.text()` + JSON.parse instead of calling `invalidateAll()`, avoiding the $effect jank that plan 05 specifically fixed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None - pre-existing type error in SongRow.svelte (onlongpress attribute) is out of scope.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SET-02 requirement fully resolved, library drag persistence working
- Phase 03 gap closure complete, ready for Phase 04

## Self-Check: PASSED

All files, commits, and artifacts verified.

---
*Phase: 03-setlist-builder*
*Completed: 2026-02-20*
