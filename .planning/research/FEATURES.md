# Feature Landscape: Playwright E2E Test Suite

**Domain:** E2E testing for SvelteKit setlist-builder app
**Researched:** 2026-03-02
**Confidence:** HIGH (Playwright docs are authoritative; app structure verified from source)

## Table Stakes

Tests every E2E suite for this app must include. Missing any of these means the suite provides false confidence.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Auth bypass infrastructure** | Google OAuth cannot be automated. Every test depends on authenticated state. | Med | Playwright fixtures create test users via Supabase admin API, sign in via REST, inject session into browser localStorage. |
| **Route protection smoke tests** | 12+ server routes redirect unauthenticated users to `/auth`. Must verify this works. | Low | Quick loop over all `(app)/*` routes asserting redirect. High value per line of test code. |
| **Song CRUD journey** | Core feature: create song, verify in list, delete it | Med | Tests `/songs/new` form, `/songs` list, inline delete. Verify form validation (empty title rejected). |
| **Setlist CRUD journey** | Core feature: create setlist, add songs, verify detail page | Med | Tests `/setlists` create + `/setlists/[id]` detail. Verify redirect to new setlist after creation. |
| **Public share link** | The one truly public feature. Must work without auth. | Low | Test valid token shows setlist data, invalid token shows 404. No auth dependency. |
| **Test data seeding and cleanup** | Each test needs predictable state; leftover data causes flakiness | High | Playwright fixtures with Supabase admin API. Per-worker isolation. FK cascade cleanup. |
| **CI pipeline configuration** | Tests must run headless in CI without manual intervention | Low | `playwright.config.ts` with `webServer`, GitHub Actions workflow. |

## Differentiators

Tests that go beyond basic coverage. Add after table stakes pass reliably.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Drag-and-drop setlist reordering** | Validates the core UX interaction | High | Custom `page.mouse` helper needed for svelte-dnd-action. Cannot use `locator.dragTo()`. |
| **Multi-user band collaboration** | User A creates band, invites User B, both see shared data | High | Two separate browser contexts with different auth states. Most complex test scenario. |
| **Band RLS isolation** | User A cannot see User B's band data even via direct URL | Med | Prevents regression of commit `5391100` RLS fix. Critical security test. |
| **Setlist timing calculations** | Add songs with known durations, verify total time display | Med | Tests the computed `$derived` display -- the app's core value proposition. |
| **Band member management** | Invite, verify member list, remove member | Med | Tests `/bands/[id]/members` actions and redirect flows. |
| **Responsive viewport testing** | Key flows at mobile (375px) and desktop (1280px) | Med | Verify BottomNav on mobile, Sidebar on desktop. Playwright device profiles. |
| **Dark/light theme rendering** | Both color schemes render without broken contrast | Low | Playwright `colorScheme` emulation. Quick smoke test. |
| **Form validation edge cases** | Empty submissions, invalid data, duplicate entries | Med | Tests error messages appear and no server errors on bad input. |

## Anti-Features

Tests to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Automating Google OAuth login** | Google blocks automated logins with CAPTCHA. Permanently flaky. Violates ToS. | Use service role API to create password-based test users. |
| **Visual regression on every page** | Screenshot tests are brittle across OS/CI. Font rendering differences create constant noise. | Use `toHaveScreenshot()` on landing page and share page only. Assert element visibility for layout correctness. |
| **Cross-browser matrix** | SvelteKit + Tailwind has excellent cross-browser compat. 3x browsers = 3x CI time for marginal value. | Run Chromium only. Add Firefox/WebKit only if users report browser-specific bugs. |
| **Exhaustive RLS policy testing via Playwright** | RLS is a database concern. Playwright tests at the wrong layer. | Use pgTAP for RLS unit tests. In Playwright, test "user cannot see other user's data" at the application level. |
| **100% page coverage** | 15+ pages x multiple states = 50+ tests. Diminishing returns after core flows. | Test user journeys (flows across pages), not individual pages. |
| **E2E tests for pure logic** | Duration calculations, URL parsing are unit test territory. Too slow for E2E. | Write Vitest unit tests for utility functions. |
| **Mocking Supabase responses** | Defeats the purpose of E2E testing. Tests should hit real backend. | Test against dedicated Supabase test project. |

## Feature Dependencies

```
Auth bypass infrastructure (fixtures + session injection)
  --> ALL authenticated tests depend on this
      --> Song CRUD journey
      --> Setlist CRUD journey
      --> Band workflow tests
      --> Settings tests
      --> Navigation tests

Test data factories (Supabase admin API helpers)
  --> Song CRUD (needs clean user state)
  --> Setlist tests (needs songs to exist first)
  --> Band tests (needs two users + band + membership records)
  --> Share link tests (needs setlist with share_token)
  --> Multi-user tests (needs two separate authenticated users)
  --> RLS isolation tests (needs data owned by different users)

Song CRUD tests
  --> Setlist builder tests (setlists need songs)
  --> Batch entry tests (variant of song creation)

Setlist CRUD tests
  --> Share link tests (share_token generated from setlist)
  --> DnD tests (needs setlist with 3+ songs)
  --> Timing tests (needs songs with known durations)

Band creation tests
  --> Band invite flow (needs existing band)
  --> Band member management (needs band with 2+ members)
  --> Band songs/setlists (needs band context)
  --> Band RLS isolation (needs two bands owned by different users)
```

## MVP Test Suite Recommendation

Build these first, in this order:

1. **Auth bypass infrastructure** -- Playwright fixtures with Supabase admin user creation. This is the foundation.
2. **Route protection smoke tests** -- Quick wins: verify `(app)/*` routes redirect when unauthenticated. Low effort, high confidence.
3. **Public share link tests** -- No auth dependency. Valid token (200 with data) and invalid token (404).
4. **Song CRUD journey** -- Create song, verify in list, search, delete, verify removal. Covers forms, nav, persistence.
5. **Setlist builder journey** -- Create setlist, add songs, verify timing, generate share link. Core product flow.
6. **Band creation and invite flow** -- Create band, generate invite link. Most complex journey, most likely to regress.

**Defer:**
- DnD reordering: Add after core flows pass. High complexity.
- Multi-user collaboration: Add after single-user band flows are stable.
- Responsive viewport tests: Verify manually first.

## Sources

- [Playwright Authentication Docs](https://playwright.dev/docs/auth) -- storageState pattern
- [Playwright Browser Contexts](https://playwright.dev/docs/browser-contexts) -- multi-user testing
- [Playwright Emulation Docs](https://playwright.dev/docs/emulation) -- viewport, colorScheme
- [Supabase Testing Overview](https://supabase.com/docs/guides/local-development/testing/overview)
- [svelte-dnd-action GitHub](https://github.com/isaacHagoel/svelte-dnd-action) -- Playwright compat notes
- App source code analysis: `src/routes/`, `src/hooks.server.ts`, `src/lib/types/database.ts`
