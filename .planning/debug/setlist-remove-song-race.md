---
status: diagnosed
trigger: "Investigate a bug where clicking the remove button on a song in the setlist sometimes doesn't remove it."
created: 2026-02-20T00:00:00Z
updated: 2026-02-20T00:00:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: $effect syncing setlistItems from data.setlistItems runs unconditionally and overwrites optimistic removal state mid-flight
test: reading page.svelte $effect hooks and handleRemoveSong to trace execution order
expecting: $effect has no guard, fires from prior data snapshot after optimistic removal, restores removed song before server confirms deletion
next_action: read all three key files in full

## Symptoms

expected: Clicking X/remove on a song removes it from the setlist immediately and permanently
actual: Sometimes the song isn't removed — may flash back or remain visible
errors: none reported
reproduction: click X on a song in the setlist — intermittent, not always reproducible
started: unknown

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-02-20T00:01:00Z
  checked: SetlistSongRow.svelte line 38
  found: onRemove is called with song.id — but `song.id` here is the SetlistItem.id (the setlist_songs row id), not song_id. This is correct.
  implication: The remove button correctly passes the setlist_songs junction table row ID to handleRemoveSong.

- timestamp: 2026-02-20T00:01:00Z
  checked: +page.svelte lines 157-176 (handleRemoveSong)
  found: Line 159 does optimistic removal: setlistItems = setlistItems.filter(s => s.id !== setlistSongId). Then fetch to ?/removeSong. Then on response.ok, calls await invalidateAll().
  implication: Optimistic state is updated synchronously, then server call is made. invalidateAll() is called after the server confirms success.

- timestamp: 2026-02-20T00:01:00Z
  checked: +page.svelte lines 64-72 ($effect for setlistItems)
  found: The $effect has NO guard condition. It unconditionally overwrites setlistItems from data.setlistSongs on every reactive update to data.setlistSongs.
  implication: CRITICAL. Whenever data.setlistSongs changes (or is re-read by Svelte's reactivity), this $effect will fire and blindly replace setlistItems with whatever is in data — which still contains the removed song until invalidateAll() completes.

- timestamp: 2026-02-20T00:01:00Z
  checked: +page.svelte lines 60-62 ($effect for libraryItems) vs lines 64-72 ($effect for setlistItems)
  found: Both $effects read from `data.*`. In Svelte 5 runes, $effect tracks reactive dependencies. `data` is a prop ($props()). When SvelteKit performs any navigation or data refresh, the `data` prop object reference changes, triggering both effects.
  implication: The $effect for setlistItems will fire whenever data is updated — including during the window between optimistic removal and invalidateAll() completion.

- timestamp: 2026-02-20T00:01:00Z
  checked: +page.svelte lines 124-134 (persistOrder) — also calls invalidateAll() after fetch
  found: persistOrder is called from handleSetlistFinalize (drag-and-drop). It also calls invalidateAll after a successful save.
  implication: If a drag-and-drop completes around the same time as a remove, the invalidateAll from persistOrder triggers a data reload, which fires the $effect and restores the old setlistSongs (with the about-to-be-deleted song) into setlistItems before removeSong has completed server-side.

- timestamp: 2026-02-20T00:01:00Z
  checked: +page.svelte line 64-72 — specifically whether data.setlistSongs is reactive
  found: `data` is from `let { data } = $props()`. In Svelte 5, props are reactive. When SvelteKit updates the data prop (e.g., after invalidateAll from a DIFFERENT action like persistOrder or handleAddSong), the $effect re-runs with the old data snapshot still containing the to-be-deleted song.
  implication: The race window is: optimistic removal (line 159) → $effect fires from ANY data change (possibly caused by another concurrent action) → setlistItems overwritten with stale data → removed song reappears → later, removeSong's invalidateAll fires → $effect fires again with fresh data → song finally gone. This matches the "sometimes" characteristic: only triggers when another data-changing action fires during the async gap.

## Resolution

root_cause: |
  The $effect on lines 64-72 of +page.svelte unconditionally overwrites setlistItems from
  data.setlistSongs whenever the `data` prop changes. Because handleRemoveSong does an optimistic
  removal (line 159) before the server fetch completes, there is an async window during which
  data.setlistSongs still contains the removed song. If the `data` prop is updated during that
  window — either because another concurrent action (persistOrder, addSong, etc.) calls
  invalidateAll(), or because SvelteKit re-runs the load function for any reason — the $effect
  fires and restores the removed song into setlistItems, making it visually reappear. Then when
  removeSong's own invalidateAll() completes (line 170), the $effect fires again with the now-
  correct server data and the song disappears. The user sees: song gone → song flashes back →
  song gone again. In some cases the song may not disappear at all if the initial optimistic
  removal $state update is clobbered before the user notices.

fix: (not applied — diagnose only)
verification: (not applied — diagnose only)
files_changed: []
