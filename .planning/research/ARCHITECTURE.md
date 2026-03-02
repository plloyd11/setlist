# Architecture: Playwright E2E Testing Infrastructure

**Domain:** E2E testing for SvelteKit + Supabase setlist-builder app
**Researched:** 2026-03-02
**Confidence:** HIGH

## Test Architecture Overview

```
playwright.config.ts          -- Config: webServer, projects, env loading
  |
  +-- tests/fixtures.ts       -- Custom fixtures: testUser, authenticatedPage
  |     |
  |     +-- helpers/auth.ts   -- Supabase admin API: create/delete users, sign in, inject session
  |     +-- helpers/data.ts   -- Data factories: createSong(), createSetlist(), createBand()
  |     +-- helpers/dnd.ts    -- DnD helper: manual pointer event sequence
  |     +-- helpers/cleanup.ts -- Cascade cleanup (if FK constraints insufficient)
  |
  +-- tests/e2e/*.spec.ts     -- Test files import custom `test` from fixtures.ts
        |
        +-- Supabase Test Project (dedicated, hosted)
              Auth + Postgres + RLS (identical schema to production)
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Playwright Config** | Dev server startup, browser config, env loading, worker parallelism | Vite dev server, `.env.test` |
| **Custom Fixtures** (`fixtures.ts`) | Per-worker test user lifecycle, authenticated page setup | Supabase admin API, browser localStorage |
| **Auth Helper** (`helpers/auth.ts`) | Create users, sign in via REST, inject session, delete users | Supabase REST API (`/auth/v1/token`, admin endpoints) |
| **Data Factories** (`helpers/data.ts`) | Create songs/setlists/bands with known test data | Supabase admin client (bypasses RLS) |
| **DnD Helper** (`helpers/dnd.ts`) | Simulate drag-and-drop via pointer events | `page.mouse` API |
| **Test Specs** (`e2e/*.spec.ts`) | User journey assertions | Browser via Playwright locators |
| **Supabase Test Project** | Identical schema + RLS, test data storage | Test fixtures (service role), app under test (anon key) |

### Data Flow

**Test User Lifecycle (per worker):**

```
1. Playwright spawns worker N
2. testUser fixture runs:
   a. Admin client creates user: POST /auth/v1/admin/users
      email: test-wN-{timestamp}@test.local
      password: random via faker
      email_confirm: true
   b. Returns { id, email, password }
3. authenticatedPage fixture runs:
   a. Signs in via REST: POST /auth/v1/token?grant_type=password
   b. Gets { access_token, refresh_token }
   c. Navigates to '/' (loads app shell)
   d. Injects session into localStorage:
      key: sb-{project-ref}-auth-token
      value: JSON { access_token, refresh_token, ... }
   e. Reloads page -- app reads session from localStorage
   f. App's hooks.server.ts validates JWT, user is authenticated
4. Test spec runs against authenticated page
5. Fixture teardown:
   a. Admin client deletes user: DELETE /auth/v1/admin/users/{id}
   b. FK CASCADE deletes all related data (songs, setlists, etc.)
```

**Multi-User Test Flow (band invites):**

```
1. Create two test users (User A, User B) in fixture
2. User A creates a band via the app UI
3. User A generates an invite link
4. Extract invite URL from User A's page
5. Open invite URL in User B's browser context
6. User B accepts invite
7. Assert: User B sees the band in their bands list
8. Assert: User A sees User B in the member list
9. Teardown: delete both users (cascades clean up band + membership)
```

**DnD Test Flow:**

```
1. Test creates a setlist with 3+ songs via data factory
2. Navigate to setlist detail page
3. Identify source song element (e.g., song at position 3)
4. Identify target position (e.g., before song at position 1)
5. Execute manual pointer sequence:
   a. page.mouse.move(sourceCenter)
   b. page.mouse.down()
   c. page.mouse.move(targetCenter, { steps: 10 })
   d. page.mouse.up()
6. Wait for svelte-dnd-action to settle (consider, drop animation)
7. Assert new order: song that was at position 3 is now at position 1
8. Reload page to verify persistence
```

## Patterns to Follow

### Pattern 1: Custom Fixtures Over Global Setup

**What:** Extend Playwright's `test` object with custom fixtures instead of using `globalSetup`/`globalTeardown`.

**When:** Always. Every test that needs auth or test data.

**Why:** Fixtures provide per-worker isolation, automatic cleanup on failure, and composability. Global setup creates shared state that breaks parallel execution.

```typescript
// tests/fixtures.ts
import { test as base, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';

type TestUser = { id: string; email: string; password: string };
type TestFixtures = {
  adminClient: SupabaseClient;
  testUser: TestUser;
  authenticatedPage: Page;
};

export const test = base.extend<TestFixtures>({
  adminClient: async ({}, use) => {
    const client = createClient(
      process.env.PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await use(client);
  },

  testUser: async ({ adminClient }, use, testInfo) => {
    const email = `test-w${testInfo.workerIndex}-${Date.now()}@test.local`;
    const password = faker.internet.password({ length: 20 });
    const { data, error } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);

    await use({ id: data.user.id, email, password });

    // Teardown: delete user, FK cascades clean related data
    await adminClient.auth.admin.deleteUser(data.user.id);
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    // Sign in via REST API
    const res = await page.request.post(
      `${process.env.PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        headers: {
          'apikey': process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
          'Content-Type': 'application/json',
        },
        data: { email: testUser.email, password: testUser.password },
      }
    );
    const session = await res.json();

    // Inject session into browser
    const projectRef = new URL(process.env.PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
    await page.goto('/');
    await page.evaluate(({ session, projectRef }) => {
      localStorage.setItem(
        `sb-${projectRef}-auth-token`,
        JSON.stringify(session)
      );
    }, { session, projectRef });
    await page.reload();

    // Verify auth took effect
    await page.waitForURL(/\/(dashboard|songs|setlists|bands)/);

    await use(page);
  },
});

export { expect } from '@playwright/test';
```

### Pattern 2: Data Factories via Service Role

**What:** Create test data directly in Supabase using the service role client (bypasses RLS) rather than clicking through the UI.

**When:** Any test that needs pre-existing data (songs, setlists, bands).

**Why:** Creating data via UI is slow and fragile. Service role inserts are fast and deterministic.

```typescript
// tests/helpers/data.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { faker } from '@faker-js/faker';

export async function createSong(client: SupabaseClient, userId: string, overrides = {}) {
  const song = {
    user_id: userId,
    title: faker.music.songName(),
    duration_seconds: faker.number.int({ min: 120, max: 360 }),
    notes: null,
    ...overrides,
  };
  const { data, error } = await client.from('songs').insert(song).select().single();
  if (error) throw new Error(`Failed to create song: ${error.message}`);
  return data;
}

export async function createSetlist(client: SupabaseClient, userId: string, overrides = {}) {
  const setlist = {
    user_id: userId,
    name: `Test Setlist ${faker.music.genre()}`,
    ...overrides,
  };
  const { data, error } = await client.from('setlists').insert(setlist).select().single();
  if (error) throw new Error(`Failed to create setlist: ${error.message}`);
  return data;
}

export async function createBandWithMember(
  client: SupabaseClient,
  ownerId: string,
  bandName?: string
) {
  const { data: band, error: bandError } = await client
    .from('bands')
    .insert({ name: bandName || faker.company.name(), owner_id: ownerId })
    .select()
    .single();
  if (bandError) throw new Error(`Failed to create band: ${bandError.message}`);

  const { error: memberError } = await client
    .from('band_members')
    .insert({ band_id: band.id, user_id: ownerId, role: 'owner' });
  if (memberError) throw new Error(`Failed to add owner as member: ${memberError.message}`);

  return band;
}
```

### Pattern 3: Manual Pointer Events for DnD

**What:** Use `page.mouse` API to simulate drag-and-drop instead of `locator.dragTo()`.

**When:** Any test involving svelte-dnd-action reordering.

```typescript
// tests/helpers/dnd.ts
import type { Locator, Page } from '@playwright/test';

export async function dragAndDrop(
  page: Page,
  source: Locator,
  target: Locator,
  options: { steps?: number; pauseMs?: number } = {}
) {
  const { steps = 10, pauseMs = 50 } = options;

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error('Source or target element not visible');
  }

  const srcX = sourceBox.x + sourceBox.width / 2;
  const srcY = sourceBox.y + sourceBox.height / 2;
  const tgtX = targetBox.x + targetBox.width / 2;
  const tgtY = targetBox.y + targetBox.height / 2;

  // Move to source, press, wait for drag detection threshold
  await page.mouse.move(srcX, srcY);
  await page.mouse.down();
  await page.waitForTimeout(pauseMs); // Allow svelte-dnd-action to detect drag start

  // Move to target with intermediate steps
  await page.mouse.move(tgtX, tgtY, { steps });

  await page.waitForTimeout(pauseMs); // Allow drop animation
  await page.mouse.up();
}
```

### Pattern 4: Test Spec Structure

**What:** Import custom `test` from fixtures, not from `@playwright/test` directly.

```typescript
// tests/e2e/songs.spec.ts
import { test, expect } from '../fixtures';

test.describe('Song Library', () => {
  test('can create a new song', async ({ authenticatedPage: page }) => {
    await page.goto('/songs/new');
    await page.getByLabel('Title').fill('Test Song');
    await page.getByLabel('Duration').fill('3:45');
    await page.getByRole('button', { name: 'Save' }).click();

    // Should redirect to songs list
    await expect(page).toHaveURL('/songs');
    await expect(page.getByText('Test Song')).toBeVisible();
  });

  test('rejects empty title', async ({ authenticatedPage: page }) => {
    await page.goto('/songs/new');
    await page.getByRole('button', { name: 'Save' }).click();

    // Should show validation error, not navigate away
    await expect(page).toHaveURL('/songs/new');
  });
});
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using Global Setup for Auth

**What:** Creating a single test user in `globalSetup` and sharing credentials across all workers.

**Why bad:** All workers share one user's data. Tests interfere with each other. One test deletes a song another test needs. Parallel execution becomes impossible without explicit locking.

**Instead:** Per-worker fixtures. Each worker gets its own user. Complete isolation.

### Anti-Pattern 2: Creating Data Through the UI

**What:** Every test starts by navigating to `/songs/new`, filling the form, saving, then navigating to the page it actually wants to test.

**Why bad:** Slow (full page loads + form interactions for setup), fragile (if the create form breaks, all tests fail), and violates test isolation (one test's setup is another test's concern).

**Instead:** Use data factories via service role client to insert directly. Only test the UI for the specific interaction under test.

### Anti-Pattern 3: Using `page.waitForTimeout()` for Synchronization

**What:** Adding `await page.waitForTimeout(1000)` after actions to "wait for things to settle."

**Why bad:** Either too long (slow tests) or too short (flaky on CI). Playwright's auto-waiting locators handle this correctly.

**Instead:** Use `await expect(locator).toBeVisible()`, `await page.waitForURL()`, or `await expect(locator).toHaveText()`. These auto-retry until the condition is met or timeout.

### Anti-Pattern 4: Testing Supabase Internals via E2E

**What:** Writing Playwright tests to verify RLS policies by trying SQL queries through the browser console.

**Why bad:** E2E tests the wrong layer for database policies. Failures are ambiguous (is it RLS? routing? auth? rendering?).

**Instead:** Test application behavior: "When User A navigates to User B's band URL, they see a 404 or redirect." Use pgTAP for direct RLS policy unit tests.

### Anti-Pattern 5: Hardcoded Test Data

**What:** Every test uses `email: 'test@test.com'`, `songName: 'My Song'`.

**Why bad:** Parallel workers collide on unique constraints. Tests depend on execution order. Leftover data from failed runs causes cascading failures.

**Instead:** Use faker for unique data. Include worker index and timestamp in emails.

## File Structure

```
project-root/
  playwright.config.ts         # Playwright config
  .env.test                    # Test env vars (gitignored)
  tests/
    fixtures.ts                # Custom test fixtures
    helpers/
      auth.ts                  # Auth helpers
      data.ts                  # Data factories
      dnd.ts                   # DnD helper
      cleanup.ts               # Cleanup utilities
    e2e/
      auth.spec.ts             # Auth redirect tests
      songs.spec.ts            # Song CRUD tests
      setlists.spec.ts         # Setlist builder tests
      bands.spec.ts            # Band workspace tests
      band-invite.spec.ts      # Multi-user invite flow
      share.spec.ts            # Public share link tests
```

## Sources

- [Playwright Test Fixtures](https://playwright.dev/docs/test-fixtures) -- Custom fixture patterns
- [Playwright Auth](https://playwright.dev/docs/auth) -- Session injection, storageState
- [Playwright Actions](https://playwright.dev/docs/input) -- Mouse actions for DnD
- [Supabase Admin API](https://supabase.com/docs/reference/javascript/auth-admin-createuser) -- User management
- [Playwright Parallelism](https://playwright.dev/docs/test-parallel) -- Worker isolation model
- App source: `src/hooks.server.ts`, `src/routes/auth/`, `src/lib/types/database.ts`
