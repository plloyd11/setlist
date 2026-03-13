# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.2 — Playwright E2E Test Suite

**Shipped:** 2026-03-13
**Phases:** 4 | **Plans:** 10 | **Sessions:** ~6

### What Was Built
- Playwright test harness with worker-scoped fixtures, Supabase admin client, and email/password auth bypass
- Data factories (createSong, createSetlist, createBand) with automatic cleanup
- 6 E2E spec files: auth, songs, setlists (with DnD), bands, RLS isolation
- Multi-user browser context helper for cross-user test scenarios
- 1,317 LOC of test infrastructure and specs covering all 30 requirements

### What Worked
- Complexity ordering (infrastructure → CRUD → DnD → multi-user) avoided rework — each phase built cleanly on the last
- Worker-scoped fixture pattern gave perfect test isolation without per-test overhead
- Factories that navigate the browser after insert eliminated manual navigation in tests
- Warn-not-throw cleanup philosophy prevented cascading test failures from stale data
- Plans were concise (1-2 tasks each) — executors completed quickly with minimal deviation

### What Was Inefficient
- Tests could not be run during development (empty .env.test, no Docker) — every phase flagged the same "human verification needed" item
- ROADMAP.md progress table got stale — phases 7-9 still showed "Not started" after completion
- Milestone version tracking confused v1.1 and v1.2 — STATE.md reported v1.1 as current milestone even while executing v1.2 phases

### Patterns Established
- `createSecondUser(browser)` pattern for multi-user E2E tests — returns `{ page, user, cleanup }`
- Custom `dragAndDrop(page, source, target)` helper using `page.mouse` API for svelte-dnd-action
- Bounding-box y-coordinate comparison for positional assertions after DnD reorder
- Admin API for test data setup in data-focused tests (bypass UI when testing data, not workflow)

### Key Lessons
1. Email/password auth form was a good dual-purpose decision — ships real functionality while enabling test automation. Prefer features that serve both production and testing over test-only scaffolding.
2. DnD libraries that use pointer events need custom test helpers — Playwright's `locator.dragTo()` doesn't work. Invest in the helper early rather than fighting the library.
3. Running tests against a real database (no mocks) catches real issues but requires environment setup. Consider Docker Compose or Supabase CLI as part of test infrastructure to avoid the "can't run tests" problem.

### Cost Observations
- Model mix: ~60% opus (execution), ~30% sonnet (verification, integration check), ~10% orchestrator overhead
- Plans averaged 1-2 minutes each — total execution ~20 minutes across all 10 plans
- Notable: Small, focused plans (1-2 tasks) execute faster and more reliably than larger plans

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~4 | 4 | Initial build — established core patterns |
| v1.2 | ~6 | 4 | Test suite — established testing patterns |

### Cumulative Quality

| Milestone | Test Files | Spec Coverage | Requirements |
|-----------|-----------|---------------|-------------|
| v1.0 | 0 | 0% | 22/22 |
| v1.2 | 6 specs + 6 helpers | All user journeys | 30/30 |

### Top Lessons (Verified Across Milestones)

1. Small, focused plans (1-2 tasks) execute faster and with fewer deviations than large plans
2. Dual-purpose features (serve production + testing/development) are more valuable than single-purpose scaffolding
