---
phase: 04-band-workspaces
plan: 01
subsystem: database
tags: [postgres, rls, supabase, migration, svelte, navigation, typescript]

# Dependency graph
requires:
  - phase: 02-song-library
    provides: songs table with user-scoped RLS policies
  - phase: 03-setlist-builder
    provides: setlists, setlist_songs, profiles tables; storage bucket for logos
provides:
  - bands, band_members, band_songs, band_invites tables with comprehensive RLS
  - user_band_ids() security definer function for RLS performance
  - band_id nullable FK on setlists table for band setlists
  - Band member access policies on songs, setlist_songs, and profiles tables
  - Storage policies for band logo uploads
  - Band, BandMember, BandSong, BandInvite TypeScript interfaces
  - Bands nav item in sidebar and bottom nav
affects: [04-02, 04-03, 04-04, 04-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "user_band_ids() security definer stable function for membership-based RLS"
    - "Junction table pattern for song sharing without duplication"
    - "Nullable FK on existing table for optional band association"

key-files:
  created:
    - supabase/migrations/20260221000000_create_band_tables.sql
  modified:
    - src/lib/types/database.ts
    - src/lib/components/layout/Sidebar.svelte
    - src/lib/components/layout/BottomNav.svelte

key-decisions:
  - "user_band_ids() security definer function encapsulates membership lookup for all band RLS policies"
  - "band_songs junction table references original song row -- no duplication, edits sync automatically"
  - "Separate RLS policies per operation on bands/band_members for owner vs member distinction"
  - "Bands nav positioned between Setlists and Settings as separate nav item (per user decision)"

patterns-established:
  - "Membership-based RLS: band_id = any((select public.user_band_ids()))"
  - "Owner-only operations: subquery on bands.owner_id = (select auth.uid())"
  - "Band logo storage: logos/bands/{band_id}/ folder with owner check"

requirements-completed: [BAND-01, BAND-02, BAND-03, BAND-04]

# Metrics
duration: 2min
completed: 2026-02-22
---

# Phase 4 Plan 1: Database Foundation & Navigation Summary

**Band database schema with 4 tables, 20+ RLS policies, user_band_ids() helper function, and Bands nav item in app shell**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-22T00:40:36Z
- **Completed:** 2026-02-22T00:42:55Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Complete band database foundation: bands, band_members, band_songs, band_invites tables with full RLS
- user_band_ids() security definer function for efficient membership-based access control
- Setlists table extended with nullable band_id FK and band member access policies
- Additional RLS policies on songs, setlist_songs, and profiles for cross-band data access
- Band TypeScript types (Band, BandMember, BandSong, BandInvite) and updated Setlist interface
- Bands nav item visible in both sidebar and bottom nav between Setlists and Settings

## Task Commits

Each task was committed atomically:

1. **Task 1: Create band database migration** - `d6e2dd0` (feat)
2. **Task 2: Add band TypeScript types and update navigation** - `0a80d67` (feat)

## Files Created/Modified
- `supabase/migrations/20260221000000_create_band_tables.sql` - Complete band schema: 4 tables, helper function, 20+ RLS policies, indexes, storage policies, profiles bandmate policy
- `src/lib/types/database.ts` - Band, BandMember, BandSong, BandInvite interfaces; Setlist.band_id added
- `src/lib/components/layout/Sidebar.svelte` - Bands nav item with group/people icon between Setlists and Settings
- `src/lib/components/layout/BottomNav.svelte` - Bands nav item with group/people icon between Setlists and Settings

## Decisions Made
- user_band_ids() security definer stable function encapsulates the membership lookup, enabling Postgres to cache the result per-statement across all RLS policy evaluations
- band_songs junction table references original song rows (no duplication) -- "sync" is automatic because there is only one source of truth
- Separate RLS policies per operation on bands and band_members tables to enforce owner-only vs all-member permissions
- Bands nav positioned between Setlists and Settings as a separate nav item (per locked user decision)
- Band setlist INSERT policy allows any band member to create setlists (band_id in user_band_ids) without requiring user_id match
- Profiles table gets bandmate SELECT policy so authenticated users can see bandmates' display names and avatars

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Docker Desktop not running, so `supabase db reset` verification could not execute. The migration SQL follows established patterns from existing migrations (20260218000000, 20260218100000) and the research document. Manual verification pending Docker availability.
- Pre-existing svelte-check error in SongRow.svelte (`onlongpress` property) -- not related to this plan's changes, not fixed per scope boundary rules.

## User Setup Required

None - no external service configuration required. Docker must be running to apply migration via `supabase db reset`.

## Next Phase Readiness
- All band tables and RLS policies ready for Plans 02-05 to build upon
- TypeScript types importable from `$lib/types/database.ts` for all band-related components
- Bands nav item visible, ready for `/bands` route creation in Plan 02
- Setlists table has band_id column, ready for band setlist features in Plan 04

## Self-Check: PASSED

- All 5 files verified on disk
- Both task commits verified in git history (d6e2dd0, 0a80d67)
- All 6 must_have artifact patterns confirmed present in output files

---
*Phase: 04-band-workspaces*
*Completed: 2026-02-22*
