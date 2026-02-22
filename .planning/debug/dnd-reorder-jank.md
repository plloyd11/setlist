---
status: diagnosed
trigger: "Investigate a drag-and-drop reorder bug in the setlist builder. Symptom: Reordering songs within the setlist via drag-and-drop is janky, crashed the page once, and duplicated a song."
created: 2026-02-20T00:00:00Z
updated: 2026-02-20T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: The unguarded $effect on line 64 unconditionally overwrites setlistItems whenever data changes, which invalidateAll() triggers mid-drag or immediately after finalize — fighting svelte-dnd-action's optimistic item state
test: trace the full lifecycle of a reorder drag: consider -> finalize -> persistOrder -> invalidateAll -> $effect
expecting: confirm that $effect fires while DnD still owns the item array, and that the existingSetlistSongIds check in handleSetlistFinalize can also produce false positives when saveOrder deletes+reinserts rows with new IDs
next_action: write up full root cause analysis

## Symptoms

expected: Dragging a song within the setlist reorders it smoothly and persists the new order
actual: Drag-and-drop is "janky", crashed the page once, and duplicated a song
errors: no specific error messages reported (page crash observed once)
reproduction: drag a song within the setlist builder to reorder it
started: unknown - investigating

## Eliminated

## Evidence

- timestamp: 2026-02-20T00:05:00Z
  checked: +page.svelte lines 60-72 — both $effect blocks
  found: Both effects are completely unconditional. They run whenever `data` (a reactive prop) changes. They overwrite the entire libraryItems and setlistItems arrays.
  implication: Any call to invalidateAll() causes these effects to fire and reset both arrays to the server state, regardless of what DnD currently holds.

- timestamp: 2026-02-20T00:05:00Z
  checked: +page.svelte lines 117-135 — persistOrder function
  found: persistOrder fires immediately after handleSetlistFinalize sets setlistItems (line 113). It awaits the fetch then calls invalidateAll() at line 130. The await means invalidateAll fires asynchronously — but the DnD library may still be in a "drag in progress" or post-finalize animation state when data refreshes and $effect overwrites setlistItems.
  implication: The $effect reset races with the DnD flip animation (200ms). If the $effect fires during the animation, svelte-dnd-action still holds internal state referencing the pre-effect item array, causing a visual glitch or internal inconsistency.

- timestamp: 2026-02-20T00:05:00Z
  checked: +page.svelte lines 89-114 — handleSetlistFinalize
  found: existingSetlistSongIds (line 93-95) is built from data.setlistSongs, which is the STALE server snapshot. After saveOrder runs on the server (lines 98-112 of server file), the server DELETES ALL existing rows and REINSERTS them with brand new auto-generated IDs. So the IDs that were in data.setlistSongs no longer exist in the DB after the save.
  implication: When invalidateAll() completes and $effect fires at line 64-72, it reassigns setlistItems using the newly-loaded data.setlistSongs — which has new row IDs. On the NEXT drag, handleSetlistFinalize builds existingSetlistSongIds from data.setlistSongs (the now-fresh data). This part recovers correctly. But see the next finding for a more dangerous case.

- timestamp: 2026-02-20T00:05:00Z
  checked: +page.svelte lines 89-114 — new-item detection during a pure reorder
  found: When the user reorders (no new songs added), all items in e.detail.items have IDs that came from setlistItems (which was seeded from data.setlistSongs). existingSetlistSongIds is also built from data.setlistSongs. So for a pure reorder they should match — UNLESS data.setlistSongs has gone stale from a previous invalidateAll cycle that already replaced the IDs with new ones, and the $effect has NOT yet run to update setlistItems. In that timing window, setlistItems still holds old IDs that no longer exist in data.setlistSongs, so existingSetlistSongIds.has(item.id) returns FALSE for every item, misidentifying every song as "new from library."
  implication: Every song gets treated as a new library drop, gets crypto.randomUUID() assigned (lines 102), and persistOrder fires AGAIN. The server then does another delete-all + re-insert. The user sees duplicates or a scrambled list because setlistItems is now full of freshly invented UUIDs that diverge from DB reality, and the next $effect reset lands on a completely different set of rows.

- timestamp: 2026-02-20T00:05:00Z
  checked: +page.svelte line 97-110 — SHADOW_ITEM_MARKER guard
  found: The condition at line 98 checks both !existingSetlistSongIds.has(item.id) AND !item[SHADOW_ITEM_MARKER_PROPERTY_NAME]. The shadow-item guard correctly prevents the placeholder ghost from being processed. But the first part of the AND is the problem: if data.setlistSongs has already been updated by invalidateAll (new IDs in DB) but $effect hasn't yet fired to update setlistItems (old IDs still in state), then ALL items pass the !existingSetlistSongIds.has(item.id) test and all get re-created.
  implication: This is the specific mechanism that causes the "duplicate song" symptom. The item appears twice because the locally generated UUID persists briefly, then $effect resets the list to the server state (which also includes the newly saved row), so the same song appears both in the optimistically-mutated state and in the server-synced state simultaneously.

- timestamp: 2026-02-20T00:05:00Z
  checked: +page.svelte lines 85-87 — handleSetlistConsider
  found: Consider events fire on every pointer move during drag. setlistItems is overwritten on every move. The $effect does NOT know the user is mid-drag; it will fire and overwrite setlistItems if invalidateAll() happens to complete (from a concurrent action, e.g., tab switch, or from a previous persistOrder call that overlapped with a new drag starting).
  implication: This is the mechanism for "janky" — if invalidateAll from a prior drag completes during a new drag's consider phase, the $effect fires, snapping the list back to server order mid-drag, causing the visual jump.

- timestamp: 2026-02-20T00:05:00Z
  checked: +page.server.ts lines 98-112 — saveOrder action
  found: The action does a hard DELETE of all rows then re-inserts. This is a destructive write pattern. It does not do an upsert or update in place. Combined with the fact that invalidateAll() refetches those new rows with new IDs, the ID instability cascades back into the client.
  implication: Every successful drag produces a new set of setlist_songs IDs. The client's setlistItems and data.setlistSongs drift out of sync with every cycle, compounding the race condition on subsequent drags.

## Resolution

root_cause: Three interlocking bugs produce the symptoms. (1) Lines 64-72: the $effect that syncs setlistItems is completely unconditional — it fires on ANY data change including the invalidateAll() triggered by the just-completed drag, which allows it to race with svelte-dnd-action's post-finalize flip animation and reset the item array while DnD still owns it, causing jank. (2) Lines 93-95 + 98: existingSetlistSongIds is built from the STALE data.setlistSongs prop; because saveOrder deletes-and-reinserts all rows with new IDs (server line 99), there is a window where setlistItems holds old IDs and data.setlistSongs holds new IDs — making every item appear "new from library", so every song gets a fresh crypto.randomUUID() and a second persistOrder call fires, doubling the songs and risking a page crash from a runaway save loop. (3) The delete-all + re-insert strategy in saveOrder (server lines 99-109) is the root enabler: it guarantees ID churn on every save, making the client's ID-based detection permanently unreliable after the first successful drag.
fix:
verification:
files_changed: []
