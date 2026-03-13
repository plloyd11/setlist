# Phase 7: Test Infrastructure - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A working Playwright test harness where any test file can authenticate as an isolated test user and create test data without touching production. Covers: Playwright config, auth bypass, fixtures, factories, and cleanup.

</domain>

<decisions>
## Implementation Decisions

### Auth bypass strategy
- One test user per parallel worker (not per test) — created via Supabase admin API as email/password user
- Tests authenticate by signing in through the actual login UI (email/password form) — gives login flow coverage for free
- Tests run against the same Supabase project (not a separate test project) — relies on cleanup
- Test user email format: descriptive pattern, e.g., `test-worker0-1709481234@setlist.test` — easy to identify and query in Supabase dashboard

### Test data factories
- Mixed approach: create data via Supabase API for speed, verify it appears correctly in the UI
- Realistic defaults for all fields — factories fill every field (title, duration, key, tempo, etc.) so tests only override what they care about
- Factories return data AND navigate browser to the created item — test starts ready to interact
- Simple naming: `createSong`, `createSetlist`, `createBand` — no factory objects

### Cleanup behavior
- Per-test cleanup: each test explicitly deletes the entities it created
- Worker teardown deletes the test user as a final sweep (CASCADE handles anything missed)
- Cleanup failures warn but don't fail the test run — stale data may accumulate
- Manual cleanup script as safety net — npm script to purge all test-* users and their data

### Test organization
- Feature folders: `tests/auth/login.spec.ts`, `tests/songs/crud.spec.ts`, etc.
- Parallel execution by default — matches one-user-per-worker isolation model
- Chromium only — fast feedback loop, expand to other browsers later if needed
- Shared helpers in `tests/helpers/` (factories, auth, cleanup utilities)

### Claude's Discretion
- Playwright config details (timeouts, retries, reporter)
- Exact fixture implementation pattern
- How factory functions compose for complex scenarios (e.g., band with members and songs)
- Cleanup script implementation approach

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 07-test-infrastructure*
*Context gathered: 2026-03-03*
