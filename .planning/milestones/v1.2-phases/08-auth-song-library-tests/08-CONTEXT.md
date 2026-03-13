# Phase 8: Auth & Song Library Tests - Context

**Gathered:** 2026-03-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated Playwright E2E tests covering every auth flow (redirect, access, session persistence, logout) and the full song library lifecycle (add, edit, search, batch entry, delete). Tests run against the existing app using the test infrastructure from Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Auth test scenarios
- Unauthenticated user hitting protected route: verify redirect to login page AND that the return URL is preserved (user returns to original page after login)
- Session persistence: test that reloading the page keeps the user authenticated
- Logout: verify redirect to landing page AND that navigating to a protected route after logout redirects back to login
- Route coverage: test one representative protected route (e.g., /dashboard) — if it works, they all work

### Song CRUD coverage
- Test form validation: verify required fields show errors and invalid inputs are rejected
- Song editing: test full-form save (edit multiple fields at once), not individual field edits
- Search: test search by title only — create songs, search, verify correct results
- Batch entry: enter multiple songs via batch, verify each appears in the library with correct title and duration

### Test organization
- File structure: one file per feature area (auth.spec.ts, songs.spec.ts)
- Naming convention: BDD-style "should [verb] when [condition]" pattern
- Test independence: each test is fully independent — own login, own data, no shared state between tests
- No Page Object Model — use direct locators (page.getByRole(), page.locator()) in tests

### Failure & edge cases
- Negative testing: key validations only — test empty required field (title) and one invalid value to confirm validation works
- Delete confirmation: test the full dialog flow — verify dialog appears, cancel preserves the song, confirm deletes it
- Empty state: verify empty library state message/UI shows for a fresh user with no songs
- Delete persistence: after deleting a song, reload the page and verify it's still gone

### Claude's Discretion
- Exact test data values (song titles, durations)
- Test timeout configuration
- Whether to use test.describe grouping within feature files
- Assertion specificity (exact text vs contains)

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-auth-song-library-tests*
*Context gathered: 2026-03-04*
