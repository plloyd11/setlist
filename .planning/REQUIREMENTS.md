# Requirements: Setlist

**Defined:** 2026-02-17
**Core Value:** Musicians can build a setlist from their songs and instantly see how long the set runs, so they can nail the timing for a show.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication

- [ ] **AUTH-01**: User can sign in with Google OAuth
- [ ] **AUTH-02**: User session persists across browser refresh
- [ ] **AUTH-03**: User can log out from any page

### Song Library

- [ ] **SONG-01**: User can add a song with name and duration
- [ ] **SONG-02**: User can edit a song's name and duration
- [ ] **SONG-03**: User can delete a song from their library
- [ ] **SONG-04**: User can search/filter their song library by title

### Setlist Builder

- [ ] **SET-01**: User can create a new setlist with a name
- [ ] **SET-02**: User can drag songs from their library into a setlist
- [ ] **SET-03**: User can reorder songs in a setlist via drag-and-drop
- [ ] **SET-04**: User can remove a song from a setlist
- [ ] **SET-05**: User can see a live-updating running time total for their setlist
- [ ] **SET-06**: User can set a target time and see over/under indicator
- [ ] **SET-07**: User can set a global transition time between songs that adds to the total
- [ ] **SET-08**: User can duplicate an existing setlist
- [ ] **SET-09**: User can delete a setlist
- [ ] **SET-10**: User can edit a setlist's name

### Sharing

- [ ] **SHARE-01**: User can generate a read-only shareable link for a setlist
- [ ] **SHARE-02**: Anyone with the link can view the setlist without an account

### Band Workspaces

- [ ] **BAND-01**: User can create a band/group
- [ ] **BAND-02**: User can invite members to a band
- [ ] **BAND-03**: Band members share a common song library
- [ ] **BAND-04**: Band members can create and edit shared setlists

### Mobile & UX

- [ ] **UX-01**: App is fully usable on mobile devices (responsive design)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Song Library

- **SONG-05**: User can import songs from Spotify (title, duration auto-populated)
- **SONG-06**: User can store key and tempo metadata per song

### Setlist Builder

- **SET-11**: User can organize setlist into sections (Set 1, Set 2, Encore)
- **SET-12**: User can drag songs between sections
- **SET-13**: User can create setlist templates with slot types
- **SET-14**: User can attach a setlist to a gig (date + venue)
- **SET-15**: User can add per-song notes/annotations within a setlist
- **SET-16**: User can tag songs with energy/mood and see energy arc visualization

### Collaboration

- **COLLAB-01**: Band members can edit setlists simultaneously in real-time
- **COLLAB-02**: User can see version history of a setlist

### Export

- **EXPORT-01**: User can print or export a clean PDF of a setlist
- **EXPORT-02**: User can share a setlist as an image

### Mobile

- **MOBILE-01**: App works offline as a PWA with service worker caching

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Chord charts / lyrics display | Entire product domain (OnSong). Link out instead. |
| MIDI / audio integration | Requires native app capabilities. Web can't reliably do this. |
| Calendar / scheduling | Different product domain. Gig association is enough. |
| Social features / public profiles | Setlist.fm owns this space. Share-via-link is sufficient. |
| Payment / financial tracking | Unrelated domain. Bands use Splitwise or spreadsheets. |
| Notation / sheet music rendering | Enormous complexity, not relevant to setlist planning. |
| Native mobile app | Responsive web-first. PWA if offline needed later. |
| Complex permissions / roles | Two levels only: owner (edit) and viewer (read-only link). |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| SONG-01 | Phase 2 | Pending |
| SONG-02 | Phase 2 | Pending |
| SONG-03 | Phase 2 | Pending |
| SONG-04 | Phase 2 | Pending |
| SET-01 | Phase 3 | Pending |
| SET-02 | Phase 3 | Pending |
| SET-03 | Phase 3 | Pending |
| SET-04 | Phase 3 | Pending |
| SET-05 | Phase 3 | Pending |
| SET-06 | Phase 3 | Pending |
| SET-07 | Phase 3 | Pending |
| SET-08 | Phase 3 | Pending |
| SET-09 | Phase 3 | Pending |
| SET-10 | Phase 3 | Pending |
| SHARE-01 | Phase 3 | Pending |
| SHARE-02 | Phase 3 | Pending |
| BAND-01 | Phase 4 | Pending |
| BAND-02 | Phase 4 | Pending |
| BAND-03 | Phase 4 | Pending |
| BAND-04 | Phase 4 | Pending |
| UX-01 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-02-17*
*Last updated: 2026-02-17 after roadmap creation*
