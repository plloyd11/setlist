# Requirements: Setlist -- Playwright E2E Test Suite

**Defined:** 2026-03-02
**Core Value:** Musicians can build a setlist from their songs and instantly see how long the set runs, so they can nail the timing for a show.

## v1.2 Requirements

Requirements for comprehensive Playwright E2E test coverage. Each maps to roadmap phases.

### Test Infrastructure

- [x] **INFRA-01**: Playwright is configured with SvelteKit dev server and project-level setup
- [ ] **INFRA-02**: Test users are created via Supabase admin API with per-worker isolation
- [x] **INFRA-03**: Auth sessions are injected into browser via storageState (bypassing Google OAuth)
- [ ] **INFRA-04**: Test data factories can programmatically create songs, setlists, and bands
- [ ] **INFRA-05**: Test cleanup deletes user and cascades all related data after each worker

### Auth Tests

- [ ] **AUTH-01**: Unauthenticated user visiting protected routes is redirected to login
- [ ] **AUTH-02**: Authenticated user can access dashboard and all app routes
- [ ] **AUTH-03**: User can log out and is redirected appropriately

### Song Library Tests

- [ ] **SONG-01**: User can add a song with name and duration
- [ ] **SONG-02**: User can edit an existing song's details
- [ ] **SONG-03**: User can delete a song from their library
- [ ] **SONG-04**: User can search/filter songs by title
- [ ] **SONG-05**: User can batch-add multiple songs

### Setlist Builder Tests

- [ ] **SETL-01**: User can create a new setlist
- [ ] **SETL-02**: User can add songs to a setlist via drag-and-drop
- [ ] **SETL-03**: User can reorder songs within a setlist via drag-and-drop
- [ ] **SETL-04**: Running time total updates as songs are added/removed/reordered
- [ ] **SETL-05**: User can set target time and see over/under indicator
- [ ] **SETL-06**: User can set global transition time between songs
- [ ] **SETL-07**: User can duplicate, delete, and rename setlists
- [ ] **SETL-08**: User can share a setlist via public link

### Band Workspace Tests

- [ ] **BAND-01**: User can create a band
- [ ] **BAND-02**: User can invite another user to a band via invite link
- [ ] **BAND-03**: Invited user can join a band via invite link
- [ ] **BAND-04**: Band members can see shared song library
- [ ] **BAND-05**: Band members can collaborate on shared setlists

### RLS & Isolation Tests

- [ ] **RLS-01**: User cannot see another user's songs via direct URL
- [ ] **RLS-02**: User cannot see another user's setlists via direct URL
- [ ] **RLS-03**: Unauthenticated user can view a shared setlist via public link
- [ ] **RLS-04**: Band data is only visible to band members

## Future Requirements

### CI Integration

- **CI-01**: Playwright tests run in GitHub Actions on every push/PR
- **CI-02**: Test results are reported in PR checks
- **CI-03**: Playwright report artifacts are uploaded on failure

### Visual & Responsive

- **VIS-01**: Visual regression tests for key pages
- **VIS-02**: Responsive viewport tests (mobile, tablet, desktop)
- **VIS-03**: Dark/light theme tests

## Out of Scope

| Feature | Reason |
|---------|--------|
| CI pipeline | Local only for this milestone, CI deferred |
| Cross-browser testing | Chromium only for now, multi-browser adds complexity |
| Visual regression | Requires baseline screenshots, separate concern |
| Performance testing | Different tool and methodology (Lighthouse, etc.) |
| Unit/component tests | Different scope -- this milestone is E2E only |
| Mocking Supabase | Tests should hit real Supabase for E2E fidelity |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 7 | Complete |
| INFRA-02 | Phase 7 | Pending |
| INFRA-03 | Phase 7 | Complete |
| INFRA-04 | Phase 7 | Pending |
| INFRA-05 | Phase 7 | Pending |
| AUTH-01 | Phase 8 | Pending |
| AUTH-02 | Phase 8 | Pending |
| AUTH-03 | Phase 8 | Pending |
| SONG-01 | Phase 8 | Pending |
| SONG-02 | Phase 8 | Pending |
| SONG-03 | Phase 8 | Pending |
| SONG-04 | Phase 8 | Pending |
| SONG-05 | Phase 8 | Pending |
| SETL-01 | Phase 9 | Pending |
| SETL-02 | Phase 9 | Pending |
| SETL-03 | Phase 9 | Pending |
| SETL-04 | Phase 9 | Pending |
| SETL-05 | Phase 9 | Pending |
| SETL-06 | Phase 9 | Pending |
| SETL-07 | Phase 9 | Pending |
| SETL-08 | Phase 9 | Pending |
| BAND-01 | Phase 10 | Pending |
| BAND-02 | Phase 10 | Pending |
| BAND-03 | Phase 10 | Pending |
| BAND-04 | Phase 10 | Pending |
| BAND-05 | Phase 10 | Pending |
| RLS-01 | Phase 10 | Pending |
| RLS-02 | Phase 10 | Pending |
| RLS-03 | Phase 10 | Pending |
| RLS-04 | Phase 10 | Pending |

**Coverage:**
- v1.2 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap creation*
