# Research Summary: Playwright E2E Testing Infrastructure

**Domain:** E2E testing for SvelteKit + Supabase setlist-builder app
**Researched:** 2026-03-02
**Overall confidence:** HIGH

## Executive Summary

Adding Playwright E2E testing to the Setlist app requires exactly three new dependencies (`@playwright/test`, `@faker-js/faker`, `dotenv`) and a dedicated Supabase test project. The core challenge is not Playwright itself -- it is well-documented and SvelteKit's official recommendation -- but rather authenticating test users against an app that only supports Google OAuth in production.

Google OAuth cannot be automated in E2E tests. Google actively blocks automated logins with CAPTCHAs, phone verification, and consent page changes. Every community source confirms this. The solution is to create real Supabase users with password auth via the admin API (service role key), sign them in via REST, and inject session tokens into the browser. The app's `hooks.server.ts` validates JWT sessions regardless of auth provider, so a password-created session is indistinguishable from a Google OAuth session.

The second major challenge is testing drag-and-drop with svelte-dnd-action. Playwright's built-in `locator.dragTo()` dispatches HTML5 drag events, but svelte-dnd-action listens for pointer events. A custom helper using `page.mouse` API (mousedown/mousemove/mouseup with intermediate steps) is required. This is a known pattern for custom DnD libraries but needs tuning during implementation.

Test data isolation uses Playwright's fixture system with per-worker test users. Each parallel worker creates a unique user via the Supabase admin API, runs tests in isolation, and deletes the user in teardown. Foreign key CASCADE constraints handle cascading data cleanup. This avoids the need for database truncation or transaction rollback strategies.

## Key Findings

**Stack:** 3 new dev dependencies: `@playwright/test` ^1.58.0, `@faker-js/faker` ^9.0.0, `dotenv` ^16.4.0. Existing `@supabase/supabase-js` used for admin API. No other tools needed.

**Architecture:** Custom Playwright fixtures create per-worker isolated test users via Supabase admin API. Auth bypass via REST password sign-in + localStorage session injection. Custom `page.mouse` helper for svelte-dnd-action DnD testing.

**Critical pitfall:** Google OAuth cannot be automated -- must use service role API auth bypass. `locator.dragTo()` silently fails with svelte-dnd-action -- must use manual pointer events.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **Test Infrastructure Setup** -- Playwright config, fixtures, auth helpers, env setup
   - Addresses: Project scaffolding, auth bypass mechanism, test user lifecycle
   - Avoids: Trying to automate Google OAuth (dead end)

2. **Core Flow Tests** -- Auth redirect, Song CRUD, Setlist CRUD
   - Addresses: Table-stakes coverage for the most-used features
   - Avoids: Over-testing low-value pages before core flows are covered

3. **DnD and Complex Interaction Tests** -- Setlist reordering, timing calculations
   - Addresses: The core UX interaction that is hardest to test
   - Avoids: Starting with DnD (high complexity) before simpler tests validate the infrastructure works

4. **Multi-User and Collaboration Tests** -- Band invites, RLS isolation, shared data
   - Addresses: The most complex scenarios requiring multiple browser contexts
   - Avoids: Pitfall of testing multi-user before single-user flows are stable

5. **Polish Tests** -- Responsive viewports, dark mode, edge cases, share links
   - Addresses: Secondary coverage that catches regressions
   - Avoids: Over-investing in visual/responsive testing before core flows pass

**Phase ordering rationale:**
- Infrastructure must exist before any tests can run (Phase 1 is foundational)
- Simple CRUD tests validate the fixture/auth pattern before complex tests build on it
- DnD is separated because it requires a custom helper and tuning
- Multi-user tests are deferred because they need two browser contexts (higher complexity)
- Polish tests come last because they have lowest regression-prevention value per effort

**Research flags for phases:**
- Phase 1: Auth bypass pattern is well-documented; standard implementation. No additional research needed.
- Phase 3: DnD pointer event helper needs tuning -- the exact `steps` count and timing for svelte-dnd-action may require experimentation.
- Phase 4: Multi-user test orchestration with separate browser contexts is standard Playwright but has not been tested against this specific app's invite flow.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Playwright v1.58.2 verified on npm. Only 3 dependencies. Supabase admin API is stable and well-documented. |
| Features | HIGH | Test coverage priorities derived from actual app source code analysis. Feature dependencies verified from route structure. |
| Architecture | HIGH | Auth bypass via service role is the established community pattern. Fixture system is core Playwright. |
| Pitfalls | HIGH for auth bypass, MEDIUM for DnD | Auth bypass is proven. DnD pointer event approach is standard for custom DnD libs but needs tuning for svelte-dnd-action specifically. |

## Gaps to Address

- **DnD helper tuning:** The `page.mouse.move()` step count and timing for svelte-dnd-action needs experimentation. Start with `steps: 10` and adjust.
- **FK CASCADE verification:** Confirm database schema has `ON DELETE CASCADE` on user_id foreign keys. If not, write a manual cleanup helper.
- **Supabase session localStorage key format:** The exact localStorage key format (`sb-{project-ref}-auth-token`) should be verified against the current `@supabase/ssr` version.
- **CI configuration:** Playwright in CI needs either a running dev server or a build+preview approach. The webServer config handles this but needs testing in the actual CI environment (Netlify? GitHub Actions?).

---
*Research completed: 2026-03-02*
*Ready for roadmap: yes*
