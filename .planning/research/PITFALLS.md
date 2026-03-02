# Domain Pitfalls

**Domain:** Adding Playwright E2E tests to SvelteKit + Supabase app (Google OAuth, DnD, multi-user, RLS)
**Researched:** 2026-03-02
**Overall confidence:** HIGH -- verified via official Playwright docs, Supabase docs, and community sources

---

## Critical Pitfalls

Mistakes that cause rewrites, persistent flakiness, or abandoned test suites.

---

### Pitfall 1: Automating the Real Google OAuth Flow

**What goes wrong:** Tests attempt to automate Google's actual OAuth consent screen. Google detects automation (Playwright fingerprinting, headless mode signals), presents CAPTCHAs, locks accounts, or changes UI without notice. Tests become permanently flaky in CI.
**Why it happens:** Developers copy the "just click through login" pattern from simpler email/password flows and assume OAuth providers will cooperate.
**Consequences:** Test suite becomes untrusted. CI pipeline blocked by Google security measures. Test Google accounts get suspended.
**Prevention:**
1. Never automate the Google OAuth UI. Bypass OAuth entirely by injecting Supabase auth state directly.
2. Use Supabase Admin API (`supabase.auth.admin.createUser()`) with the service role key to create test users with pre-verified email addresses and passwords.
3. Call `supabase.auth.signInWithPassword()` via Playwright's API request context to get session tokens (this requires the test users to have email/password auth enabled -- they can exist alongside the app's Google-only flow).
4. Inject the resulting session cookies (`sb-<ref>-auth-token`) into Playwright's `storageState` before tests run.
5. Use Playwright's `setup` project pattern: a single `auth.setup.ts` creates session files that all test projects depend on.
**Detection:** If you see `page.goto('accounts.google.com')` in any test file, stop immediately.
**Confidence:** HIGH -- universally documented as the wrong approach. See [Playwright Auth Docs](https://playwright.dev/docs/auth) and [Supabase REST API Login for Playwright](https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test).

---

### Pitfall 2: Auth State Leaking Between Tests via Shared Browser Context

**What goes wrong:** Tests share a browser context (or improperly isolated storageState), so User A's session bleeds into User B's test. Band member tests see owner data. RLS appears broken because the wrong user is authenticated.
**Why it happens:** Playwright reuses browser contexts for speed by default. Supabase stores auth in cookies (`sb-<ref>-auth-token`), and those persist across navigations within a context. The app's `hooks.server.ts` reads these cookies on every request to establish the session.
**Consequences:** Tests pass locally (sequential) but fail in CI (parallel). Multi-user band scenarios produce impossible data states. Hours spent debugging "RLS bugs" that are actually auth leaks.
**Prevention:**
1. Use separate Playwright `projects` per user role (owner, member, anonymous). Each project gets its own `storageState` file.
2. For multi-user tests within a single spec (e.g., "owner invites member, member accepts"), use `browser.newContext()` explicitly for each user -- never switch users within one context.
3. Add an assertion at the start of critical tests verifying the expected user identity (e.g., check the profile name displayed in the UI or a `data-testid="user-email"` element).
4. In `playwright.config.ts`, set `fullyParallel: true` per project (not globally) to force context isolation.
**Detection:** Tests that work individually but fail when run together. Errors like "row not found" or unexpected empty query results.
**Confidence:** HIGH -- standard Playwright auth documentation emphasizes this pattern.

---

### Pitfall 3: RLS Silently Blocking Test Data Setup

**What goes wrong:** Tests try to create seed data (songs, setlists, bands) through the Supabase client using the `anon` or `authenticated` key without a matching `auth.uid()`. RLS policies reject the operations. Critically, Supabase returns **empty arrays** for RLS-blocked SELECTs (not errors), so tests appear to pass while testing nothing.
**Why it happens:** The app uses `PUBLIC_SUPABASE_PUBLISHABLE_KEY` everywhere. Developers copy this pattern into test setup code. But test fixtures run outside the browser context, so there is no authenticated session attached to these calls.
**Consequences:** Test setup silently creates zero data. Tests pass but exercise only empty states. Coverage is illusory.
**Prevention:**
1. Use a **service role client** (`SUPABASE_SERVICE_ROLE_KEY`) exclusively in test fixtures for data setup and teardown. This bypasses RLS entirely.
2. Keep the service role key in `.env.test` or CI secrets only -- never in browser-accessible code.
3. Create a `tests/utils/db.ts` that exports the admin client and helper functions (`createTestSong()`, `createTestBand()`, `createTestSetlist()`, etc.).
4. After creating data with the admin client, verify it exists by querying through the app's UI (not just the admin client).
5. Consider [Supawright](https://github.com/isaacharrisholt/supawright) -- a Playwright+Supabase test harness that handles FK-aware creation and automatic cleanup when tests exit.
**Detection:** Take screenshots after test data setup. If the UI shows "No songs in your library" or empty lists, the setup data was not created or is invisible to the test user.
**Confidence:** HIGH -- this is the most commonly reported Supabase testing issue. See [Supabase RLS Troubleshooting](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z).

---

### Pitfall 4: Drag-and-Drop Tests That Are Permanently Flaky

**What goes wrong:** DnD tests using `page.dragAndDrop()` or basic `locator.dragTo()` fail 20-50% of the time. Elements appear to be dragged but land in the wrong position or the drop is not registered by `svelte-dnd-action`.
**Why it happens:** `svelte-dnd-action` uses pointer events, animation frames (`flipDurationMs: 200` in this codebase), and reactive state updates (`$state` arrays). Playwright's synthetic events fire faster than the framework's microtask/animation frame cycle. The library recalculates drop zones during `pointermove`, and if the pointer jumps too fast, the target zone is missed. Additionally, `dragover` requires at least two `pointermove` events to fire reliably in all browsers.
**Consequences:** Team disables DnD tests or marks them as `test.fixme()`. The most interactive and bug-prone feature in the app goes untested.
**Prevention:**
1. Use low-level mouse operations instead of `dragAndDrop()`:
   ```typescript
   const source = page.locator('[data-testid="library-song-0"]');
   const target = page.locator('[data-testid="setlist-zone"]');
   const sourceBox = await source.boundingBox();
   const targetBox = await target.boundingBox();
   await source.hover();
   await page.mouse.down();
   // Move in multiple small steps -- not one jump
   await page.mouse.move(
     targetBox.x + targetBox.width / 2,
     targetBox.y + 10,
     { steps: 20 }
   );
   // Second move triggers dragover in all browsers
   await page.mouse.move(
     targetBox.x + targetBox.width / 2,
     targetBox.y + 20,
     { steps: 5 }
   );
   await page.mouse.up();
   ```
2. Wait for DOM change after drop, not a fixed timeout:
   ```typescript
   await expect(page.locator('[data-testid="setlist-song-0"]'))
     .toContainText('Song Name');
   ```
3. Add `data-testid` attributes to DnD zones and draggable items for stable selectors.
4. Re-fetch `boundingBox()` if the container might have scrolled or resized mid-drag.
5. Test reordering (within-zone) and cross-zone (library-to-setlist) separately -- they have different flakiness profiles.
6. Note: `svelte-dnd-action` has a specific bugfix making `dragHandleZones` testable within Playwright (see [release notes](https://github.com/isaacHagoel/svelte-dnd-action/blob/master/release-notes.md)).
**Detection:** Tests that pass on retry but fail on first attempt. Trace viewer shows pointer ending at correct coordinates but no DOM change occurring.
**Confidence:** MEDIUM -- approach verified via Playwright docs and svelte-dnd-action release notes, but exact step counts will need per-project tuning.

---

### Pitfall 5: Test Data Pollution Across Parallel Workers

**What goes wrong:** Two test workers create songs with the same title, or setlists with colliding names. One worker's teardown deletes another worker's data. Band invite tokens collide. Tests become order-dependent.
**Why it happens:** Tests use hardcoded data ("Test Song", "My Setlist"). With parallel execution, multiple workers hit the same Supabase database simultaneously. The `songs` table has no unique constraint on `(user_id, title)`, and neither does `setlists` on `(user_id, name)`.
**Consequences:** Tests flake in CI but pass locally (single worker). Debugging is nearly impossible because failures depend on execution order.
**Prevention:**
1. Namespace all test data with worker index and timestamp:
   ```typescript
   const songTitle = `Test Song W${testInfo.workerIndex}-${Date.now()}`;
   ```
2. Each worker gets its own test user. Create users like `test-worker-0@test.com`, `test-worker-1@test.com` in auth setup. RLS naturally isolates their songs and setlists data via `user_id` policies.
3. Clean up in `afterEach`/`afterAll` using the service role client, targeting only data created by the current test (match on the unique prefix or creation timestamp).
4. Never rely on database state from a previous test. Each test creates its own data.
5. For band/multi-user tests, create the entire band + members + songs in the test's own setup, not shared across the suite.
**Detection:** Run tests with `--workers=4` locally. If any tests that passed with `--workers=1` now fail, you have data isolation issues.
**Confidence:** HIGH -- universal E2E testing pattern.

---

## Moderate Pitfalls

---

### Pitfall 6: SvelteKit Hydration Race Conditions

**What goes wrong:** Playwright clicks a button before SvelteKit hydration completes. The `onclick` handler (used throughout this app, e.g., `onclick={signInWithGoogle}`, `onclick={toggleShare}`) is not yet attached. The click does nothing. The test times out waiting for a state change that never happens.
**Why it happens:** SvelteKit SSR renders HTML first, then hydrates with Svelte 5 JavaScript. There is a gap between "element visible" and "element interactive." Playwright's auto-wait checks for element visibility and stability, but not for JavaScript hydration.
**Prevention:**
1. Use Playwright's `locator.click()` with built-in auto-wait (checks actionability), combined with `await expect(page.locator('button')).toBeEnabled()` before clicking interactive elements.
2. For the DnD page specifically, wait for the library items to render before attempting drags: `await expect(page.locator('[data-testid="library-song-0"]')).toBeVisible()`.
3. Consider adding a root-level hydration marker: `<svelte:body data-hydrated />` set by an `onMount`, and wait for it in tests.
4. After page navigation, wait for a dynamic element that only exists after hydration (e.g., a reactive counter, user name, or data-fetched content).
**Detection:** Tests fail with "timeout waiting for navigation" after a click. Trace viewer shows the click happened but nothing followed.
**Confidence:** HIGH -- well-documented SvelteKit + Playwright issue.

---

### Pitfall 7: Using `networkidle` and Getting Slowness or Hangs

**What goes wrong:** Tests sprinkle `waitForLoadState('networkidle')` after every action. If the app ever adds Supabase Realtime subscriptions (WebSocket connections), `networkidle` will never resolve. Even without Realtime, Supabase auth token refresh calls and periodic health checks keep the network active, adding 500ms+ delays per wait.
**Why it happens:** `networkidle` is the "easy" way to wait after an action, and works in simple apps. But Supabase's client makes background requests that defeat the "no requests for 500ms" heuristic.
**Prevention:**
1. Use `networkidle` only after full page navigations where you need everything loaded, not after in-page actions.
2. After form submissions or API calls (like `persistOrder()`, `handleAddSong()`, `handleRemoveSong()` in the setlist page), wait for specific UI changes instead:
   ```typescript
   await expect(page.getByText('Added "Song Name"')).toBeVisible();
   ```
3. Use `domcontentloaded` + specific element waits as the default pattern.
4. If Supabase Realtime is ever added, `networkidle` will completely break -- plan for it now.
**Detection:** Test suite takes 3-5x longer than expected. Trace viewer shows long idle waits with no meaningful network activity.
**Confidence:** HIGH -- Supabase-specific due to background auth/API calls.

---

### Pitfall 8: Not Testing the Anonymous/Share Path Separately

**What goes wrong:** All tests run as authenticated users. The share link path (`/share/[token]`) is untested or tested incorrectly (from an authenticated context, which uses different RLS policies). Bugs in `to anon` RLS policies ship to production.
**Why it happens:** The auth setup pattern makes it easy to always be logged in. Developers forget that the share route uses `to anon` policies (defined in `20260218100000_create_setlist_tables.sql` and `20260302000000_add_anon_songs_policy.sql`), which are completely separate from the `to authenticated` policies.
**Prevention:**
1. Create a dedicated Playwright project with **no** `storageState` (anonymous context).
2. Test the full share flow end-to-end:
   - Authenticated user creates a setlist and enables sharing (gets `share_token`).
   - Open `/share/[token]` in the anonymous context.
   - Verify songs are visible (read-only).
   - Verify the anonymous user cannot modify, reorder, or delete songs.
3. Test that revoking sharing (setting `share_token` to null) immediately blocks access.
4. Test that a logged-in user accessing a share link does not see edit controls they should not have (a share link from another user's setlist).
**Detection:** Deploy the share feature, then test it in an incognito browser window. If it shows empty or errors, the `to anon` policies are wrong.
**Confidence:** HIGH -- specific to this codebase's share feature and RLS structure.

---

### Pitfall 9: Supabase Connection Pool Exhaustion in CI

**What goes wrong:** Tests run with 4+ parallel workers, each creating Supabase clients (service role for setup, anon for the app). Combined with the dev server's own connections, the connection pool is exhausted. Tests fail with connection errors or hang indefinitely.
**Why it happens:** Each Playwright worker + the SvelteKit dev server + admin clients for setup/teardown each hold connections. Cloud Supabase has limited connection slots (varies by plan). Even with connection pooling (PgBouncer), the total can exceed limits.
**Prevention:**
1. In CI, set `workers: 1` or `workers: 2` in `playwright.config.ts`. The reliability gain outweighs the speed loss.
2. **Strongly recommended:** Use `supabase start` for a local Supabase instance in CI. This eliminates connection limits, provides deterministic state, and avoids polluting any shared database.
3. Close admin clients explicitly in `afterAll` hooks.
4. Reuse a single service role client across all setup/teardown in a worker (create once in `beforeAll`, not per-test).
**Detection:** Tests hang or fail with connection errors only in CI. Works fine locally with `supabase start`.
**Confidence:** MEDIUM -- depends on the Supabase plan and CI configuration.

---

### Pitfall 10: Band Multi-User Tests Without Proper Context Isolation

**What goes wrong:** A test for "band owner invites member" creates the band, generates an invite, and then tries to accept it -- all in the same browser context. The test cannot simulate two users because both actions require different Supabase auth sessions (different `auth.uid()` values).
**Why it happens:** Developers think of E2E tests as single-user journeys and do not account for multi-actor workflows.
**Prevention:**
1. Use two browser contexts within one test:
   ```typescript
   const ownerContext = await browser.newContext({
     storageState: 'playwright/.auth/owner.json'
   });
   const memberContext = await browser.newContext({
     storageState: 'playwright/.auth/member.json'
   });
   const ownerPage = await ownerContext.newPage();
   const memberPage = await memberContext.newPage();
   // Owner creates band, navigates to settings, generates invite link
   // Extract invite token from the URL shown in ownerPage
   // Member navigates to /bands/invite/[token] in memberPage
   // Verify member now sees the band in their bands list
   ```
2. Create both test users in `auth.setup.ts` and save separate storageState files.
3. For the invite acceptance flow: owner creates invite (gets token), member navigates to `/bands/invite/[token]` in their own context.
4. After the invite is accepted, verify RLS scoping: member sees band songs, but cannot access owner-only settings (band deletion, member removal).
**Detection:** Band tests that only test single-user paths. Missing coverage for the invite acceptance flow, member removal, and permission boundaries.
**Confidence:** HIGH -- specific to this app's band collaboration features.

---

## Minor Pitfalls

---

### Pitfall 11: Brittle Selectors Tied to Tailwind Classes or DOM Structure

**What goes wrong:** Tests select elements by Tailwind classes (`page.locator('.bg-accent-500')`) or deep DOM structure paths. Tests break on every design tweak or component refactor.
**Prevention:**
1. Use `data-testid` attributes for elements that tests interact with.
2. Use ARIA roles and text content where semantically meaningful: `page.getByRole('button', { name: 'Sign in with Google' })`.
3. Never select by Tailwind utility classes or component wrapper divs.
4. The DnD zones in particular need testids -- the `use:dndzone` containers and each draggable item.
**Confidence:** HIGH.

---

### Pitfall 12: Only Testing Against Dev Server, Not Production Build

**What goes wrong:** Tests pass against `vite dev` but fail against `vite build && vite preview`. SSR behavior differs between dev and production builds (e.g., different code splitting, environment variable handling via `$env/static`). The Netlify adapter (`@sveltejs/adapter-netlify`) may further change behavior.
**Prevention:**
1. In `playwright.config.ts`, configure `webServer` to run `npm run build && npm run preview` for CI.
2. Use `npm run dev` for local development speed.
3. Run the full suite against the production build at least in CI before merging.
**Confidence:** MEDIUM -- depends on SSR complexity.

---

### Pitfall 13: Clipboard API Tests Failing in Headless/CI

**What goes wrong:** The "Copy share link" button uses `navigator.clipboard.writeText()`. In headless browsers or CI environments, the clipboard API is unavailable or requires permissions not granted by default. The test clicks "Copy" and nothing happens.
**Prevention:**
1. Grant clipboard permissions in the browser context:
   ```typescript
   const context = await browser.newContext({
     permissions: ['clipboard-read', 'clipboard-write']
   });
   ```
2. Alternatively, test the UI feedback ("Copied!" text appearing) rather than actual clipboard content.
3. If clipboard permissions are flaky, intercept the clipboard call with `page.evaluate()` to mock it.
**Confidence:** HIGH -- common headless/CI issue.

---

### Pitfall 14: Dev Server Startup Timeout in CI

**What goes wrong:** The SvelteKit dev server takes longer to start in CI than locally. Playwright's `webServer.timeout` (default 60s) is exceeded, and all tests fail before they begin.
**Prevention:**
1. Set `webServer.timeout: 120_000` (120 seconds) in `playwright.config.ts`.
2. Use `reuseExistingServer: !process.env.CI` so local development reuses an already-running server.
3. In CI, consider running against the production build (`npm run preview`) which starts faster than the dev server.
**Confidence:** HIGH.

---

### Pitfall 15: Svelte 5 Reactivity Timing in Assertions

**What goes wrong:** Tests assert against a DOM state immediately after an action, but Svelte 5's fine-grained reactivity (`$state`, `$derived`) has not yet propagated to the DOM. The assertion fails because the DOM update is scheduled for the next microtick. This is especially relevant for the setlist page where `isMutating`, `setlistItems`, and `libraryItems` are all `$state` variables with `$effect` dependencies.
**Prevention:**
1. Always use Playwright's auto-retrying assertions: `expect(locator).toBeVisible()`, `expect(locator).toHaveText()`, `expect(locator).toContainText()`.
2. Never use `page.content()` or `page.$eval()` for reactive state checks -- these are point-in-time snapshots.
3. Set a reasonable `expect.timeout` (5000ms default is usually fine) to give Svelte's reactivity time to settle.
**Confidence:** MEDIUM -- Svelte 5 reactivity is new, fewer documented test patterns.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Initial Playwright setup | Pitfall 14 (dev server timeout), Pitfall 12 (dev vs build) | Get `webServer` config right first, test both modes early |
| Auth setup project | Pitfall 1 (Google OAuth automation), Pitfall 2 (state leaking) | Bypass OAuth from day one with admin API users and storageState per role |
| First CRUD tests (songs) | Pitfall 3 (RLS blocking setup), Pitfall 5 (data pollution) | Service role client for fixtures, unique data per worker |
| DnD setlist tests | Pitfall 4 (flaky DnD), Pitfall 6 (hydration race) | Low-level mouse API with small step counts, wait for hydration signals |
| Band multi-user tests | Pitfall 10 (single-context multi-user), Pitfall 2 (auth leaking) | Dual browser contexts with separate storageState files |
| Share link tests | Pitfall 8 (untested anon path), Pitfall 13 (clipboard in CI) | Dedicated anonymous Playwright project, grant clipboard permissions |
| CI pipeline setup | Pitfall 9 (connection exhaustion), Pitfall 7 (networkidle slowness) | Limit workers, use `supabase start` locally, avoid networkidle |

---

## Sources

- [Playwright Authentication Docs](https://playwright.dev/docs/auth) -- storageState and setup project patterns (HIGH confidence)
- [Playwright Input/Actions Docs](https://playwright.dev/docs/input) -- mouse.down/move/up for DnD (HIGH confidence)
- [Playwright Parallel Execution Docs](https://playwright.dev/docs/test-parallel) -- worker isolation (HIGH confidence)
- [svelte-dnd-action Release Notes](https://github.com/isaacHagoel/svelte-dnd-action/blob/master/release-notes.md) -- Playwright compatibility fix (MEDIUM confidence)
- [Supawright - Playwright+Supabase Test Harness](https://github.com/isaacharrisholt/supawright) -- FK-aware data setup/teardown (MEDIUM confidence)
- [Supabase Testing Overview](https://supabase.com/docs/guides/local-development/testing/overview) -- official testing guidance (HIGH confidence)
- [Supabase RLS Troubleshooting](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z) -- service role bypasses RLS (HIGH confidence)
- [Login at Supabase via REST API in Playwright](https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test) -- API-based auth bypass pattern (MEDIUM confidence)
- [Database Rollback Strategies in Playwright](https://www.thegreenreport.blog/articles/database-rollback-strategies-in-playwright/database-rollback-strategies-in-playwright.html) -- data isolation patterns (MEDIUM confidence)
- [Reflect: DnD Testing in Playwright](https://reflect.run/articles/how-to-test-drag-and-drop-interactions-in-playwright/) -- multi-step mouse moves for DnD (MEDIUM confidence)
- [BrowserStack: Playwright DnD](https://www.browserstack.com/guide/playwright-drag-and-drop) -- DnD approaches and pitfalls (MEDIUM confidence)
