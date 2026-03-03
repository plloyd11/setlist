# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-02)

**Core value:** Musicians can build a setlist from their songs and instantly see how long the set runs, so they can nail the timing for a show.
**Current focus:** Phase 7 - Test Infrastructure (v1.2)

## Current Position

Phase: 7 of 10 (Test Infrastructure)
Plan: 3 of 3 in current phase (COMPLETE)
Status: Phase Complete
Last activity: 2026-03-03 -- Completed 07-03-PLAN.md

Progress: [██████████████░░░░░░] 70% (phases 1-6 of 10 addressed)

## Performance Metrics

**v1.0 Summary:**
- 4 phases, 15 plans, 31 tasks
- 80 commits, 64 files, 7,205 LOC
- Timeline: 6 days (Feb 17 -> Feb 22)
- Execution time: ~0.9 hours

**v1.1 (paused):**
- Plans completed: 2
- Total execution time: 5min

**v1.2:**
- Plans completed: 3
- 4 phases, 30 requirements
- 07-01: 5min, 2 tasks, 6 files
- 07-02: 3min, 2 tasks, 4 files
- 07-03: 2min, 2 tasks, 3 files

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.

- v1.2: Auth bypass via Supabase admin API password users (Google OAuth cannot be automated)
- v1.2: Custom pointer event helper needed for svelte-dnd-action DnD tests (locator.dragTo() fails silently)
- v1.2: Per-worker test user isolation with CASCADE cleanup
- v1.2: Simple CRUD tests before DnD, multi-user tests last (complexity ordering)
- v1.2: Email/password form always-visible (not test-only gated) for real functionality + test automation
- v1.2: Removed !.env.test gitignore exception to prevent test secrets from being committed
- v1.2: Cleanup operations warn but never throw -- stale data does not fail test runs
- v1.2: Worker-scoped fixtures share one user per worker, auth via real UI login
- v1.2: Factories navigate browser to created item after insertion
- v1.2: Cleanup script deletes bands before users due to RESTRICT constraint on owner_id

### Pending Todos

None.

### Blockers/Concerns

- DnD pointer event helper needs tuning (steps count, timing) -- will address in Phase 9
- Verify FK CASCADE exists on user_id foreign keys -- check in Phase 7

## Session Continuity

Last session: 2026-03-03
Stopped at: Completed 07-03-PLAN.md (factories, cleanup, smoke test)
Next step: Begin Phase 08 (auth tests)
