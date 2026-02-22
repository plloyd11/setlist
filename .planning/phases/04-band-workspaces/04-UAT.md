---
status: complete
phase: 04-band-workspaces
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md, 04-05-SUMMARY.md]
started: 2026-02-22T03:00:00Z
completed: 2026-02-22T06:00:00Z
---

## Tests

### 1. Bands navigation visible
expected: Sidebar shows 5 nav items in order: Home, Songs, Setlists, Bands, Settings. Bands uses a group/people icon. Bottom nav on mobile also shows Bands between Setlists and Settings.
result: pass

### 2. Bands page empty state
expected: Navigating to /bands shows an empty state with a message like "Create your first band" and a way to enter a band name and create one.
result: pass

### 3. Create a band
expected: Enter a band name and submit. You are redirected to the new band's dashboard at /bands/[id]. The dashboard shows the band name in a header, 4 sub-navigation tabs (Dashboard, Songs, Setlists, Members), and stats showing 1 member.
result: pass
notes: Fixed RLS chicken-and-egg (owner SELECT policy), ANY() syntax, anon policy ordering, use:enhance error swallowing

### 4. Band card on list page
expected: Navigate back to /bands. The band you just created appears as a card showing the band name and member count. Clicking the card navigates to the band dashboard.
result: pass

### 5. Band sub-navigation tabs
expected: Inside a band, the tab bar shows Dashboard, Songs, Setlists, Members. Clicking each tab navigates to the correct URL and highlights the active tab with an amber accent. Dashboard tab is active by default.
result: pass

### 6. Band songs empty state and add new song
expected: Click the Songs tab. Empty state shows. Click "Add New Song" -- an inline form appears for title, duration (mm:ss), and notes. Submit a new song. It appears in the band song list.
result: pass
notes: Fixed .order('created_at') -> .order('added_at') in band songs load query

### 7. Share personal song to band
expected: On the band songs page, click "Share from Library". A picker panel opens showing your personal songs. Songs already in the band are excluded. Click "Share" on a song -- it appears in the band song list.
result: pass

### 8. Edit and remove band song
expected: Click a song title in the band list to edit it inline. Change the title and save. The update persists. Click remove on a song -- it disappears from the band but is still in your personal library.
result: pass

### 9. Members page and invite link generation
expected: Click the Members tab. You appear as the owner with an "Owner" role badge. Click "Generate Invite Link". A copyable URL appears with an expiry notice (7 days). Copy the URL.
result: pass

### 10. Accept invite link
expected: Open the invite URL in incognito with a different Google account. The page shows the band name and a "Join Band" button. Click Join. You are redirected to the band dashboard as a member.
result: pass
notes: Fixed auth redirect passthrough (hooks.server.ts, auth page, callback). Added RLS policies for invite holders to view band and self-join.

### 11. Member removal and leave band
expected: As the band owner, go to Members. The new member appears with a "Member" badge. A "Remove" button is available. As the non-owner member, a "Leave Band" option is visible.
result: pass

### 12. Band setlists empty state and create
expected: Click the Setlists tab inside a band. Empty state shows. Create a new setlist. You are redirected to the band setlist builder.
result: pass

### 13. Band setlist builder loads band songs
expected: The builder's library panel shows songs from the band library (not your personal library). Band songs appear; personal-only songs do not.
result: pass

### 14. Band builder DnD and timing
expected: Drag a song from the library panel into the setlist. Reorder songs via drag-and-drop. The timing bar updates in real-time. Set a target time and see the over/under indicator.
result: pass
notes: Fixed unique(setlist_id, position) constraint violation by switching to delete+re-insert pattern in both band and personal builders.

### 15. Share band setlist publicly
expected: Toggle sharing on for a band setlist. Open the share link in incognito. The shared view shows the band name and band logo at the top, along with the setlist songs and timing.
result: pass

## Summary

total: 15
passed: 15
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
