---
phase: 07-test-infrastructure
plan: 01
subsystem: testing
tags: [playwright, e2e, supabase-auth, sveltekit, dotenv]

# Dependency graph
requires:
  - phase: 04-auth
    provides: Supabase auth integration and /auth route
provides:
  - Playwright test runner configured with SvelteKit dev server
  - Email/password login form for test user authentication
  - .env.test template for test environment variables
  - tests/ directory structure with .auth/ for stored auth state
affects: [07-02, 07-03, 08-auth-tests, 09-crud-tests, 10-dnd-tests]

# Tech tracking
tech-stack:
  added: ["@playwright/test", "@faker-js/faker", "dotenv"]
  patterns: ["dotenv .env.test loading in playwright.config.ts", "webServer integration with SvelteKit dev"]

key-files:
  created:
    - playwright.config.ts
    - .env.test
    - tests/.gitkeep
  modified:
    - package.json
    - .gitignore
    - src/routes/auth/+page.svelte

key-decisions:
  - "Email/password form is always-visible (not test-only gated) -- simplifies auth testing while adding real functionality"
  - "Single Chromium project in Playwright config -- cross-browser testing deferred"
  - "Removed !.env.test from gitignore so test secrets stay out of version control"

patterns-established:
  - "Test config pattern: dotenv loading .env.test at top of playwright.config.ts"
  - "Auth page dual-method: Google OAuth (primary) + email/password (secondary)"

requirements-completed: [INFRA-01, INFRA-03]

# Metrics
duration: 5min
completed: 2026-03-03
---

# Phase 7 Plan 1: Playwright Setup and Auth Form Summary

**Playwright test runner with SvelteKit dev server integration and email/password login form for E2E test authentication**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-03T21:41:15Z
- **Completed:** 2026-03-03T21:45:47Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Playwright installed and configured with SvelteKit dev server auto-start
- Email/password login form added to /auth page alongside Google OAuth
- Test infrastructure directories and .env.test template created
- Gitignore updated for Playwright output artifacts

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create Playwright config** - `7f5a239` (chore)
2. **Task 2: Add email/password login form to auth page** - `365b4dc` (feat)

## Files Created/Modified
- `playwright.config.ts` - Playwright config with webServer pointing to SvelteKit dev
- `.env.test` - Template with Supabase URL, anon key, and service role key placeholders
- `tests/.gitkeep` - Placeholder for test directory
- `package.json` - Added test scripts and dev dependencies
- `.gitignore` - Added Playwright output dirs, removed !.env.test exception
- `src/routes/auth/+page.svelte` - Added email/password form with signInWithPassword handler

## Decisions Made
- Email/password form is always-visible (not gated behind test mode) -- provides real functionality while enabling test automation
- Single Chromium project in Playwright config -- sufficient for initial E2E coverage
- Removed `!.env.test` gitignore exception so test secrets are never committed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Node version upgrade required for npm install**
- **Found during:** Task 1 (dependency installation)
- **Issue:** Node v20.18.1 did not satisfy `^20.19 || ^22.12 || >=24` engine requirement from existing dependencies
- **Fix:** Switched to Node v22.21.1 via nvm, performed clean install
- **Files modified:** package-lock.json (regenerated)
- **Verification:** npm install succeeded, all dependencies resolved
- **Committed in:** 7f5a239 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed .gitignore to properly exclude .env.test**
- **Found during:** Task 1 (gitignore update)
- **Issue:** Existing `!.env.test` exception on line 20 un-ignored .env.test, meaning test secrets could be committed
- **Fix:** Removed the `!.env.test` line so `.env.*` pattern properly catches it
- **Files modified:** .gitignore
- **Verification:** `git status` does not show .env.test as trackable
- **Committed in:** 7f5a239 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered
- Pre-existing TypeScript error in `SongRow.svelte` (onlongpress attribute) and warnings in setlists page -- unrelated to this plan's changes, not addressed per scope boundary rules

## User Setup Required
None - no external service configuration required. Users will need to populate `.env.test` with their Supabase credentials before running tests (addressed in Plan 02).

## Next Phase Readiness
- Playwright config ready for test authoring
- Auth form ready for E2E login testing via signInWithPassword
- Plan 02 (test helpers/fixtures) can build on this foundation

---
*Phase: 07-test-infrastructure*
*Completed: 2026-03-03*
