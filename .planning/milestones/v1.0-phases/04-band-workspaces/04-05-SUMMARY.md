---
phase: 04-band-workspaces
plan: 05
subsystem: ui
tags: [svelte, sveltekit, bands, setlists, dnd, sharing, builder]

# Dependency graph
requires:
  - phase: 04-band-workspaces
    plan: 02
    provides: Band workspace shell with nested layout, BandNav sub-navigation
  - phase: 04-band-workspaces
    plan: 03
    provides: Band song library via junction table, band_songs data loading pattern
  - phase: 03-setlist-builder
    provides: SetlistCard, SetlistHeader, SetlistSongRow, LibrarySongRow, TimingBar components; DnD builder pattern
provides:
  - /bands/[id]/setlists page with card grid, create, delete, duplicate, rename actions
  - /bands/[id]/setlists/[setlistId] builder with DnD, timing, share toggle using band songs
  - Updated /share/[token] route showing band name and logo for band setlists
  - SetlistCard basePath prop for flexible URL routing
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Band setlist builder: identical to personal builder but loads band_songs via junction table"
    - "Share route profile resolution: band_id check determines band vs personal profile display"
    - "SetlistCard basePath prop: enables reuse across personal and band contexts"

key-files:
  created:
    - src/routes/(app)/bands/[id]/setlists/+page.server.ts
    - src/routes/(app)/bands/[id]/setlists/+page.svelte
    - src/routes/(app)/bands/[id]/setlists/[setlistId]/+page.server.ts
    - src/routes/(app)/bands/[id]/setlists/[setlistId]/+page.svelte
  modified:
    - src/lib/components/setlists/SetlistCard.svelte
    - src/routes/share/[token]/+page.server.ts

key-decisions:
  - "SetlistCard gets basePath prop (default '/setlists') for band URL routing without duplicating component"
  - "Band builder loads songs via band_songs junction flatten, reusing same Song type for library panel"
  - "Share route checks band_id to resolve display profile: band name/logo for band setlists, user profile for personal"
  - "Band builder passes profile={null} to SetlistHeader since band logo is in workspace layout header"

patterns-established:
  - "Band setlist actions use band_id filter instead of user_id for RLS-consistent authorization"
  - "Junction table flatten pattern: band_songs.select('song_id, songs(*)') mapped to Song[] for reuse"
  - "Shared view profile polymorphism: single profile object works for both band and personal setlists"

requirements-completed: [BAND-04]

# Metrics
duration: 5min
completed: 2026-02-22
---

# Phase 4 Plan 5: Band Setlists & Builder Summary

**Band setlist list with CRUD actions, full DnD builder loading band songs via junction table, and shared view with band name/logo branding**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-22T02:44:14Z
- **Completed:** 2026-02-22T02:49:14Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Band setlist list page with card grid, create/rename/duplicate/delete actions mirroring personal setlists
- Band setlist builder with full DnD, copy-on-drag, optimistic UI, timing bar -- identical UX to personal builder
- Builder library panel loads band songs (via junction table) instead of personal songs
- Share route updated to show band name and logo for band setlists, personal profile for personal setlists
- SetlistCard component enhanced with basePath prop for reuse across band and personal contexts

## Task Commits

Each task was committed atomically:

1. **Task 1: Create band setlist list page with create, delete, duplicate actions** - `42c62c5` (feat)
2. **Task 2: Create band setlist builder and update shared view for band branding** - `1eb7358` (feat)

## Files Created/Modified
- `src/routes/(app)/bands/[id]/setlists/+page.server.ts` - Band setlist list loader and create/delete/duplicate/rename actions
- `src/routes/(app)/bands/[id]/setlists/+page.svelte` - Band setlist card grid with empty state and inline create form
- `src/routes/(app)/bands/[id]/setlists/[setlistId]/+page.server.ts` - Band setlist builder data loader (band_songs library) and all builder actions
- `src/routes/(app)/bands/[id]/setlists/[setlistId]/+page.svelte` - Band setlist builder with DnD, timing, share toggle reusing all existing components
- `src/lib/components/setlists/SetlistCard.svelte` - Added basePath prop for flexible URL routing
- `src/routes/share/[token]/+page.server.ts` - Updated to load band profile for band setlists

## Decisions Made
- Added `basePath` prop to SetlistCard (default `/setlists`) rather than duplicating the component for band context -- keeps a single source of truth
- Band builder flattens junction table results (`band_songs -> songs`) into Song-type objects so the library panel uses the exact same types as personal builder
- Share route resolves display profile based on `band_id` presence: loads band name/logo for band setlists, user profile for personal -- the template already uses `profile.display_name` and `profile.logo_url` so no UI changes needed
- Passed `profile={null}` to SetlistHeader in band builder since band logo is already displayed in the workspace layout header above

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SetlistHeader missing profile prop in band builder**
- **Found during:** Task 2
- **Issue:** SetlistHeader requires a `profile` prop but band builder didn't pass it, causing TypeScript error
- **Fix:** Passed `profile={null}` explicitly since band logo is in workspace layout header
- **Files modified:** `src/routes/(app)/bands/[id]/setlists/[setlistId]/+page.svelte`
- **Verification:** svelte-check passes with only pre-existing SongRow error
- **Committed in:** 1eb7358 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor type-safety fix. No scope creep.

## Issues Encountered
- Pre-existing svelte-check error in SongRow.svelte (`onlongpress` property) -- not related to this plan's changes, not fixed per scope boundary rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All band workspace functionality is complete (Plans 01-05)
- BandNav "Setlists" tab now resolves to working route with full builder
- Band setlists can be shared via public link with band branding
- Phase 04 is the final phase -- all v1 requirements satisfied

## Self-Check: PASSED

- All 4 created files verified on disk
- Both modified files verified on disk
- Both task commits verified in git history (42c62c5, 1eb7358)

---
*Phase: 04-band-workspaces*
*Completed: 2026-02-22*
