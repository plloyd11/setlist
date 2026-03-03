# Roadmap: Setlist

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-4 (shipped 2026-02-22) -- [archive](milestones/v1.0-ROADMAP.md)
- 🚧 **v1.1 Marketing Landing Page** -- Phases 5-6 (in progress)
- 🚧 **v1.2 Playwright E2E Test Suite** -- Phases 7-10 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-4) -- SHIPPED 2026-02-22</summary>

- [x] Phase 1: Foundation and Auth (2/2 plans) -- completed 2026-02-17
- [x] Phase 2: Song Library (2/2 plans) -- completed 2026-02-18
- [x] Phase 3: Setlist Builder (6/6 plans) -- completed 2026-02-20
- [x] Phase 4: Band Workspaces (5/5 plans) -- completed 2026-02-22

</details>

<details>
<summary>v1.1 Marketing Landing Page (Phases 5-6) -- IN PROGRESS</summary>

- [ ] **Phase 5: Landing Page Structure** - Routing, content sections, responsive design, and design system integration
- [ ] **Phase 6: Three.js Hero & Scroll Animations** - Particle background, GSAP ScrollTrigger effects, and motion accessibility

</details>

### v1.2 Playwright E2E Test Suite

- [ ] **Phase 7: Test Infrastructure** - Playwright config, auth bypass, fixtures, factories, and cleanup
- [ ] **Phase 8: Auth & Song Library Tests** - Auth redirect/access/logout tests and full song CRUD coverage
- [ ] **Phase 9: Setlist Builder Tests** - Create, DnD interactions, timing calculations, and public sharing
- [ ] **Phase 10: Band & Multi-User Tests** - Band workflows, multi-user collaboration, and RLS isolation

## Phase Details

<details>
<summary>Phase 5-6 Details (v1.1)</summary>

### Phase 5: Landing Page Structure
**Goal**: Visitors see a complete, polished marketing page with all content sections, responsive layout, and working auth-based routing
**Depends on**: Phase 4
**Requirements**: ROUTE-01, ROUTE-02, HERO-01, HERO-03, FEAT-01, FEAT-02, SOCL-01, FOOT-01, DSGN-01, DSGN-02, DSGN-03
**Success Criteria** (what must be TRUE):
  1. Logged-out visitor at `/` sees a marketing landing page with hero, features, social proof, and footer sections
  2. Logged-in user at `/` is redirected to the dashboard without seeing the landing page
  3. Hero section displays bold headline, subheadline, and a CTA button that initiates sign-up
  4. Feature cards show real app screenshots and describe core capabilities
  5. Page renders correctly on mobile, tablet, and desktop using the app's existing design tokens and theme
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md -- Auth-based routing and dashboard relocation
- [x] 05-02-PLAN.md -- Marketing landing page content and layout
- [ ] 05-03-PLAN.md -- Replace placeholder screenshots with realistic SVG illustrations (gap closure: FEAT-02)

### Phase 6: Three.js Hero & Scroll Animations
**Goal**: The landing page feels alive with an animated particle hero background and scroll-triggered animations throughout, while remaining accessible
**Depends on**: Phase 5
**Requirements**: HERO-02, ANIM-01, ANIM-02
**Success Criteria** (what must be TRUE):
  1. Hero section displays an animated Three.js particle background with a stage lighting aesthetic
  2. Scrolling through the page triggers GSAP animations (fade, slide, parallax) on each content section
  3. Users with `prefers-reduced-motion` enabled see no animations -- content is fully visible without motion
**Plans**: TBD

Plans:
- [ ] 06-01: TBD
- [ ] 06-02: TBD

</details>

### Phase 7: Test Infrastructure
**Goal**: A working Playwright test harness exists where any test file can authenticate as an isolated test user and create test data without touching production
**Depends on**: Nothing (standalone milestone, tests existing app)
**Requirements**: INFRA-01, INFRA-02, INFRA-03, INFRA-04, INFRA-05
**Success Criteria** (what must be TRUE):
  1. Running `npx playwright test` launches the SvelteKit dev server and executes a smoke test that loads the app
  2. A test can create a unique user via Supabase admin API and authenticate as that user in the browser without Google OAuth
  3. A test can programmatically create songs, setlists, and bands via factory helpers
  4. After a test worker completes, the test user and all associated data are deleted from the database
**Plans**: 3 plans

Plans:
- [ ] 07-01-PLAN.md -- Install Playwright, config, and email/password auth form
- [ ] 07-02-PLAN.md -- Supabase admin client, worker fixtures, auth helpers, and cleanup
- [ ] 07-03-PLAN.md -- Factory functions, cleanup script, and smoke test

### Phase 8: Auth & Song Library Tests
**Goal**: Every auth flow and song library operation has automated test coverage that catches regressions
**Depends on**: Phase 7
**Requirements**: AUTH-01, AUTH-02, AUTH-03, SONG-01, SONG-02, SONG-03, SONG-04, SONG-05
**Success Criteria** (what must be TRUE):
  1. An unauthenticated browser visiting a protected route (e.g. `/dashboard`) is redirected to the login page
  2. An authenticated user can navigate to all app routes without being blocked
  3. A logged-in user can log out and is redirected to the landing page
  4. Tests exercise the full song lifecycle: add a song, verify it appears, edit its details, search/filter to find it, and delete it
  5. Batch song entry creates multiple songs in one action and all appear in the library
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

### Phase 9: Setlist Builder Tests
**Goal**: The core setlist-building workflow -- including drag-and-drop, live timing, and sharing -- has full automated coverage
**Depends on**: Phase 8
**Requirements**: SETL-01, SETL-02, SETL-03, SETL-04, SETL-05, SETL-06, SETL-07, SETL-08
**Success Criteria** (what must be TRUE):
  1. A test can create a setlist, drag songs into it from the library using pointer events, and reorder songs within the setlist
  2. The running time total visibly updates as songs are added, removed, or reordered
  3. Setting a target time shows an over/under indicator, and setting transition time adjusts the total accordingly
  4. A test can duplicate, rename, and delete setlists and verify the changes persist
  5. A shared setlist is accessible via its public link to an unauthenticated browser
**Plans**: TBD

Plans:
- [ ] 09-01: TBD
- [ ] 09-02: TBD

### Phase 10: Band & Multi-User Tests
**Goal**: Band collaboration and data isolation are verified with multi-user scenarios using separate browser contexts
**Depends on**: Phase 9
**Requirements**: BAND-01, BAND-02, BAND-03, BAND-04, BAND-05, RLS-01, RLS-02, RLS-03, RLS-04
**Success Criteria** (what must be TRUE):
  1. A user can create a band, generate an invite link, and a second user (in a separate browser context) can join via that link
  2. Both band members see the shared song library and can collaborate on shared setlists
  3. A user cannot access another user's songs or setlists via direct URL navigation (RLS enforcement)
  4. An unauthenticated visitor can view a shared setlist via public link but cannot access any other data
  5. Band data (songs, setlists, members) is only visible to members of that band
**Plans**: TBD

Plans:
- [ ] 10-01: TBD
- [ ] 10-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 7 -> 8 -> 9 -> 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Auth | v1.0 | 2/2 | Complete | 2026-02-17 |
| 2. Song Library | v1.0 | 2/2 | Complete | 2026-02-18 |
| 3. Setlist Builder | v1.0 | 6/6 | Complete | 2026-02-20 |
| 4. Band Workspaces | v1.0 | 5/5 | Complete | 2026-02-22 |
| 5. Landing Page Structure | v1.1 | 2/3 | In progress | - |
| 6. Three.js Hero & Scroll Animations | v1.1 | 0/? | Not started | - |
| 7. Test Infrastructure | v1.2 | 0/3 | Not started | - |
| 8. Auth & Song Library Tests | v1.2 | 0/? | Not started | - |
| 9. Setlist Builder Tests | v1.2 | 0/? | Not started | - |
| 10. Band & Multi-User Tests | v1.2 | 0/? | Not started | - |
