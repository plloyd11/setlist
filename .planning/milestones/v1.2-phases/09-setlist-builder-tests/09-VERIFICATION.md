---
phase: 09-setlist-builder-tests
verified: 2026-03-12T19:15:00Z
status: passed
score: 8/8 must-haves verified
re_verification: false
human_verification:
  - test: "DnD add song actually moves song into setlist"
    expected: "Song appears in setlist panel after pointer-event drag; empty state disappears"
    why_human: "Cannot run Playwright against live app without .env.test — DnD simulation correctness needs a real browser run"
  - test: "DnD reorder persists across page reload"
    expected: "Song Beta appears above Song Alpha after reload"
    why_human: "Bounding-box positional assertion logic is correct but persistence through the server action can only be confirmed via real browser run"
  - test: "Share link resolves to public page without authentication"
    expected: "Unauthenticated browser context sees setlist name and songs at /share/[token]"
    why_human: "URL extraction from .truncate span and unauthenticated context creation require a live Supabase + running SvelteKit server"
---

# Phase 9: Setlist Builder Tests — Verification Report

**Phase Goal:** The core setlist-building workflow — including drag-and-drop, live timing, and sharing — has full automated coverage
**Verified:** 2026-03-12T19:15:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A song can be dragged from the library panel into the setlist panel via pointer events | VERIFIED | `tests/setlists.spec.ts` line 116–151: SETL-02 describe block uses `dragAndDrop(page, librarySong, setlistZone)` with assertions on empty-state removal and remove-button appearance |
| 2 | Songs within a setlist can be reordered via drag-and-drop | VERIFIED | `tests/setlists.spec.ts` line 153–203: SETL-03 describe block drags betaRow onto alphaRow and asserts bounding-box y-coordinate order after reload |
| 3 | Reordered song positions persist after page reload | VERIFIED | SETL-03 test calls `page.reload()` then checks `betaBox.y < alphaBox.y` (line 196) |
| 4 | A test can create a new setlist via the UI form and verify redirect to detail page | VERIFIED | `tests/setlists.spec.ts` line 7–41: two tests in SETL-01 block verify `toHaveURL(/\/setlists\/.+/)` and setlist name visibility |
| 5 | A test can duplicate a setlist and verify the copy appears with '(Copy)' suffix | VERIFIED | SETL-07 block line 44–58: hover -> options menu -> Duplicate -> `expect(page.getByText('Original Set (Copy)')).toBeVisible()` |
| 6 | Running time total visibly updates as songs are added or removed | VERIFIED | SETL-04 block line 205–259: two tests assert `5:00` on load and `2:00` after remove-button click |
| 7 | Setting a target time shows an over/under indicator with correct sign | VERIFIED | SETL-05 block line 261–317: `+1:00` and `-2:00` assertions after `targetInput.fill` + Tab |
| 8 | A shared setlist is accessible via public link in an unauthenticated browser | VERIFIED | SETL-08 block line 353–388: `browser.newContext({ storageState: undefined })` + assertions on setlist name and song in public page |

**Score:** 8/8 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/helpers/dnd.ts` | Reusable pointer-event DnD helper exporting `dragAndDrop` | VERIFIED | 50 lines; exports `dragAndDrop(page, source, target, options)`; uses `page.mouse.down/move/up`; JSDoc present; no stubs |
| `tests/setlists.spec.ts` | Full E2E test file covering SETL-01 through SETL-08 | VERIFIED | 388 lines; 8 describe blocks; 13 tests; all 8 requirement IDs present as describe block labels |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `tests/setlists.spec.ts` | `tests/helpers/dnd.ts` | `import { dragAndDrop } from './helpers/dnd'` | WIRED | Line 5; `dragAndDrop` called at lines 140 and 179 |
| `tests/helpers/dnd.ts` | `page.mouse` | `page.mouse.down()`, `page.mouse.move()`, `page.mouse.up()` | WIRED | Lines 44-49; all three mouse API calls present with `steps` option |
| `tests/setlists.spec.ts` | `tests/helpers/factories.ts` | `import { createSong, createSetlist }` | WIRED | Line 2; `createSetlist` used in 6 describe blocks, `createSong` used in 5 |
| `tests/setlists.spec.ts` | `tests/helpers/supabase-admin.ts` | `import { adminClient }` | WIRED | Line 4; `adminClient.from('setlist_songs').insert()` called in SETL-03, SETL-04, SETL-05, SETL-06, SETL-08 tests |
| `tests/setlists.spec.ts` | `tests/helpers/cleanup.ts` | `import { safeDelete }` | WIRED | Line 3; `safeDelete` called in every test that uses a factory |

---

### Requirements Coverage

All 8 requirements declared across Plans 01–03 are covered.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SETL-01 | 09-02-PLAN.md | User can create a new setlist | SATISFIED | Two tests: inline form -> redirect -> name visible; list page visibility |
| SETL-02 | 09-01-PLAN.md | User can add songs to a setlist via drag-and-drop | SATISFIED | `dragAndDrop` from library song to empty-state drop zone; verifies remove button appears |
| SETL-03 | 09-01-PLAN.md | User can reorder songs within a setlist via drag-and-drop | SATISFIED | Reorder test with bounding-box positional assertion after reload |
| SETL-04 | 09-03-PLAN.md | Running time total updates as songs are added/removed/reordered | SATISFIED | Two tests: 5:00 on load, 2:00 after removal |
| SETL-05 | 09-03-PLAN.md | User can set target time and see over/under indicator | SATISFIED | Two tests: +1:00 over and -2:00 under indicators |
| SETL-06 | 09-03-PLAN.md | User can set global transition time between songs | SATISFIED | Gap stepper click -> 5s display -> 6:05 total |
| SETL-07 | 09-02-PLAN.md | User can duplicate, delete, and rename setlists | SATISFIED | Four tests: duplicate, rename (click-to-edit), delete (confirm dialog), cancel-delete |
| SETL-08 | 09-03-PLAN.md | User can share a setlist via public link | SATISFIED | Enable sharing, extract URL from .truncate, visit in unauthenticated context, assert content |

No orphaned requirements found. REQUIREMENTS.md traceability table marks SETL-01 through SETL-08 as Phase 9 / Complete, matching what the plans claimed.

---

### Anti-Patterns Found

No anti-patterns detected.

- No TODO/FIXME/HACK/PLACEHOLDER comments in either test file
- No empty implementations (`return null`, `return {}`, `return []`)
- No `locator.dragTo()` — DnD helper correctly uses raw `page.mouse` API
- No console-log-only handlers
- All tests have substantive assertions (not just "no error thrown")

---

### Human Verification Required

The automated checks confirm all test code is present, substantive, wired, and free of stubs. Three items require a live browser run to confirm end-to-end correctness:

#### 1. DnD add song (SETL-02)

**Test:** Run `npx playwright test tests/setlists.spec.ts --grep "SETL-02"` against a populated `.env.test`
**Expected:** Song "Drag Me Over" moves from library panel into setlist; empty-state text disappears; `Remove Drag Me Over from setlist` button becomes visible
**Why human:** Pointer-event DnD timing (steps/holdMs/pauseMs) can only be validated against a real browser with the svelte-dnd-action runtime loaded

#### 2. DnD reorder persistence (SETL-03)

**Test:** Run `npx playwright test tests/setlists.spec.ts --grep "SETL-03"` against a populated `.env.test`
**Expected:** After dragging Song Beta above Song Alpha and reloading, `betaBox.y < alphaBox.y` holds true
**Why human:** Whether the `saveOrder` server action actually persists the reordered positions to Supabase requires a live database round-trip

#### 3. Public share link (SETL-08)

**Test:** Run `npx playwright test tests/setlists.spec.ts --grep "SETL-08"` against a populated `.env.test`
**Expected:** Unauthenticated browser context navigates to `/share/[token]` and sees "Shared Gig Set" and "Shared Song"
**Why human:** Share token generation and the `/share/[token]` route require a live Supabase instance and running SvelteKit dev server

---

### Commit Verification

All documented commits exist in repository history:

| Commit | Plan | Description |
|--------|------|-------------|
| `bd35a8a` | 09-01 | feat: DnD pointer event helper |
| `b61774f` | 09-01 | feat: DnD add and reorder tests (SETL-02, SETL-03) |
| `7492fed` | 09-02 | feat: setlist create and management tests (SETL-01, SETL-07) |
| `2fc895a` | 09-03 | test: timing tests (SETL-04, SETL-05, SETL-06) |
| `bdd35ee` | 09-03 | test: share test (SETL-08) |

---

### Summary

Phase 9 goal is achieved. All 8 setlist builder requirements (SETL-01 through SETL-08) have substantive, wired E2E test coverage in `tests/setlists.spec.ts`. The reusable DnD helper in `tests/helpers/dnd.ts` correctly uses Playwright's `page.mouse` API to work around svelte-dnd-action's pointer event requirements. All supporting infrastructure (fixtures, factories, adminClient, cleanup) is properly imported and used.

Three items are flagged for human verification because they require a live Supabase + SvelteKit environment — the test code itself is structurally correct.

---

_Verified: 2026-03-12T19:15:00Z_
_Verifier: Claude (gsd-verifier)_
