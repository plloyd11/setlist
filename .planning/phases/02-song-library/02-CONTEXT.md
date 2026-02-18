# Phase 2: Song Library - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can build and manage a personal library of songs with durations. Includes song CRUD (create, read, update, delete), search/filter by title, and a mobile-responsive list. Setlist integration, drag-and-drop, and sharing are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Song list layout
- Simple list with details — one song per row, secondary line for metadata
- Each row shows: title, duration (mm:ss)
- Secondary line shows notes field — only displayed when populated (variable row heights)
- Default sort: alphabetical by title
- Sort toggle available — users can switch between alphabetical, duration, and date added
- Context menu (right-click / long-press) for edit and delete actions — no visible action buttons on rows
- Song count displayed in the library header (e.g., "42 songs")

### Add song experience
- Separate page with a dedicated form for adding new songs
- Single text field for duration input (mm:ss format)
- Required fields: title and duration
- Notes field: optional
- After saving, stay on the form (cleared) so users can quickly add multiple songs in a row
- Toast notification on successful save ("Song added")
- Add button lives in the page header/toolbar alongside search icon

### Edit song experience
- Inline editing directly in the list row — no navigation required
- Same fields as add: title, duration, notes

### Delete behavior
- Confirmation dialog before deletion
- If song is used in setlists: warn which setlists use it, but allow deletion anyway

### Search & filter
- Instant filter as you type — list filters in real-time, no submit button
- Search bar is collapsible — hidden behind a search icon, expands when tapped
- Search matches title only (not notes)
- Duration filter available — filter by duration range (e.g., under 3 min, 3-5 min, over 5 min)

### Empty & loading states
- Empty library: friendly CTA with prominent "Add your first song" button
- No search results: "No songs match" message with suggestion to clear search
- Post-add flow returns to cleared form for batch entry

### Claude's Discretion
- Loading skeleton design
- Exact duration filter ranges/UI
- Inline edit interaction pattern (click-to-edit, edit icon, etc.)
- Error state handling
- Exact spacing, typography, animations

</decisions>

<specifics>
## Specific Ideas

- Duration as mm:ss in a single field — musicians think in minutes:seconds
- Stay-on-form after adding supports the common workflow of entering a whole setlist of songs at once
- Context menu keeps rows clean — musicians scanning a long song list don't need visual clutter

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-song-library*
*Context gathered: 2026-02-17*
