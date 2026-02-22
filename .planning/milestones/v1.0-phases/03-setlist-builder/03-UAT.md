---
status: diagnosed
phase: 03-setlist-builder
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md]
started: 2026-02-19T02:05:00Z
updated: 2026-02-20T02:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Setlist list page with empty state
expected: Navigate to /setlists. With no setlists yet, see empty state message with CTA. "New Setlist" button visible in header.
result: pass

### 2. Create a new setlist
expected: Click "New Setlist", enter a name in the inline form, submit. You should be redirected to the builder page at /setlists/[id].
result: pass

### 3. Setlist card display
expected: Navigate back to /setlists. Your new setlist appears as a card showing the name, song count (0 songs), and total time (0:00). Responsive grid layout (1 col mobile, 2 tablet, 3 desktop).
result: pass

### 4. Inline name editing on card
expected: On the setlist card, click the setlist name text. It becomes an editable input. Change the name, press Enter or click away. The name updates and persists on refresh.
result: pass

### 5. Duplicate a setlist
expected: Click the three-dot menu on a setlist card. Select "Duplicate". A copy appears with "(Copy)" appended to the name.
result: pass

### 6. Delete a setlist
expected: Click the three-dot menu on a setlist card. Select "Delete". A confirmation dialog appears. Confirm deletion. The setlist disappears from the list.
result: pass

### 7. Builder two-panel layout
expected: Open a setlist (click the card). See a two-panel layout: song library on the left with a search input, setlist on the right with an empty state message. On mobile, see tab toggle between "Library" and "Setlist".
result: pass

### 8. Drag songs from library to setlist
expected: Drag a song from the library panel into the setlist panel. The song appears in the setlist. The library still shows the song (copy-on-drag). The song persists in the setlist on refresh.
result: pass

### 9. Reorder songs via drag-and-drop
expected: With multiple songs in the setlist, drag a song to a new position using the grip handle. Songs reorder smoothly with animation. New order persists on refresh.
result: issue
reported: "the setlist reorder is pretty janky, and it crashed the page once and then duplicated a song for some reason"
severity: major

### 10. Remove a song from setlist
expected: Click the X/remove button on a song in the setlist. The song disappears. Total time decreases accordingly.
result: issue
reported: "fail, sometimes the song isnt removed"
severity: major

### 11. Live timing total and target
expected: As songs are in the setlist, the sticky timing bar at the bottom shows the total time (sum of song durations). Enter a target time in mm:ss format. See an over/under indicator: green with minus sign if under target, red with plus sign if over. A progress bar fills accordingly (amber under target, red when over).
result: pass

### 12. Transition time stepper
expected: In the timing bar, adjust the transition/gap time using the +/- stepper. The total time updates to include (N-1) * gap seconds between songs. Change is reflected immediately.
result: pass

### 13. Share toggle and link
expected: In the builder, find and toggle sharing ON. A share URL appears. Click "Copy" to copy to clipboard. The URL should be something like /share/[uuid].
result: pass

### 14. Public shared view
expected: Open the share URL in an incognito/private window (no login). See a clean performance view: logo (if set), display name, setlist name, date, venue, and a numbered list of song titles only (NO durations). No app navigation visible.
result: pass

### 15. Settings page with logo and display name
expected: Navigate to /settings. See a profile section with display name input and logo upload area. Enter a display name and save. Upload a logo image (under 2MB). See the logo preview appear.
result: pass

## Summary

total: 15
passed: 13
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Songs reorder smoothly via drag-and-drop with animation, new order persists on refresh"
  status: failed
  reason: "User reported: the setlist reorder is pretty janky, and it crashed the page once and then duplicated a song for some reason"
  severity: major
  test: 9
  root_cause: "Three interlocking bugs: (1) Unguarded $effect on lines 64-72 resets setlistItems mid-DnD animation when invalidateAll() completes, causing jank. (2) existingSetlistSongIds built from stale data.setlistSongs causes reordered items to be misidentified as new library drops, duplicating songs. (3) saveOrder's delete-all + re-insert pattern generates new IDs every save, making client ID-based detection permanently unreliable."
  artifacts:
    - path: "src/routes/(app)/setlists/[id]/+page.svelte"
      issue: "Unguarded $effect overwrites DnD state; stale ID detection in handleSetlistFinalize"
    - path: "src/routes/(app)/setlists/[id]/+page.server.ts"
      issue: "saveOrder delete-all + re-insert causes ID churn"
  missing:
    - "Add isDragging guard to $effect so it doesn't fire during DnD operations"
    - "Skip invalidateAll() after persist — trust optimistic state or debounce"
    - "Use song_id (stable) instead of setlist_songs.id for new-item detection"
  debug_session: ".planning/debug/dnd-reorder-jank.md"
- truth: "Clicking the remove button on a song removes it from the setlist reliably"
  status: failed
  reason: "User reported: fail, sometimes the song isnt removed"
  severity: major
  test: 10
  root_cause: "Same unguarded $effect (lines 64-72) overwrites the optimistic removal. When data prop changes during the async window between optimistic filter and server confirmation, $effect fires and restores the removed song from stale data.setlistSongs. Song flashes back until removeSong's invalidateAll() completes."
  artifacts:
    - path: "src/routes/(app)/setlists/[id]/+page.svelte"
      issue: "Unguarded $effect clobbers optimistic state during async operations"
  missing:
    - "Guard $effect with a flag that prevents overwrite during pending mutations"
  debug_session: ".planning/debug/setlist-remove-song-race.md"
