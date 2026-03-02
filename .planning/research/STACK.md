# Technology Stack: Playwright E2E Testing Infrastructure

**Project:** Setlist - E2E Testing Milestone
**Researched:** 2026-03-02
**Overall confidence:** HIGH -- Playwright v1.58.2 verified current on npm, Supabase admin API patterns well-documented.

## Already Decided (Locked In -- Do NOT Re-research)

SvelteKit 2, Svelte 5, Tailwind CSS v4, Supabase (Postgres + Auth + RLS + Storage), Google OAuth, svelte-dnd-action, Netlify adapter. All existing. This document covers ONLY what is needed for the new testing infrastructure.

## Recommended Stack

### Core Testing Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@playwright/test` | ^1.58.0 | E2E test runner, assertions, browser automation | Industry standard for E2E. SvelteKit official docs recommend Playwright. Built-in auto-waiting locators, parallel worker isolation, auth state persistence, HTML reporter. Currently at v1.58.2 stable. |

### Test Data Generation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@faker-js/faker` | ^9.0.0 | Generate unique test data (emails, names, titles) | Parallel tests need unique data per worker to avoid collisions. Faker generates realistic emails, band names, song titles. Hardcoded data causes flaky parallel runs. |

### Environment Configuration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `dotenv` | ^16.4.0 | Load `.env.test` for Playwright config | Playwright config runs outside SvelteKit, so `$env/static/public` is unavailable. dotenv loads `SUPABASE_SERVICE_ROLE_KEY` and test-specific vars. |

### Already Installed (No New Dependency)

| Technology | Already At | Purpose in Testing | Why No New Install |
|------------|-----------|-------------------|-------------------|
| `@supabase/supabase-js` | ^2.96.0 | Service role client for test user CRUD via admin API | Import directly in test helpers. `auth.admin.createUser()` and `auth.admin.deleteUser()` handle test user lifecycle. |

**Total new dependencies: 3** (`@playwright/test`, `@faker-js/faker`, `dotenv`)

## Explicitly NOT Needed (Anti-Stack)

| Library | Why Skip |
|---------|----------|
| `supawright` | Supabase E2E test harness. Unclear maintenance status, could not verify on npm. The same functionality is ~50 lines of code with Supabase admin API in custom Playwright fixtures. Do not add an opaque dependency for something this simple. |
| `vitest` | Unit test runner. Out of scope for E2E milestone. Add later if unit tests are desired. |
| `@testing-library/svelte` | Component testing, not E2E. Playwright tests interact with real rendered DOM in real browsers. |
| `cypress` | Playwright is officially recommended by SvelteKit, has better parallelism, better auth state management, and cross-browser support. |
| `msw` (Mock Service Worker) | Do NOT mock Supabase. E2E tests must hit the real Supabase backend to validate RLS policies, auth flows, and data integrity. Mocking defeats the purpose of E2E. |
| `supabase` CLI (local stack) | Would require Docker, migration parity maintenance, and CI Docker-in-Docker complexity. A dedicated Supabase test project is operationally simpler and matches production topology. |
| `playwright-mcp` | AI agent tooling for Playwright. Not needed for writing tests. |
| `@playwright/experimental-ct-svelte` | Component testing via Playwright. Overkill -- use Playwright for E2E, add Vitest later for component tests if needed. |

## Architecture Decisions

### Decision 1: Dedicated Supabase Test Project (not local Supabase)

**Use a separate hosted Supabase project** with identical schema for testing.

**Why:**
- App already runs against hosted Supabase -- test topology matches production
- No Docker dependency in dev or CI
- No migration parity maintenance (apply same migrations to test project)
- Service role key on a test project is safe in CI env vars
- RLS policies behave identically to production
- Network latency is acceptable for E2E (tests are already slow by nature)

**Trade-off:** Slightly slower than local Supabase due to network. Worth it for operational simplicity.

### Decision 2: Auth Bypass via Service Role Admin API

**Create real test users with password auth** via Supabase admin API, bypassing Google OAuth entirely.

**The problem:** Google OAuth cannot be automated in E2E tests. Google actively blocks automated logins with CAPTCHAs, phone verification, and consent screen changes. Every community source confirms this is a dead end.

**The solution:**
1. Service role client calls `auth.admin.createUser({ email, password, email_confirm: true })`
2. Test signs in via Supabase REST API: `POST /auth/v1/token?grant_type=password`
3. Session tokens injected into browser `localStorage` before navigation
4. App's `hooks.server.ts` validates session normally -- it cannot distinguish password auth from Google OAuth
5. Teardown calls `auth.admin.deleteUser(userId)` to clean up

**Why this works with a Google-OAuth-only app:**
- Supabase auth supports multiple providers simultaneously at the API level
- Password auth does not need to be enabled in the app UI
- The app's server hooks validate JWT sessions regardless of provider
- A password-created session produces identical JWT claims

**Why NOT session token injection from manual login:**
- Requires a human to complete Google OAuth first
- Tokens expire (typically 1 hour), breaking CI
- Not reproducible or automatable

**Why NOT adding password auth to the app UI:**
- Pollutes production auth surface for testing convenience
- Security risk if accidentally left enabled

### Decision 3: Playwright Custom Fixtures for Test Isolation

**Use Playwright's `test.extend()` fixture system** for per-worker user isolation and data cleanup.

**Why fixtures over global setup:**
- Each Playwright worker gets its own isolated test user
- Fixture teardown guarantees cleanup even on test failure
- `testInfo.workerIndex` + `Date.now()` ensures unique emails across parallel workers
- Composable: `authenticatedPage` fixture depends on `testUser` fixture

**Conceptual fixture shape:**

```typescript
// tests/fixtures.ts
import { test as base, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';

type TestFixtures = {
  testUser: { id: string; email: string; password: string };
  authenticatedPage: Page;
};

export const test = base.extend<TestFixtures>({
  testUser: async ({}, use, testInfo) => {
    const adminClient = createClient(
      process.env.PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const email = `test-w${testInfo.workerIndex}-${Date.now()}@test.local`;
    const password = faker.internet.password({ length: 20 });

    const { data } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
    });

    await use({ id: data.user!.id, email, password });

    // Cleanup: delete user (FK cascades clean up related data)
    await adminClient.auth.admin.deleteUser(data.user!.id);
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Sign in via Supabase REST API
    const response = await page.request.post(
      `${process.env.PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        headers: { 'apikey': process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
        data: { email: testUser.email, password: testUser.password },
      }
    );
    const session = await response.json();

    // Inject session into browser localStorage
    await page.goto('/');
    await page.evaluate((sessionData) => {
      const storageKey = `sb-${new URL(sessionData.url).hostname.split('.')[0]}-auth-token`;
      localStorage.setItem(storageKey, JSON.stringify({
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
        // ... other session fields
      }));
    }, { ...session, url: process.env.PUBLIC_SUPABASE_URL });

    await page.reload();
    await use(page);
  },
});

export { expect } from '@playwright/test';
```

### Decision 4: Manual Pointer Events for DnD Testing

**Use `page.mouse` API** (mousedown/mousemove/mouseup) instead of `locator.dragTo()` for svelte-dnd-action.

**Why `locator.dragTo()` will not work:**
- svelte-dnd-action uses custom JavaScript pointer event handling, NOT native HTML5 drag-and-drop API
- `locator.dragTo()` dispatches HTML5 drag events (`dragstart`, `drag`, `dragend`)
- svelte-dnd-action listens for `pointerdown`, `pointermove`, `pointerup`
- The events do not overlap -- `locator.dragTo()` is silently ignored

**What works:**

```typescript
// tests/helpers/dnd.ts
import type { Locator, Page } from '@playwright/test';

export async function dragAndDrop(page: Page, source: Locator, target: Locator) {
  const sourceBox = (await source.boundingBox())!;
  const targetBox = (await target.boundingBox())!;

  const srcX = sourceBox.x + sourceBox.width / 2;
  const srcY = sourceBox.y + sourceBox.height / 2;
  const tgtX = targetBox.x + targetBox.width / 2;
  const tgtY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(srcX, srcY);
  await page.mouse.down();
  // Multiple intermediate moves trigger svelte-dnd-action's drag detection
  await page.mouse.move(tgtX, tgtY, { steps: 10 });
  await page.mouse.up();
}
```

**Confidence:** MEDIUM. This approach is well-documented for custom DnD libraries generally, and svelte-dnd-action's release notes mention Playwright testability improvements. But the exact move timing and step count may need tuning during implementation.

### Decision 5: Test Data Cleanup via FK Cascades + Admin Delete

**Delete the test user via admin API in fixture teardown.** Rely on Postgres foreign key CASCADE constraints to clean up related data (songs, setlists, band memberships, etc.).

**Why this works:**
- Supabase tables use `user_id` FK with `ON DELETE CASCADE` (standard pattern)
- Deleting the auth user cascades to profiles, songs, setlists, setlist_songs, etc.
- No need to manually delete each table's test data

**What needs verification:** Confirm that the database schema has `ON DELETE CASCADE` on the user_id foreign keys. If not, add a cleanup helper that deletes in dependency order before deleting the user.

**For multi-user tests (band invites):** Create multiple test users in a single fixture, clean up all of them in teardown.

## Installation

```bash
# Core testing stack
npm install -D @playwright/test @faker-js/faker dotenv

# Install Chromium browser binary (only Chromium for dev speed)
npx playwright install --with-deps chromium

# For CI, install all browsers:
# npx playwright install --with-deps
```

## Environment Variables

```bash
# .env.test (add to .gitignore, NEVER commit)
PUBLIC_SUPABASE_URL=https://your-TEST-project.supabase.co
PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...test-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...test-service-role-key...
TEST_BASE_URL=http://localhost:5173
```

**CRITICAL:** Use a DEDICATED TEST Supabase project. Never use production credentials. The service role key has full admin access and tests will create/delete users and data.

## File Structure

```
tests/
  fixtures.ts              # Custom Playwright fixtures (testUser, authenticatedPage)
  helpers/
    auth.ts                # Supabase auth helpers (sign in, session injection)
    data.ts                # Test data factories (createSong, createSetlist, createBand)
    dnd.ts                 # Drag-and-drop helper for svelte-dnd-action
    cleanup.ts             # Data cleanup utilities (if FK cascades are insufficient)
  e2e/
    auth.spec.ts           # Auth flow: redirect to /auth, callback handling
    songs.spec.ts          # Song CRUD: create, edit, delete, list
    setlists.spec.ts       # Setlist builder: create, add songs, DnD reorder
    bands.spec.ts          # Band workspaces: create, settings, songs, setlists
    band-invite.spec.ts    # Multi-user: invite flow, accept, permissions
    share.spec.ts          # Public share links: generate, view, access control
playwright.config.ts       # Playwright config with webServer, env loading
.env.test                  # Test environment variables (gitignored)
```

## Playwright Config

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,  // Serial in CI for stability
  reporter: process.env.CI ? 'github' : 'html',
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Add Firefox/WebKit later for cross-browser coverage
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
});
```

## package.json Scripts

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:headed": "playwright test --headed",
  "test:e2e:debug": "playwright test --debug"
}
```

## Confidence Assessment

| Decision | Confidence | Basis |
|----------|------------|-------|
| Playwright as E2E runner | HIGH | SvelteKit official docs, v1.58.2 verified on npm, dominant E2E tool |
| Service role auth bypass | HIGH | Supabase official docs, multiple community patterns, well-understood approach |
| Custom fixtures for isolation | HIGH | Playwright official docs, standard pattern for DB-backed E2E |
| Manual pointer events for DnD | MEDIUM | Community reports for custom DnD libs; svelte-dnd-action release notes mention Playwright compat. Needs tuning. |
| Dedicated test project vs local | MEDIUM | Operational preference. Local Supabase is equally valid if Docker is acceptable. |
| @faker-js/faker for test data | HIGH | Standard practice, v9.x actively maintained |
| dotenv for env loading | HIGH | Standard for non-framework Node.js scripts |
| FK cascade cleanup | MEDIUM | Depends on actual schema CASCADE constraints being in place. Verify. |

## Sources

- [Svelte Testing Docs](https://svelte.dev/docs/svelte/testing) - Official SvelteKit recommendation for Playwright
- [Playwright Release Notes](https://playwright.dev/docs/release-notes) - v1.58.2 current stable (verified via npm)
- [Playwright Auth State](https://playwright.dev/docs/auth) - Session persistence and injection patterns
- [Playwright Parallel Tests](https://playwright.dev/docs/test-parallel) - Worker isolation model
- [Supabase Testing Overview](https://supabase.com/docs/guides/local-development/testing/overview) - Application-level test guidance
- [Supabase Google OAuth Testing Discussion](https://github.com/orgs/supabase/discussions/9377) - Confirms Google OAuth cannot be automated
- [Login at Supabase via REST API in Playwright](https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test) - REST API auth bypass pattern
- [Testing Drag-and-Drop in Playwright](https://reflect.run/articles/how-to-test-drag-and-drop-interactions-in-playwright/) - Manual pointer event approach
- [Playwright DnD with BrowserStack](https://www.browserstack.com/guide/playwright-drag-and-drop) - Custom DnD library testing strategies
- [svelte-dnd-action GitHub](https://github.com/isaacHagoel/svelte-dnd-action) - Release notes mention Playwright testability fix
- [E2E Testing with SvelteKit and Playwright](https://www.okupter.com/blog/e2e-testing-with-sveltekit-and-playwright) - SvelteKit-specific Playwright setup
- [Database Rollback Strategies in Playwright](https://www.thegreenreport.blog/articles/database-rollback-strategies-in-playwright/database-rollback-strategies-in-playwright.html) - Data isolation approaches
