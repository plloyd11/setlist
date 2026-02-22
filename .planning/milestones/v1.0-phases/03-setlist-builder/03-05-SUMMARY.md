---
phase: 03-setlist-builder
plan: 05
subsystem: ui
tags: [svelte5, dnd, optimistic-ui, race-condition, supabase]

# Dependency graph
requires:
  - phase: 03-setlist-builder
    provides: "DnD setlist builder with drag-from-library, reorder, remove"
provides:
  - "Race-condition-free drag-and-drop reorder"
  - "Reliable optimistic song removal without flash-back"
  - "Stable row ID preservation via upsert pattern"
  - "isMutating guard pattern for $effect safety"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isMutating $state guard to prevent $effect from overwriting optimistic state"
    - "Upsert pattern: update existing rows by ID, insert only new rows"
    - "song_id-based new-item detection instead of ID set comparison"

key-files:
  created: []
  modified:
    - src/routes/(app)/setlists/[id]/+page.server.ts
    - src/routes/(app)/setlists/[id]/+page.svelte

key-decisions:
  - "Upsert over delete-all+reinsert to preserve row IDs and prevent client-side detection bugs"
  - "isMutating guard on $effect rather than debounce to prevent race conditions"
  - "No re-normalization on removeSong -- positions can have gaps, client assigns contiguous on next save"
  - "song_id field presence used for new-item detection (library items lack song_id, setlist items have it)"

patterns-established:
  - "isMutating guard: set true before optimistic mutation, false in finally block, $effect returns early"
  - "Upsert pattern: separate existing (UPDATE) from new (INSERT), delete by exclusion"

requirements-completed: [SET-03, SET-04]

# Metrics
duration: 2min
completed: 2026-02-20
---

# Phase 3 Plan 5: DnD and Remove Bug Fixes Summary

**Fixed drag-and-drop reorder jank and song removal race condition via isMutating $effect guard and stable upsert pattern replacing delete-all+reinsert**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-20T14:18:57Z
- **Completed:** 2026-02-20T14:20:55Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Eliminated drag-and-drop jank/crashes by preventing $effect from overwriting optimistic state during async mutations
- Fixed song removal flash-back bug by removing invalidateAll from success path
- Replaced destructive delete-all+reinsert saveOrder with stable upsert that preserves row IDs
- Simplified removeSong to single-row delete without re-normalization

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix server saveOrder and removeSong to preserve row IDs** - `77c6e8e` (fix)
2. **Task 2: Guard $effect and remove invalidateAll from mutations in +page.svelte** - `b2a17d7` (fix)

## Files Created/Modified
- `src/routes/(app)/setlists/[id]/+page.server.ts` - Upsert-based saveOrder, simplified removeSong
- `src/routes/(app)/setlists/[id]/+page.svelte` - isMutating guard, invalidateAll removal, song_id detection

## Decisions Made
- Used upsert (update existing + insert new) instead of delete-all+reinsert to preserve row IDs across saves
- Added isMutating $state guard on the setlistItems $effect rather than removing the $effect entirely (still needed for initial load and handleAddSong sync)
- Removed position re-normalization from removeSong -- gaps in positions are harmless since client sends contiguous positions on next saveOrder
- Used song_id field presence to detect new library items instead of comparing against server ID sets (immune to ID churn)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UAT tests 9 (reorder) and 10 (remove) should now pass
- No regressions expected for tests 8 (drag from library), 11 (timing), 12 (transitions)
- Phase 3 gap closure complete, ready for Phase 4

---
*Phase: 03-setlist-builder*
*Completed: 2026-02-20*
