# Roadmap: Setlist

## Milestones

- ✅ **v1.0 MVP** -- Phases 1-4 (shipped 2026-02-22) -- [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1 Marketing Landing Page** -- Phase 5 shipped (Phase 6 Three.js animations dropped, not built)
- ✅ **v1.2 Playwright E2E Test Suite** -- Phases 7-10 (shipped 2026-03-13) -- [archive](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Tracks & Gaps** -- shipped ~2026-06-11 (band audio workspace + setlist gaps + password auth; shipped outside formal GSD phase planning)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-4) -- SHIPPED 2026-02-22</summary>

- [x] Phase 1: Foundation and Auth (2/2 plans) -- completed 2026-02-17
- [x] Phase 2: Song Library (2/2 plans) -- completed 2026-02-18
- [x] Phase 3: Setlist Builder (6/6 plans) -- completed 2026-02-20
- [x] Phase 4: Band Workspaces (5/5 plans) -- completed 2026-02-22

</details>

<details>
<summary>v1.1 Marketing Landing Page (Phase 5) -- SHIPPED</summary>

- [x] **Phase 5: Landing Page Structure** - Routing, content sections, responsive design, and design system integration
- [ ] ~~**Phase 6: Three.js Hero & Scroll Animations**~~ - Dropped; landing page shipped without the animated particle hero / scroll effects.

</details>

<details>
<summary>v1.3 Tracks & Gaps -- SHIPPED ~2026-06-11</summary>

Shipped directly (no formal GSD phase/plan files). Scope:
- [x] Band track workspace: versioned audio uploads to private Storage bucket (client-side direct upload), waveform player, timestamped threaded comments
- [x] Nestable track folders with security-definer RPCs (depth≤5, no cycles, reparent-on-delete)
- [x] Setlist gaps: labeled timed breaks (song-or-gap union row), shown on the shared sheet alongside song notes
- [x] Email/password auth: email confirmation + password reset/update routes
- [ ] E2E specs for the above -- not yet written

</details>

<details>
<summary>v1.2 Playwright E2E Test Suite (Phases 7-10) -- SHIPPED 2026-03-13</summary>

- [x] Phase 7: Test Infrastructure (3/3 plans) -- completed 2026-03-03
- [x] Phase 8: Auth & Song Library Tests (2/2 plans) -- completed 2026-03-05
- [x] Phase 9: Setlist Builder Tests (3/3 plans) -- completed 2026-03-12
- [x] Phase 10: Band & Multi-User Tests (2/2 plans) -- completed 2026-03-13

</details>

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

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Auth | v1.0 | 2/2 | Complete | 2026-02-17 |
| 2. Song Library | v1.0 | 2/2 | Complete | 2026-02-18 |
| 3. Setlist Builder | v1.0 | 6/6 | Complete | 2026-02-20 |
| 4. Band Workspaces | v1.0 | 5/5 | Complete | 2026-02-22 |
| 5. Landing Page Structure | v1.1 | -- | Shipped | ~2026-06 |
| 6. Three.js Hero & Scroll Animations | v1.1 | -- | Dropped | - |
| 7. Test Infrastructure | v1.2 | 3/3 | Complete | 2026-03-03 |
| 8. Auth & Song Library Tests | v1.2 | 2/2 | Complete | 2026-03-05 |
| 9. Setlist Builder Tests | v1.2 | 3/3 | Complete | 2026-03-12 |
| 10. Band & Multi-User Tests | v1.2 | 2/2 | Complete | 2026-03-13 |
| Tracks & Gaps (no formal phases) | v1.3 | -- | Shipped | ~2026-06-11 |
