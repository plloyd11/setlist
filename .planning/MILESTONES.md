# Milestones

## v1.2 Playwright E2E Test Suite (Shipped: 2026-03-13)

**Phases completed:** 4 phases (7-10), 10 plans, 16 tasks
**Timeline:** 24 days (Feb 17 → Mar 13, 2026)
**Stats:** 13 feat commits, 15 files, 1,317 LOC TypeScript
**Requirements:** 30/30 satisfied

**Key accomplishments:**
- Playwright test harness with SvelteKit dev server, worker-scoped fixtures, and email/password auth bypass
- Test data factories (createSong, createSetlist, createBand) with Supabase admin client and automatic cleanup
- Auth & song library E2E tests covering redirects, session persistence, sign-out, and full CRUD lifecycle
- Setlist builder E2E tests with custom DnD pointer-event helper, timing calculations, and public sharing
- Multi-user band collaboration tests using separate browser contexts for invite/join flows
- RLS data isolation tests verifying Supabase row-level security enforcement

**Tech debt (3 minor items):**
- SETL-08: Share URL locator relies on single `.truncate` element (fragile)
- BAND-05: Setlist cleanup via implicit ON DELETE CASCADE (correct but undocumented)
- BAND-01: Band cleanup without try/finally (low risk — worker teardown cascades)

**Archives:** [ROADMAP](milestones/v1.2-ROADMAP.md) | [REQUIREMENTS](milestones/v1.2-REQUIREMENTS.md) | [AUDIT](milestones/v1.2-MILESTONE-AUDIT.md)

---

## v1.0 MVP (Shipped: 2026-02-22)

**Phases completed:** 4 phases, 15 plans, 31 tasks
**Timeline:** 6 days (Feb 17 → Feb 22, 2026)
**Stats:** 80 commits, 64 files, 7,205 LOC (SvelteKit + TypeScript)

**Key accomplishments:**
- Google OAuth with SSR session management and responsive app shell with dark/light theme
- Song library with batch entry, real-time search/filter, inline editing, and context menu actions
- Drag-and-drop setlist builder with live timing bar, target time tracking, and public share links
- Band workspaces with member invites, shared song libraries, and collaborative setlist building
- Mobile-responsive design across all views

**Tech debt carried forward (5 minor items):**
- Dead code in theme.ts, App.PageData type gap, unused import in invite page
- Dashboard stats hardcoded to 0, $app/stores vs $app/state inconsistency

**Archives:** [ROADMAP](milestones/v1.0-ROADMAP.md) | [REQUIREMENTS](milestones/v1.0-REQUIREMENTS.md) | [AUDIT](milestones/v1.0-MILESTONE-AUDIT.md)

---
