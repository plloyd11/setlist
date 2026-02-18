# Roadmap: Setlist

## Overview

Setlist goes from a bare SvelteKit scaffold to a working multi-user setlist builder in 4 phases. Phase 1 establishes auth and the database foundation. Phase 2 builds the song library (the atomic data unit). Phase 3 delivers the core product -- the setlist builder with drag-and-drop, live timing, and shareable links. Phase 4 adds band workspaces for collaboration. Each phase delivers a complete, verifiable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation and Auth** - Supabase setup, Google OAuth, database schema, project structure
- [ ] **Phase 2: Song Library** - Song CRUD with duration input, search/filter, mobile-responsive list
- [ ] **Phase 3: Setlist Builder** - Drag-and-drop setlist building with live timing, sharing via public link
- [ ] **Phase 4: Band Workspaces** - Band creation, member invites, shared libraries and setlists

## Phase Details

### Phase 1: Foundation and Auth
**Goal**: Users can sign in with Google and access a protected app shell with a working database behind it
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03
**Success Criteria** (what must be TRUE):
  1. User can sign in with their Google account and land on a protected dashboard
  2. User can refresh the browser and remain logged in (session persists)
  3. User can log out from any page and is redirected to the login screen
  4. Unauthenticated users cannot access any app routes (redirected to login)
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Supabase auth infrastructure, Google OAuth, login page, session management
- [x] 01-02-PLAN.md — App shell (sidebar, bottom nav), theme system, dashboard, logout

### Phase 2: Song Library
**Goal**: Users can build and manage a personal library of songs with durations
**Depends on**: Phase 1
**Requirements**: SONG-01, SONG-02, SONG-03, SONG-04
**Success Criteria** (what must be TRUE):
  1. User can add a song with a name and duration (entered as mm:ss)
  2. User can edit a song's name and duration inline or via form
  3. User can delete a song and it disappears from their library
  4. User can search/filter their song library by title and see results update as they type
**Plans**: 2 plans

Plans:
- [x] 02-01-PLAN.md — Database migration (songs table + RLS), Song type, duration utilities, add-song page with form action
- [ ] 02-02-PLAN.md — Song library list page with search/filter, inline editing, context menu, delete with confirmation

### Phase 3: Setlist Builder
**Goal**: Users can build timed setlists from their songs via drag-and-drop and share them via public link
**Depends on**: Phase 2
**Requirements**: SET-01, SET-02, SET-03, SET-04, SET-05, SET-06, SET-07, SET-08, SET-09, SET-10, SHARE-01, SHARE-02, UX-01
**Success Criteria** (what must be TRUE):
  1. User can create a setlist, drag songs into it, reorder via drag-and-drop, and remove songs
  2. User sees a live-updating running time total that recalculates as songs are added, removed, or reordered
  3. User can set a target time and see a clear over/under indicator (e.g., "+5:00" in red or "-3:00" in green)
  4. User can set a global transition time between songs and see it reflected in the total
  5. User can generate a shareable link and anyone with that link can view the setlist without logging in
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: Band Workspaces
**Goal**: Musicians can form bands, share a common song library, and collaborate on setlists
**Depends on**: Phase 3
**Requirements**: BAND-01, BAND-02, BAND-03, BAND-04
**Success Criteria** (what must be TRUE):
  1. User can create a band and see it as a workspace separate from their personal library
  2. User can invite another user to join their band
  3. Band members see and contribute to a shared song library owned by the band
  4. Band members can create and edit setlists that belong to the band
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Auth | 2/2 | Complete | 2026-02-17 |
| 2. Song Library | 1/2 | In Progress | - |
| 3. Setlist Builder | 0/? | Not started | - |
| 4. Band Workspaces | 0/? | Not started | - |
