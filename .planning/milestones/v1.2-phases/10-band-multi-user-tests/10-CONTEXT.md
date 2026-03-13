# Phase 10: Band & Multi-User Tests - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated Playwright E2E tests verifying band collaboration workflows (create, invite, join, shared library, collaborative setlists) and RLS data isolation (cross-user song/setlist access, unauthenticated access, band membership enforcement). Tests use multiple browser contexts with separate authenticated users.

</domain>

<decisions>
## Implementation Decisions

### Second user setup
- Per-test inline creation via Supabase admin API (not worker-scoped second fixture)
- Second user authenticates via real login UI in a new browser context (consistent with primary user)
- Standalone helper function: `createSecondUser(browser)` returns `{ page, user, cleanup }`
- Cleanup via returned `cleanup()` function called explicitly by the test (not afterEach hook)
- Helper lives in new file `tests/helpers/multi-user.ts`

### Invite link flow
- Full UI flow: User A creates band via UI, generates invite link, User B opens link in separate context and accepts
- Invite link extracted from UI element (similar to SETL-08 share URL extraction pattern)
- Shared data (songs, setlists) created via admin API, verified in UI by both users
- Collaboration verification = both users can view AND edit (add/remove/reorder songs in shared setlist)

### RLS isolation approach
- Direct URL navigation to another user's resources (not list page absence checks)
- Expected behavior: redirect or error page when accessing forbidden resource (assert URL change or error message)
- RLS-03: Separate test from SETL-08 — verify shared link works unauthenticated AND that navigating to protected routes from that context fails
- RLS-04: Third non-member user to prove band membership enforcement (User A = owner, User B = member, User C = outsider)

### Test file organization
- Two files: `bands.spec.ts` (BAND-01 through BAND-05) and `rls.spec.ts` (RLS-01 through RLS-04)
- Parallel execution with all other specs (default Playwright behavior, no serial mode)
- BDD-style naming consistent with Phase 8-9 pattern

### Claude's Discretion
- Exact locator strategies for band UI elements (settings page, invite link display)
- How createSecondUser/createThirdUser share code internally
- Test data values (band names, song titles)
- Whether RLS-04 third user helper is a separate function or reuses createSecondUser

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `createBand` factory: Creates band via admin API with owner as first member, navigates to `/bands/[id]`
- `createTestUser` / `deleteTestUser`: Admin API user lifecycle with CASCADE cleanup (bands deleted first due to RESTRICT)
- `safeDelete`: Warn-but-never-throw cleanup helper
- `dragAndDrop` helper: For any DnD-based collaboration tests on shared setlists
- `createSong` / `createSetlist` factories: For populating shared band data via admin API

### Established Patterns
- Worker-scoped primary user via fixtures.ts with storageState auth
- Admin API data setup + UI verification (Phase 8-9 pattern)
- Bounding box y-coordinate comparison for positional assertions
- `adminClient` from `helpers/supabase-admin.ts` for all service-role operations

### Integration Points
- Band routes: `/bands`, `/bands/[id]`, `/bands/[id]/settings`, `/bands/[id]/members`, `/bands/[id]/setlists`, `/bands/[id]/songs`
- Invite route: `/bands/invite/[token]`
- Band-related tables: `bands`, `band_members`, `band_songs`, `band_setlists`
- Cleanup: `deleteTestUser` already handles band deletion before user deletion (RESTRICT constraint)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-band-multi-user-tests*
*Context gathered: 2026-03-12*
