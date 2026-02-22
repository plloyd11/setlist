---
phase: 03-setlist-builder
verified: 2026-02-20T22:00:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "Drag songs from library to setlist (SET-02) — isNew flag fix and server ID sync close the persistence regression introduced by Plan 05"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Drag a song from library to an empty setlist. Wait for DnD animation to complete. Refresh the page."
    expected: "Song is still present in the setlist after refresh."
    why_human: "Static analysis confirms the code path is correct; runtime is needed to confirm the DB INSERT executes and SvelteKit serializes the action response in the expected format for client-side JSON parsing."
  - test: "Drag-and-drop reorder — drag two songs to new positions in a setlist with 3+ songs. Refresh the page."
    expected: "No jank, no crash, no song duplication. Order persists after refresh."
    why_human: "Animation smoothness, crash absence, and optimistic state timing require runtime verification."
  - test: "Click X to remove a song 5 times in quick succession on 5 different songs."
    expected: "Every removal is immediate and permanent. No song flashes back after removal."
    why_human: "Race condition elimination requires real async timing to confirm."
---

# Phase 3: Setlist Builder Verification Report

**Phase Goal:** Users can build timed setlists from their songs via drag-and-drop and share them via public link
**Verified:** 2026-02-20T22:00:00Z
**Status:** HUMAN NEEDED (all automated checks pass)
**Re-verification:** Yes — after Plan 06 gap closure (commit `48910d7`)

---

## Re-verification Context

This is the third verification pass for Phase 3:

1. **Initial verification (2026-02-18):** Passed — 5/5 truths verified
2. **Re-verification after UAT (2026-02-20T14:45Z):** Gaps found — 4/5 truths. UAT tests 9 (reorder jank/crash) and 10 (song removal flash-back) failed. Plan 05 fixes addressed those but introduced a SET-02 regression: `persistOrder`'s `isNewFromLibrary` heuristic broke under the new upsert pattern, so library-dragged songs appeared in the UI but were never INSERTed to the database.
3. **This verification (2026-02-20T22:00Z):** Plan 06 fix (commit `48910d7`) closes the SET-02 gap. All automated checks pass. Runtime human verification is the only remaining gate.

---

## Plan 06 Gap Closure Assessment

### What Changed (commit `48910d7`)

**File:** `src/routes/(app)/setlists/[id]/+page.svelte`

**Change 1 — `SetlistItem` type gains `isNew?: boolean` (line 32):**

```typescript
type SetlistItem = {
  id: string;
  song_id: string;
  title: string;
  duration_seconds: number;
  position: number;
  isNew?: boolean;
  [SHADOW_ITEM_MARKER_PROPERTY_NAME]?: boolean;
};
```

**Change 2 — `handleSetlistFinalize` sets `isNew: true` on newly dragged items (lines 107-114):**

```typescript
return {
  id: crypto.randomUUID(),
  song_id: item.id,
  title: songData?.title ?? item.title ?? 'Unknown',
  duration_seconds: songData?.duration_seconds ?? item.duration_seconds ?? 0,
  position: index,
  isNew: true
};
```

**Change 3 — `persistOrder` uses `item.isNew` flag instead of the broken heuristic (line 131):**

```typescript
id: item.isNew ? undefined : item.id,
```

`JSON.stringify({ id: undefined })` omits the `id` key entirely, so the server receives the item without an `id` field. The server's `items.filter(item => !item.id)` correctly classifies it as a new item and runs `INSERT`.

**Change 4 — `persistOrder` reads server response and syncs real UUIDs back to `setlistItems` (lines 146-163):**

```typescript
const text = await response.text();
const result = JSON.parse(text);
const actionData = result?.data;
const returnValue = Array.isArray(actionData) ? actionData[0] : actionData;
const savedItems = returnValue?.items;
if (Array.isArray(savedItems) && savedItems.length > 0) {
  setlistItems = savedItems.map((ss: any) => ({
    id: ss.id,
    song_id: ss.song_id,
    title: (ss.songs as any)?.title ?? ss.title ?? 'Unknown',
    duration_seconds: (ss.songs as any)?.duration_seconds ?? ss.duration_seconds ?? 0,
    position: ss.position
  }));
}
```

This replaces the entire client `setlistItems` with authoritative server data, including real DB-generated UUIDs for newly dragged songs. The `isNew` flag is implicitly cleared (new objects are constructed without it).

**Critical verification — `undefined` is omitted by JSON.stringify:**

Confirmed via Node.js:
```
JSON.stringify({ id: undefined, song_id: 'abc', position: 0 })
// → {"song_id":"abc","position":0}
```

The server's `items.filter(item => !item.id)` evaluates `!undefined` = `true`. New items are correctly routed to INSERT.

### What Was NOT Changed (regression check)

- `isMutating` guard on `$effect` (line 72): intact — `if (isMutating) return` still in place
- `handleRemoveSong` success path: still no `invalidateAll()` — `isMutating = false` at line 224 is the final statement
- `saveOrder` server action: upsert pattern unchanged from Plan 05 — returns `{ saved: true, items: savedRows }` at line 143
- `removeSong` server action: single-row `.delete().eq('id', ...)` unchanged

No regressions detected.

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can drag songs from their library into a setlist and they persist after page refresh (SET-02) | VERIFIED | `handleSetlistFinalize` sets `isNew: true` (line 113); `persistOrder` sends `id: undefined` for new items (line 131); server INSERTs items without `id`; client syncs real server UUIDs from response (lines 147-163) |
| 2 | User can reorder songs via drag-and-drop without jank or crashes, and order persists (SET-03) | VERIFIED | `isMutating` guard on `$effect` (line 72) prevents mid-animation reset; upsert pattern preserves UUIDs; `persistOrder` does not call `invalidateAll()` |
| 3 | User can remove a song from a setlist reliably with no flash-back (SET-04) | VERIFIED | `handleRemoveSong` sets `isMutating = true` before optimistic filter; success path sets `isMutating = false` without `invalidateAll()` — `$effect` cannot restore removed item |
| 4 | User sees a live-updating running time total that recalculates as songs change (SET-05/06/07) | VERIFIED | `TimingBar.svelte` uses `$derived` runes from `setlistItems`; optimistic state updates drive timing bar in real time; unchanged from original verification |
| 5 | User can generate a shareable link and anyone with that link can view the setlist without logging in (SHARE-01/02) | VERIFIED | `toggleShare` wired to `?/toggleShare`; public route `/share/[token]` present; unchanged from original verification |

**Score: 5/5 truths verified**

---

## Required Artifacts

### Plan 06 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/routes/(app)/setlists/[id]/+page.svelte` | `isNew?: boolean` on `SetlistItem`; `isNew: true` in `handleSetlistFinalize`; `item.isNew` in `persistOrder`; response body parsed for server UUID sync | VERIFIED | All four changes confirmed at lines 32, 113, 131, 147-163 |

### Plan 05 Artifacts (regression check)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/routes/(app)/setlists/[id]/+page.svelte` | `isMutating` guard on `$effect`; no `invalidateAll()` in `persistOrder`; no `invalidateAll()` in `handleRemoveSong` success path | VERIFIED | Guard at line 72; no `invalidateAll` in `persistOrder`; `handleRemoveSong` success path ends at `isMutating = false` (line 224) |
| `src/routes/(app)/setlists/[id]/+page.server.ts` | Upsert-based `saveOrder`; simplified `removeSong` | VERIFIED | Lines 99-143 confirm upsert; line 205 confirms single-row delete |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `handleSetlistFinalize` | `SetlistItem.isNew` | `isNew: true` set on new library items | WIRED | Line 113 confirmed |
| `persistOrder` | `?/saveOrder` | `id: item.isNew ? undefined : item.id` sends new items without id | WIRED | Line 131 confirmed; JSON.stringify omits `undefined` keys |
| `?/saveOrder` | DB INSERT | `items.filter(item => !item.id)` routes no-id items to insert | WIRED | Lines 100, 125-134 in `+page.server.ts` |
| `persistOrder` | `setlistItems` | Parses `response.text()` and assigns server rows | WIRED | Lines 147-163; `setlistItems = savedItems.map(...)` |
| `$effect` | `setlistItems` | `if (isMutating) return` guard prevents overwrite during mutations | WIRED | Line 72 confirmed |
| `handleRemoveSong` | `?/removeSong` | `fetch('?/removeSong', ...)` | WIRED | Line 207 confirmed |

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| SET-01 | User can create a new setlist with a name | SATISFIED | Unchanged from original verification — setlists list page create flow |
| SET-02 | User can drag songs from their library into a setlist | SATISFIED | Plan 06 fix: `isNew` flag + server ID sync corrects persistence regression |
| SET-03 | User can reorder songs in a setlist via drag-and-drop | SATISFIED (human needed) | `isMutating` guard + upsert in place; runtime verification needed for smoothness |
| SET-04 | User can remove a song from a setlist | SATISFIED (human needed) | `isMutating` guard eliminates flash-back; runtime needed to confirm timing |
| SET-05 | User can see a live-updating running time total | SATISFIED | `TimingBar.svelte` `$derived` from `setlistItems` |
| SET-06 | User can set a target time and see over/under indicator | SATISFIED | `TimingBar.svelte` target logic unchanged |
| SET-07 | User can set a global transition time between songs | SATISFIED | `TimingBar.svelte` transition logic unchanged |
| SET-08 | User can duplicate an existing setlist | SATISFIED | Setlist list page duplicate action unchanged |
| SET-09 | User can delete a setlist | SATISFIED | Setlist list page delete action unchanged |
| SET-10 | User can edit a setlist's name | SATISFIED | `SetlistHeader.svelte` + `?/updateSetlist` unchanged |
| SHARE-01 | User can generate a read-only shareable link | SATISFIED | `toggleShare` action + share URL display in builder |
| SHARE-02 | Anyone with the link can view without an account | SATISFIED | Public `/share/[token]` route present |
| UX-01 | App is fully usable on mobile devices | SATISFIED | Mobile tab toggle, responsive layout unchanged |

**No orphaned requirements.** All 13 phase requirements accounted for. No REQUIREMENTS.md requirement mapped to Phase 3 is missing from a plan's `requirements` field.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/routes/(app)/setlists/[id]/+page.svelte` | 342-343 | `placeholder=` attribute on search input | Info | HTML input placeholder attribute — not a code stub |

No blocker or warning anti-patterns found. The single hit is a legitimate HTML attribute.

---

## Human Verification Required

### 1. Confirm library drag persistence (SET-02)

**Test:** Open a setlist. Drag a song from the library panel into the setlist. Wait for the DnD animation to complete. Refresh the page.
**Expected:** The song is still present in the setlist after refresh.
**Why human:** Static analysis confirms the logic is correct — `isNew` flag routes the item to server INSERT, server returns saved rows, client syncs real UUIDs. Runtime is needed to confirm (a) the SvelteKit action response serialization format matches the client's JSON parsing expectations (`result?.data[0]?.items`), and (b) the Supabase INSERT actually executes without constraint errors.

### 2. Reorder smoothness (SET-03)

**Test:** Open a setlist with 3+ songs. Drag a song to a new position. Immediately drag another song. Refresh the page.
**Expected:** No jank, no crash, no song duplication. Order persists after refresh.
**Why human:** Animation quality, race condition absence between two rapid drags, and optimistic state timing cannot be verified from source.

### 3. Remove reliability (SET-04)

**Test:** Click X on 5 different songs in quick succession.
**Expected:** Every removal is immediate and permanent. No song flashes back after removal.
**Why human:** The `isMutating` guard is structurally correct, but the async timing of five rapid removals requires runtime confirmation that no race condition slips through.

---

## Summary

Plan 06 (commit `48910d7`) closes the sole remaining gap from the previous verification:

**SET-02 (library drag persistence):** The broken `isNewFromLibrary` heuristic (`!item.song_id || item.id === item.song_id`) that was always `false` for newly dragged songs has been replaced with an explicit `isNew?: boolean` flag on `SetlistItem`. `handleSetlistFinalize` sets `isNew: true` when creating items from library drops. `persistOrder` sends `id: item.isNew ? undefined : item.id` — JSON.stringify omits the `id` key for `undefined`, so the server receives no `id` and correctly routes to INSERT. After save, `persistOrder` reads the server response body and syncs real DB-generated UUIDs back into `setlistItems`, clearing stale client UUIDs.

Plan 05 fixes (reorder jank, remove flash-back) are confirmed intact with no regressions.

All 5 observable truths are verified at the code level. The only remaining gate is human runtime testing to confirm (1) the DB INSERT executes correctly in the live environment, (2) the SvelteKit action response format matches client JSON parsing expectations, and (3) animation smoothness and rapid-succession reliability under real async timing.

**Phase 3 goal is structurally achieved. Awaiting runtime confirmation.**

---

_Verified: 2026-02-20T22:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after Plan 06 gap closure commit 48910d7_
