---
phase: 03-setlist-builder
plan: 01
subsystem: database
tags: [postgres, rls, supabase, storage, svelte-dnd-action, typescript]

requires:
  - phase: 02-song-library
    provides: "songs table referenced by setlist_songs FK"
provides:
  - "profiles, setlists, setlist_songs tables with RLS"
  - "Anon read access for shared setlists"
  - "Logos storage bucket with user-scoped policies"
  - "TypeScript interfaces for Profile, Setlist, SetlistSong"
  - "svelte-dnd-action dependency installed"
  - "Auth guard /share exemption"
affects: [03-02, 03-03, 03-04]

tech-stack:
  added: [svelte-dnd-action]
  patterns: [anon-rls-for-sharing, partial-index-on-share-token, storage-bucket-per-feature]

key-files:
  created:
    - supabase/migrations/20260218100000_create_setlist_tables.sql
  modified:
    - src/lib/types/database.ts
    - src/hooks.server.ts
    - package.json

key-decisions:
  - "Separate RLS policies per operation (SELECT/INSERT/UPDATE/DELETE) for setlists, matching songs table pattern"
  - "Anon role gets SELECT-only on profiles and shared setlists for public share view"
  - "Storage bucket 'logos' is public-read with authenticated user-scoped write via foldername"

patterns-established:
  - "Sharing pattern: nullable share_token UUID column, partial index, anon SELECT policy"
  - "Storage policy pattern: user folder scoping via storage.foldername(name)[1]"

requirements-completed: []

duration: 1min
completed: 2026-02-18
---

# Phase 03 Plan 01: Database Foundation Summary

**Setlist/profile schema with share-token RLS, logos storage bucket, TypeScript types, and svelte-dnd-action installed**

## Performance

- **Duration:** 1 min
- **Started:** 2026-02-19T01:43:20Z
- **Completed:** 2026-02-19T01:44:31Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created profiles, setlists, and setlist_songs tables with full RLS for both authenticated owners and anonymous shared access
- Set up logos storage bucket with user-scoped upload and public read policies
- Added TypeScript interfaces (Profile, Setlist, SetlistSong) and installed svelte-dnd-action
- Updated auth guard to exempt /share/* routes for public setlist viewing

## Task Commits

Each task was committed atomically:

1. **Task 1: Create database migration** - `f020b26` (feat)
2. **Task 2: Add TypeScript types, install svelte-dnd-action, update auth guard** - `14393c5` (feat)

## Files Created/Modified
- `supabase/migrations/20260218100000_create_setlist_tables.sql` - Migration with profiles, setlists, setlist_songs tables, indexes, RLS policies, and logos storage bucket
- `src/lib/types/database.ts` - Added Profile, Setlist, SetlistSong interfaces
- `src/hooks.server.ts` - Added /share exemption to auth guard
- `package.json` - Added svelte-dnd-action devDependency
- `pnpm-lock.yaml` - Updated lockfile

## Decisions Made
- Separate RLS policies per operation for setlists (SELECT/INSERT/UPDATE/DELETE) matching existing songs table pattern
- Anon role gets SELECT-only on profiles and shared setlists for public share view
- Storage bucket 'logos' is public-read with authenticated user-scoped write via foldername

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing type error in SongRow.svelte (`onlongpress` not in HTMLButtonAttributes) causes `pnpm run check` to fail. Not related to this plan's changes. Logged to deferred-items.md.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Database schema ready for all subsequent setlist builder plans (CRUD, drag-and-drop, sharing)
- TypeScript types available for import in components and server functions
- svelte-dnd-action ready for setlist song ordering UI
- Auth guard configured for anonymous share route access

---
*Phase: 03-setlist-builder*
*Completed: 2026-02-18*
