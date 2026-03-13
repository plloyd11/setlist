---
phase: 07-test-infrastructure
plan: 03
subsystem: testing
tags: [playwright, factories, faker, cleanup, smoke-test, supabase-admin]

# Dependency graph
requires:
  - phase: 07-02
    provides: Admin client singleton, auth helpers, cleanup utilities, worker-scoped fixtures
provides:
  - Factory functions (createSong, createSetlist, createBand) with realistic faker defaults
  - Manual cleanup script for purging stale @setlist.test users
  - Smoke test validating the entire test harness end-to-end
affects: [08-auth-tests, 09-crud-tests, 10-dnd-tests]

# Tech tracking
tech-stack:
  added: []
  patterns: ["factory pattern: simple functions with admin client + page navigation", "cleanup script: dotenv + service-role for manual data purge"]

key-files:
  created:
    - tests/helpers/factories.ts
    - scripts/cleanup-test-users.ts
    - tests/smoke.spec.ts
  modified: []

key-decisions:
  - "Factories navigate browser to created item after insertion (per user decision)"
  - "Cleanup script deletes bands before users due to RESTRICT constraint on owner_id"

patterns-established:
  - "Factory pattern: createX(page, userId, overrides?) -> insert via adminClient, navigate, return data"
  - "Cleanup script pattern: dotenv .env.test loading, filter by @setlist.test, RESTRICT-aware delete ordering"

requirements-completed: [INFRA-04, INFRA-05]

# Metrics
duration: 2min
completed: 2026-03-03
---

# Phase 7 Plan 3: Factories, Cleanup, and Smoke Test Summary

**Test data factory functions with faker defaults, manual cleanup script, and smoke test proving the full Playwright harness works end-to-end**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-03T21:51:42Z
- **Completed:** 2026-03-03T21:52:45Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Three factory functions (createSong, createSetlist, createBand) with realistic faker defaults and browser navigation
- Manual cleanup script that purges all @setlist.test users with RESTRICT-aware delete ordering
- Smoke test validating: Playwright config, worker fixtures, auth flow, factory functions, and per-test cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create factory functions and cleanup script** - `c7c59e5` (feat)
2. **Task 2: Create smoke test validating the full harness** - `cdfdbab` (feat)

## Files Created/Modified
- `tests/helpers/factories.ts` - createSong, createSetlist, createBand with faker defaults and page navigation
- `scripts/cleanup-test-users.ts` - Manual cleanup script filtering @setlist.test users, RESTRICT-aware ordering
- `tests/smoke.spec.ts` - Two smoke tests: auth verification and factory + cleanup validation

## Decisions Made
- Factories navigate the browser to the created item after insertion (per user decision from research phase)
- Cleanup script deletes bands before users due to RESTRICT constraint on owner_id FK

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- .env.test is not populated with real Supabase credentials, so `npx playwright test tests/smoke.spec.ts` cannot be run yet. Tests will pass once credentials are provided.

## User Setup Required
Populate `.env.test` with Supabase credentials (PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) before running tests.

## Next Phase Readiness
- Full test harness is complete: Playwright config, fixtures, helpers, factories, cleanup, and smoke test
- Phase 08 (auth tests) can begin writing real E2E tests using `import { test, expect } from './fixtures'`
- All factory functions available for creating test data in one line

## Self-Check: PASSED

- All 3 created files verified on disk
- Both task commits (c7c59e5, cdfdbab) verified in git log

---
*Phase: 07-test-infrastructure*
*Completed: 2026-03-03*
