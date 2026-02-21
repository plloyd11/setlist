# Phase 4: Band Workspaces - Context

**Gathered:** 2026-02-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Musicians can form bands, share a common song library, and collaborate on setlists. This phase adds multi-user workspaces on top of the existing personal song library and setlist builder. It does NOT include real-time collaboration, version history, or complex role hierarchies.

</domain>

<decisions>
## Implementation Decisions

### Workspace switching
- Bands appear as a separate nav item alongside Songs and Setlists (not a workspace switcher dropdown)
- Users can be in multiple bands simultaneously — each band listed separately in the Bands section
- Clicking into a band shows a band dashboard: band name, members list, recent setlists, song count
- Inside a band, sub-navigation shows band-specific tabs: Songs, Setlists, Members — feels like a distinct workspace

### Song sharing model
- Members can copy songs from their personal library into the band OR add new songs directly to the band
- Songs copied from personal library stay linked (synced) — edits to either copy reflect in both
- Any band member can edit or delete any band song — fully collaborative, no per-song permissions
- When a member leaves the band, their contributed songs stay in the band library — the band owns them

### Invitation & membership
- Band invitations work via shareable invite links (like Discord), not email
- Invite links are one-time use — owner generates a new link per invite
- Creator is the band owner — only owner can invite, remove members, and delete the band
- Members can do everything else (add/edit songs, create/edit setlists)
- Owner can transfer ownership to another member before leaving — band continues under new owner

### Band setlist workflow
- Any band member can create, edit, and delete band setlists — fully collaborative
- Band setlists pull songs from the band library only (not personal libraries)
- Band setlists get the same share toggle and public link as personal setlists — any member can share
- Shared band setlists display band name and logo (if set) in the public view instead of personal profile

### Claude's Discretion
- Database schema design for bands, band_members, band_songs tables
- RLS policy structure for band-scoped access
- How song sync/linking is implemented technically
- Band dashboard layout and component structure
- Sub-navigation implementation approach (tabs, nested routes, etc.)
- Invite link generation and validation mechanism

</decisions>

<specifics>
## Specific Ideas

- Band as a nav item feels natural alongside the existing Songs and Setlists nav — keeps the personal space intact while adding band workspaces
- The linked/synced song model means musicians maintain one source of truth for their songs across personal and band contexts
- One-time invite links keep it simple and give the owner control over who joins
- Band branding on shared setlists makes the public view feel professional for the band

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-band-workspaces*
*Context gathered: 2026-02-21*
