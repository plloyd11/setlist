---
phase: 03-setlist-builder
plan: 03
subsystem: ui
tags: [svelte, sveltekit, svelte-dnd-action, drag-and-drop, tailwind, supabase, timing]

requires:
  - phase: 03-setlist-builder
    provides: "setlists, setlist_songs tables with RLS; TypeScript types; svelte-dnd-action installed"
  - phase: 03-setlist-builder
    provides: "Setlist list page with create flow redirecting to builder"
provides:
  - "Two-panel setlist builder with cross-container drag-and-drop"
  - "Server load/actions for setlist CRUD (saveOrder, addSong, removeSong, updateSetlist)"
  - "Sticky timing bar with live total, target, over/under progress, transition stepper"
  - "Mobile-responsive tab toggle with tap-to-add songs"
  - "SetlistSongRow, LibrarySongRow, SetlistHeader, TimingBar, ProgressBar components"
affects: [03-04]

tech-stack:
  added: []
  patterns: [cross-container-dnd-with-copy-on-drag, optimistic-ui-with-background-persist, derived-runes-for-live-timing]

key-files:
  created:
    - src/routes/(app)/setlists/[id]/+page.server.ts
    - src/routes/(app)/setlists/[id]/+page.svelte
    - src/lib/components/setlists/SetlistSongRow.svelte
    - src/lib/components/setlists/LibrarySongRow.svelte
    - src/lib/components/setlists/SetlistHeader.svelte
    - src/lib/components/setlists/TimingBar.svelte
    - src/lib/components/ui/ProgressBar.svelte
  modified: []

key-decisions:
  - "Copy-on-drag pattern: library items reset after drag so songs remain available for re-use"
  - "New items from library get crypto.randomUUID() to avoid duplicate ID pitfall from research"
  - "Delete-all-reinsert pattern for saveOrder to avoid unique constraint issues on position column"
  - "Optimistic UI: setlist updates immediately, DB sync in background with invalidateAll()"
  - "TimingBar sticky at bottom of entire builder (not just setlist panel) for always-visible timing"

patterns-established:
  - "DnD pattern: svelte-dnd-action with shared type, copy-on-drag source, reorderable target"
  - "Persist pattern: optimistic $state update + fetch to form action + invalidateAll()"
  - "Timing pattern: all calculations via $derived runes from reactive setlistItems array"

requirements-completed: [SET-02, SET-03, SET-04, SET-05, SET-06, SET-07, UX-01]

duration: 4min
completed: 2026-02-18
---

# Phase 03 Plan 03: Setlist Builder Summary

**Two-panel drag-and-drop setlist builder with svelte-dnd-action, live timing bar with target/progress/transition, and responsive mobile tab toggle**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-19T01:50:35Z
- **Completed:** 2026-02-19T01:54:28Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Built the core product feature: two-panel builder with cross-container drag-and-drop using svelte-dnd-action
- Server actions for full setlist song management (add, remove, reorder via delete-all-reinsert)
- Sticky timing bar with live total time, mm:ss target input, over/under progress bar, and transition time stepper
- Mobile-responsive layout with tab toggle between Library and Setlist views, plus tap-to-add

## Task Commits

Each task was committed atomically:

1. **Task 1: Server load/actions and builder page with DnD** - `014bdea` (feat)
2. **Task 2: Timing bar with live calculations and progress** - `5655197` (feat)

## Files Created/Modified
- `src/routes/(app)/setlists/[id]/+page.server.ts` - Server load (setlist, songs, profile) + actions (updateSetlist, saveOrder, addSong, removeSong)
- `src/routes/(app)/setlists/[id]/+page.svelte` - Two-panel builder with svelte-dnd-action zones, mobile tabs, search
- `src/lib/components/setlists/SetlistSongRow.svelte` - Draggable row with grip handle, title, duration, remove button
- `src/lib/components/setlists/LibrarySongRow.svelte` - Library row with title, duration, mobile add button
- `src/lib/components/setlists/SetlistHeader.svelte` - Inline-editable name, date input, venue input, logo display
- `src/lib/components/setlists/TimingBar.svelte` - Sticky bar with total, target, diff, progress, transition stepper
- `src/lib/components/ui/ProgressBar.svelte` - Accessible progress bar with amber/red color states

## Decisions Made
- Used copy-on-drag pattern for library panel: songs stay in library after dragging to setlist, library resets on finalize
- New items from library assigned crypto.randomUUID() as setlist_songs ID to prevent duplicate ID issues documented in research
- Delete-all-reinsert pattern for position persistence avoids unique constraint violations during reorder
- Optimistic UI updates: state changes immediately, DB sync happens asynchronously via fetch + invalidateAll
- Timing bar placed at bottom of entire builder layout (not just setlist panel) so it's visible regardless of mobile tab

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Builder page is fully functional for drag-and-drop setlist building with live timing
- Share functionality (03-04) can build on the existing setlist data model and builder
- All setlist CRUD operations are in place for the complete user workflow

---
*Phase: 03-setlist-builder*
*Completed: 2026-02-18*
