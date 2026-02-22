# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-17)

**Core value:** Musicians can build a setlist from their songs and instantly see how long the set runs, so they can nail the timing for a show.
**Current focus:** Phase 4 - Band Workspaces

## Current Position

Phase: 4 of 4 (Band Workspaces)
Plan: 5 of 5 in current phase
Status: Phase Complete
Last activity: 2026-02-22 -- Completed 04-05 (Band Setlists & Builder)

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 14
- Average duration: 4min
- Total execution time: ~0.9 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 2 | 27min | 13.5min |
| 02 | 2 | 5min | 2.5min |
| 03 | 6 | 10min | 1.7min |
| 04 | 5 | 14min | 2.8min |

**Recent Trend:**
- Last 5 plans: 2min, 2min, 2min, 3min, 5min
- Trend: accelerating

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P01 | 15min | 4 tasks | 9 files |
| Phase 01 P02 | 12min | 3 tasks | 11 files |
| Phase 02 P01 | 2min | 2 tasks | 7 files |
| Phase 02 P02 | 3min | 2 tasks | 7 files |
| Phase 03 P01 | 1min | 2 tasks | 5 files |
| Phase 03 P02 | 2min | 2 tasks | 3 files |
| Phase 03 P03 | 4min | 2 tasks | 7 files |
| Phase 03 P04 | 3min | 2 tasks | 7 files |
| Phase 03 P05 | 2min | 2 tasks | 2 files |
| Phase 03 P06 | 1min | 1 tasks | 1 files |
| Phase 04 P01 | 2min | 2 tasks | 4 files |
| Phase 04 P02 | 2min | 2 tasks | 8 files |
| Phase 04 P03 | 2min | 2 tasks | 2 files |
| Phase 04 P04 | 3min | 2 tasks | 5 files |
| Phase 04 P05 | 5min | 2 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 4 phases derived from 22 v1 requirements (standard depth)
- Roadmap: UX-01 (responsive design) assigned to Phase 3 as cross-cutting with core product
- 01-01: Used @supabase/ssr createServerClient with cookie handlers for SSR auth
- 01-01: safeGetSession pattern (getUser first for JWT validation, then getSession)
- 01-01: Auth guard centralized in hooks.server.ts for all non-/auth routes
- 01-02: DOM-based theme functions instead of Svelte stores for simplicity
- 01-02: Inline script in app.html for FOUC prevention (reads localStorage before render)
- 01-02: Google Fonts via link tags for Righteous (headings) and Nunito (body)
- 02-01: parseDuration returns null for 0:00 since DB has check > 0 constraint
- 02-01: Songs page updated with Add Song button in header and CTA in empty state
- 02-02: Client-side filtering/sorting with $derived for instant UX
- 02-02: Inline editing uses Supabase client-side update + invalidateAll()
- 02-02: Single ContextMenu and ConfirmDialog at page level, shared across rows
- 02-02: Hidden form with use:enhance for delete action (progressive enhancement)
- 03-01: Separate RLS policies per operation for setlists, matching songs table pattern
- 03-01: Anon role gets SELECT-only on profiles and shared setlists for public share view
- 03-01: Storage bucket 'logos' is public-read with authenticated user-scoped write via foldername
- 03-02: Stats aggregation via separate setlist_songs query with embedded songs select
- 03-02: Inline name editing on cards (click to edit) instead of modal
- 03-02: Rename as server form action for progressive enhancement
- 03-02: Three-dot menu on cards for Duplicate/Delete (better mobile UX than context menu)
- 03-03: Copy-on-drag pattern for library panel (songs reset after drag to setlist)
- 03-03: New items from library get crypto.randomUUID() as setlist_songs ID to prevent duplicates
- 03-03: Delete-all-reinsert pattern for position persistence avoids unique constraint issues
- 03-03: Optimistic UI updates with background DB sync via fetch + invalidateAll()
- 03-03: TimingBar sticky at bottom of entire builder for always-visible timing
- [Phase 03]: Share toggle uses client-side crypto.randomUUID() passed to server action for token generation
- [Phase 03]: Shared view returns only safe data (name, date, venue, song titles) - no IDs leaked to client
- [Phase 03]: LogoUpload uses browser Supabase client for direct storage upload (not server action)
- 03-05: Upsert over delete-all+reinsert to preserve row IDs and prevent client-side detection bugs
- 03-05: isMutating $state guard on $effect rather than debounce to prevent race conditions
- 03-05: No re-normalization on removeSong -- positions can have gaps, client assigns contiguous on next save
- 03-05: song_id field presence used for new-item detection (library items lack song_id, setlist items have it)
- 03-06: isNew boolean flag for new-item detection instead of heuristic song_id check
- 03-06: Parse raw fetch response for SvelteKit action data to sync server UUIDs without invalidateAll
- 04-01: user_band_ids() security definer stable function for all band RLS policies
- 04-01: band_songs junction table references original song row (no duplication, edits sync automatically)
- 04-01: Separate RLS policies per operation on bands/band_members for owner vs member distinction
- 04-01: Bands nav positioned between Setlists and Settings as separate nav item (per user decision)
- 04-02: Band workspace derives bandId from data.band.id (avoids $page.params string|undefined)
- 04-02: Dashboard quick actions link directly to sub-pages rather than modals
- 04-02: Band list enrichment uses Promise.all for parallel member/song/setlist count queries
- 04-03: Inline share picker panel (not modal) toggled from header with search filter and deduplication
- 04-03: Add-new-song inline form on band songs page rather than separate /new route
- 04-03: Edit via form action (updateSong) for consistency with other band actions
- 04-03: Remove button visible on each row (no context menu) for quick band song management
- 04-04: Profiles loaded separately with Map lookup rather than Supabase join (avoids FK path ambiguity)
- 04-04: Confirmation step for remove member and transfer ownership prevents accidental clicks
- 04-04: Invite URL displayed in amber-styled banner with copy button and expiry notice
- 04-04: Unauthenticated invite visitors redirected to /auth with return URL for post-login redirect
- 04-05: SetlistCard basePath prop (default '/setlists') for band URL routing without component duplication
- 04-05: Band builder flattens junction table to Song[] so library panel reuses exact same types
- 04-05: Share route checks band_id to resolve display profile (band name/logo vs user profile)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 3: svelte-dnd-action Svelte 5 compatibility must be verified before planning
- Phase 3: sveltekit-superforms Svelte 5 / SvelteKit 2 compatibility must be verified
- Phase 1: @supabase/ssr current API should be verified against live docs (RESOLVED: verified and implemented in 01-01)

## Session Continuity

Last session: 2026-02-22
Stopped at: Completed 04-05-PLAN.md (Phase 04 complete, all phases complete)
Resume file: .planning/phases/04-band-workspaces/04-05-SUMMARY.md
