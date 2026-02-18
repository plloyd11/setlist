# Phase 3: Setlist Builder - Context

**Gathered:** 2026-02-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can build timed setlists from their songs via drag-and-drop and share them via public link. Includes setlist CRUD, drag-and-drop song ordering, live timing with target tracking, per-setlist gig details (date/venue), and toggleable public sharing. Band workspaces and multi-set support are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Builder layout & interaction
- Two-panel side-by-side on desktop: song library panel on left, setlist panel on right
- Drag songs from library panel into specific positions in the setlist (cross-panel drag)
- Drag handle on each setlist row with smooth animated reordering
- Mobile: tab/toggle switch between "Library" and "Setlist" views (tap song in library to add)
- Setlist header section: band logo at top, date and venue name below logo, above song listings
- Logo is set at user/band level (not per-setlist) — applied to all setlists automatically

### Timing display & targets
- Sticky header/footer bar always visible showing total time, target time, and over/under
- Progress bar visual for over/under indicator — fills toward target, changes color when over
- Each song row shows only its own duration (no cumulative running time)
- Transition time (global gap between songs) configured via input/stepper in the sticky timing bar

### Setlist management
- "All setlists" view uses card grid layout (name, date, venue, song count, total time per card)
- Quick-create flow: click "New Setlist", enter name, land in builder. Add date/venue/target later.
- Duplicate action available (creates copy with "(Copy)" suffix)
- Single set per setlist (no multi-set support — create separate setlists for Set 1, Set 2)
- Per-setlist fields: name (required), gig date (optional), venue name (optional), target time (optional)

### Public sharing
- Toggle sharing on/off per setlist — generates public link when enabled, revokes when disabled
- Shared view is a clean performance view: logo, band/user name, date, venue, numbered song titles
- No durations or timing details in shared view (backstage info stays private)
- Print-optimized stylesheet for shared view — clean layout, no nav chrome, looks good on paper

### Claude's Discretion
- Exact drag-and-drop library choice and implementation approach
- Loading states, error handling, and empty state designs
- Card grid responsive breakpoints and exact card layout
- Progress bar styling and animation details
- How to handle the logo upload (storage, sizing, format)

</decisions>

<specifics>
## Specific Ideas

- Band logo + date/venue header on the setlist gives it a professional, gig-ready feel — like a real printed setlist
- Shared view deliberately hides timing info — that's backstage planning, not audience-facing
- Print-friendly shared view is important — musicians tape setlists to the stage floor/monitors
- Duplicate setlist is key for gigging bands who play similar sets at different venues

</specifics>

<deferred>
## Deferred Ideas

- Multi-set support (Set 1, Set 2, Encore within one setlist) — potential future enhancement
- Per-setlist logo override — currently using user/band-level logo only

</deferred>

---

*Phase: 03-setlist-builder*
*Context gathered: 2026-02-18*
