---
phase: 04-band-workspaces
plan: 04
subsystem: ui
tags: [svelte, sveltekit, bands, members, invites, ownership-transfer]

# Dependency graph
requires:
  - phase: 04-band-workspaces
    plan: 01
    provides: bands, band_members, band_invites tables with RLS; Band TypeScript types
  - phase: 04-band-workspaces
    plan: 02
    provides: Band workspace shell with nested layout, BandNav, isOwner flag from parent layout
provides:
  - /bands/[id]/members page with member list, invite generation, remove, and transfer ownership
  - /bands/invite/[token] invite acceptance page with token validation and join flow
  - MemberRow component with role badges and context-aware action buttons
affects: [04-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Invite link generation with auto-token from DB default column"
    - "Confirmation step UI pattern for destructive actions (remove member, transfer ownership)"
    - "Profile enrichment via separate query with Map lookup for joined member data"

key-files:
  created:
    - src/routes/(app)/bands/[id]/members/+page.server.ts
    - src/routes/(app)/bands/[id]/members/+page.svelte
    - src/lib/components/bands/MemberRow.svelte
    - src/routes/(app)/bands/invite/[token]/+page.server.ts
    - src/routes/(app)/bands/invite/[token]/+page.svelte
  modified: []

key-decisions:
  - "Profiles loaded separately with Map lookup rather than Supabase join (avoids FK path ambiguity)"
  - "Confirmation step for remove member and transfer ownership prevents accidental clicks"
  - "Invite URL displayed in amber-styled banner with copy button and expiry notice"
  - "Unauthenticated invite visitors redirected to /auth with return URL for post-login redirect"

patterns-established:
  - "Member enrichment: load band_members, fetch profiles by user IDs, merge via Map"
  - "Owner verification: query bands with owner_id = session.user.id for owner-only actions"
  - "Invite lifecycle: generate token -> share URL -> validate + insert member -> mark used"

requirements-completed: [BAND-02]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 4 Plan 4: Member Management & Invite System Summary

**Member management page with invite link generation, remove/transfer actions, and invite acceptance flow with one-time token validation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-22T00:50:44Z
- **Completed:** 2026-02-22T00:54:10Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Member management page showing all band members with profile info, role badges, and joined dates
- One-time invite link generation with copyable URL and 7-day expiry notice
- Owner-only actions: remove member (with confirmation), transfer ownership (with confirmation)
- Leave band action for non-owner members with redirect to /bands
- Invite acceptance page with token validation, band info display, and one-click join
- Already-member detection redirects to band instead of duplicate join
- Used/expired invite links show 404 error page

## Task Commits

Each task was committed atomically:

1. **Task 1: Build member management page with invite, remove, and transfer actions** - `a5fb8b8` (feat)
2. **Task 2: Build invite acceptance page** - `c085ab9` (feat)

## Files Created/Modified
- `src/routes/(app)/bands/[id]/members/+page.server.ts` - Member list loader with profile enrichment; createInvite, removeMember, transferOwnership, leaveBand form actions
- `src/routes/(app)/bands/[id]/members/+page.svelte` - Members page with invite URL display, member list, and owner-context actions
- `src/lib/components/bands/MemberRow.svelte` - Member row with avatar, name, role badge, joined date, and context-aware action buttons
- `src/routes/(app)/bands/invite/[token]/+page.server.ts` - Invite validation loader and accept action with member insert + invite mark-used
- `src/routes/(app)/bands/invite/[token]/+page.svelte` - Centered invite acceptance UI with band logo, name, and join/already-member states

## Decisions Made
- Profiles loaded via separate query with Map lookup rather than attempting Supabase FK join, which avoids ambiguity in the FK path from band_members.user_id to profiles.id
- Remove member and transfer ownership use a two-step confirmation pattern (click button -> confirm/cancel) to prevent accidental destructive actions
- Invite URL displayed in an amber-themed banner with copy button, matching the app's design language
- Unauthenticated users visiting an invite link are redirected to /auth with a redirect query parameter for post-login return

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing svelte-check error in SongRow.svelte (`onlongpress` property) -- not related to this plan's changes, not fixed per scope boundary rules.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Member management and invite system fully functional for Plan 05 (band songs/setlists)
- BandNav Members tab now has a working route
- Invite lifecycle complete: generate -> share -> accept -> one-time enforcement

## Self-Check: PASSED

- All 5 created files verified on disk
- Both task commits verified in git history (a5fb8b8, c085ab9)

---
*Phase: 04-band-workspaces*
*Completed: 2026-02-22*
