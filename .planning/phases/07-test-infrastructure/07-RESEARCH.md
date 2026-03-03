# Phase 7: Test Infrastructure - Research

**Researched:** 2026-03-03
**Domain:** Playwright E2E test harness for SvelteKit + Supabase (auth bypass, fixtures, factories, cleanup)
**Confidence:** HIGH

## Summary

Phase 7 establishes a Playwright test harness where any test file can authenticate as an isolated test user and create test data without touching production. The core challenge is that production uses Google OAuth exclusively, which cannot be automated. The solution creates email/password test users via Supabase Admin API and authenticates them through a real email/password login form added to the auth page.

The user has made several decisions that differ from earlier milestone-level research: tests run against the **same** Supabase project (not a separate test project), authentication happens through the **actual login UI** (not REST API injection into localStorage), and cleanup is **per-test explicit** with worker teardown as a sweep (not solely per-worker). These decisions simplify operational overhead but require an email/password form on the auth page and careful cleanup ordering due to the `bands.owner_id ON DELETE RESTRICT` constraint.

**Primary recommendation:** Install `@playwright/test`, `@faker-js/faker`, and `dotenv`. Add an email/password form to the auth page (conditionally or always). Build worker-scoped fixtures that create users via admin API, authenticate through the UI, and save storageState. Build simple factory functions (`createSong`, `createSetlist`, `createBand`) that use the service role client. Handle cleanup ordering to delete bands before users.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Auth bypass strategy
- One test user per parallel worker (not per test) -- created via Supabase admin API as email/password user
- Tests authenticate by signing in through the actual login UI (email/password form) -- gives login flow coverage for free
- Tests run against the same Supabase project (not a separate test project) -- relies on cleanup
- Test user email format: descriptive pattern, e.g., `test-worker0-1709481234@setlist.test` -- easy to identify and query in Supabase dashboard

#### Test data factories
- Mixed approach: create data via Supabase API for speed, verify it appears correctly in the UI
- Realistic defaults for all fields -- factories fill every field (title, duration, key, tempo, etc.) so tests only override what they care about
- Factories return data AND navigate browser to the created item -- test starts ready to interact
- Simple naming: `createSong`, `createSetlist`, `createBand` -- no factory objects

#### Cleanup behavior
- Per-test cleanup: each test explicitly deletes the entities it created
- Worker teardown deletes the test user as a final sweep (CASCADE handles anything missed)
- Cleanup failures warn but don't fail the test run -- stale data may accumulate
- Manual cleanup script as safety net -- npm script to purge all test-* users and their data

#### Test organization
- Feature folders: `tests/auth/login.spec.ts`, `tests/songs/crud.spec.ts`, etc.
- Parallel execution by default -- matches one-user-per-worker isolation model
- Chromium only -- fast feedback loop, expand to other browsers later if needed
- Shared helpers in `tests/helpers/` (factories, auth, cleanup utilities)

### Claude's Discretion
- Playwright config details (timeouts, retries, reporter)
- Exact fixture implementation pattern
- How factory functions compose for complex scenarios (e.g., band with members and songs)
- Cleanup script implementation approach

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Playwright is configured with SvelteKit dev server and project-level setup | Playwright `webServer` config with `npm run dev`, port 5173, `reuseExistingServer: !process.env.CI`. Single `chromium` project. See Standard Stack and Code Examples sections. |
| INFRA-02 | Test users are created via Supabase admin API with per-worker isolation | Worker-scoped `testUser` fixture using `auth.admin.createUser()` with `email_confirm: true`. Email format: `test-worker{index}-{timestamp}@setlist.test`. See Architecture Patterns section. |
| INFRA-03 | Auth sessions are injected into browser via storageState (bypassing Google OAuth) | Worker-scoped `workerStorageState` fixture: creates user, opens browser, fills email/password form on `/auth` page, saves `storageState` to file. All tests in worker reuse the file. Requires adding email/password form to auth page. See Architecture Patterns section. |
| INFRA-04 | Test data factories can programmatically create songs, setlists, and bands | Factory functions use service role client (bypasses RLS) to insert data via Supabase API, then navigate the browser to the created item. See Code Examples section. |
| INFRA-05 | Test cleanup deletes user and cascades all related data after each worker | Per-test: explicit delete calls. Worker teardown: delete bands (RESTRICT constraint), then delete user (CASCADE handles rest). See Common Pitfalls section on RESTRICT constraint. |

</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | ^1.58.0 | E2E test runner, browser automation, assertions | SvelteKit official docs recommend Playwright. v1.58.2 is current stable. Built-in auto-waiting, parallel workers, storageState auth, HTML reporter. |
| `@supabase/supabase-js` | ^2.96.0 (already installed) | Service role admin client for test user/data CRUD | Already in the project. `auth.admin.createUser()` and `auth.admin.deleteUser()` handle user lifecycle. Service role client bypasses RLS for factory data. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@faker-js/faker` | ^9.0.0 | Generate unique, realistic test data | Song titles, band names, durations, keys -- parallel workers need unique data to avoid collisions |
| `dotenv` | ^16.4.0 | Load `.env.test` in Playwright config | Playwright config runs outside SvelteKit, so `$env/static/public` is unavailable. Loads `SUPABASE_SERVICE_ROLE_KEY` and other test vars. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@faker-js/faker` | Hardcoded unique strings with worker index | Faker gives realistic data and catches edge cases (long names, special chars). Worth the 1 extra dependency. |
| `dotenv` | Inline `process.env` with CI env vars only | dotenv lets devs use `.env.test` locally without exporting vars. Tiny dependency, big convenience. |
| `supawright` | Custom fixtures (chosen) | Supawright is a Playwright+Supabase harness but has unclear maintenance. Our factory/cleanup is ~100 lines of code. |

### Explicitly NOT Needed

| Library | Why Skip |
|---------|----------|
| `vitest` | Unit test runner -- out of scope for E2E milestone |
| `msw` (Mock Service Worker) | Tests must hit real Supabase to validate RLS policies. Mocking defeats E2E purpose. |
| `supabase` CLI (local stack) | User decided: same Supabase project, not local. No Docker dependency. |
| `@playwright/experimental-ct-svelte` | Component testing -- overkill for E2E |

**Installation:**
```bash
npm install -D @playwright/test @faker-js/faker dotenv
npx playwright install --with-deps chromium
```

## Architecture Patterns

### Recommended Project Structure

```
setlist/
  playwright.config.ts           # Playwright config (webServer, projects, env)
  tests/
    helpers/
      supabase-admin.ts          # Service-role Supabase client singleton
      auth.ts                    # Test user creation, login, session helpers
      factories.ts               # createSong, createSetlist, createBand
      cleanup.ts                 # Per-test + manual cleanup utilities
    fixtures.ts                  # Custom test.extend with testUser, authenticatedPage
    auth/
      login.spec.ts              # Auth flow tests (Phase 8, not Phase 7)
    songs/
      crud.spec.ts               # Song tests (Phase 8)
    smoke.spec.ts                # Phase 7 smoke test to verify harness works
  .auth/                         # GITIGNORED - storageState JSON files per worker
```

### Pattern 1: Worker-Scoped Test User with UI Login

**What:** Each Playwright worker creates one test user at startup, signs in through the real auth page email/password form, saves `storageState`, and reuses it for all tests in that worker.

**Why this pattern:** The user decided tests sign in through the actual login UI for free login flow coverage. Worker scope (not test scope) avoids repeated auth overhead.

**Implementation flow:**
1. Worker starts -- `testUser` fixture creates user via `auth.admin.createUser()`
2. `workerStorageState` fixture opens browser with no auth, navigates to `/auth`
3. Fills email + password fields, submits form
4. Waits for redirect to `/dashboard` (confirms login worked)
5. Saves `page.context().storageState()` to a file
6. All tests in worker use this storageState file automatically
7. Worker ends -- teardown deletes user

**Key insight:** This means the auth page needs an email/password login form. The current auth page (`/src/routes/auth/+page.svelte`) only has Google OAuth. A simple email/password form must be added. Options:
- **Always visible:** Add email/password alongside Google button. More production-like, gives users an alternative auth method.
- **Test-only (env gated):** Show email/password fields only when `PLAYWRIGHT_TEST=1` env var is set. Keeps production UI clean but adds conditional logic.

**Recommendation:** Add a real email/password form that is always visible. It is a legitimate auth method, Supabase supports it natively, and it avoids conditional test-only code paths. The form is ~20 lines of Svelte.

```typescript
// tests/fixtures.ts - Conceptual shape
import { test as base } from '@playwright/test';

type WorkerFixtures = {
  testUser: { id: string; email: string; password: string };
  workerStorageState: string;
};

export const test = base.extend<{}, WorkerFixtures>({
  // Override built-in storageState to use our worker-scoped file
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  testUser: [async ({}, use, workerInfo) => {
    const email = `test-worker${workerInfo.workerIndex}-${Date.now()}@setlist.test`;
    const password = faker.internet.password({ length: 20 });
    const { data } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    await use({ id: data.user!.id, email, password });
    // Teardown: delete bands first (RESTRICT), then user (CASCADE)
    await cleanupTestUser(data.user!.id);
  }, { scope: 'worker' }],

  workerStorageState: [async ({ browser, testUser }, use, workerInfo) => {
    const fileName = path.resolve('tests/.auth', `worker-${workerInfo.workerIndex}.json`);
    const page = await browser.newPage({ storageState: undefined });
    await page.goto('/auth');
    await page.getByLabel('Email').fill(testUser.email);
    await page.getByLabel('Password').fill(testUser.password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('**/dashboard');
    await page.context().storageState({ path: fileName });
    await page.close();
    await use(fileName);
  }, { scope: 'worker' }],
});
```

### Pattern 2: Factory Functions with Navigation

**What:** Factory functions create data via service role client AND navigate the browser to the created item.

**Why:** User decided: "Factories return data AND navigate browser to the created item -- test starts ready to interact."

```typescript
// tests/helpers/factories.ts - Conceptual shape
export async function createSong(page: Page, overrides?: Partial<SongInput>) {
  const song = {
    title: faker.music.songName(),
    duration_seconds: faker.number.int({ min: 120, max: 360 }),
    notes: faker.lorem.sentence(),
    user_id: testUserId,  // from fixture context
    ...overrides,
  };
  const { data } = await adminClient.from('songs').insert(song).select().single();
  await page.goto(`/songs`);  // Navigate to where the song is visible
  return data;
}
```

### Pattern 3: Per-Test Cleanup with Warning-Only Failures

**What:** Each test deletes its own data. Cleanup errors log warnings but don't fail the test.

```typescript
// In test
test('create and verify song', async ({ page }) => {
  const song = await createSong(page, { title: 'Test Song' });
  // ... test assertions ...
  // Cleanup
  await safeDelete('songs', song.id);
});

// tests/helpers/cleanup.ts
export async function safeDelete(table: string, id: string) {
  try {
    await adminClient.from(table).delete().eq('id', id);
  } catch (e) {
    console.warn(`Cleanup warning: failed to delete ${table}/${id}:`, e);
  }
}
```

### Anti-Patterns to Avoid

- **REST API + localStorage injection for auth:** User decided to use real UI login. Don't bypass the UI -- it catches real auth bugs.
- **Per-test user creation:** Too slow. One user per worker, reuse storageState.
- **Factory class objects / builder pattern:** User decided simple functions: `createSong`, not `SongFactory.create()`.
- **networkidle waits:** Supabase background requests defeat the heuristic. Wait for specific UI elements instead.
- **Shared global test data:** Each test creates its own data. Never depend on data from another test.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Unique test data | Manual string concatenation | `@faker-js/faker` | Realistic defaults, catches edge cases, unique per call |
| Browser automation | Custom Puppeteer scripts | `@playwright/test` | Auto-waiting, retrying assertions, parallel workers, trace viewer |
| Auth token management | Manual JWT creation/parsing | Supabase `auth.admin.createUser()` + UI login + `storageState` | Supabase handles JWT internally; storageState persists everything |
| RLS bypass in test setup | Custom SQL connections | Supabase service role client | `createClient(url, SERVICE_ROLE_KEY)` bypasses RLS automatically |

**Key insight:** The entire test infrastructure is glue code between Playwright fixtures and the Supabase admin API. No custom auth, no custom data layer, no mocking.

## Common Pitfalls

### Pitfall 1: `bands.owner_id ON DELETE RESTRICT` Blocks User Cleanup

**What goes wrong:** Worker teardown calls `auth.admin.deleteUser(userId)` to clean up. This cascades to songs, setlists, profiles, band_members -- but **not bands**. The `bands.owner_id` FK has `ON DELETE RESTRICT`, so if the test user owns any bands, the delete fails with a foreign key violation.
**Why it happens:** The schema deliberately prevents orphaned bands (losing the owner reference). This is correct for production but creates a cleanup ordering dependency.
**How to avoid:** Before deleting the test user, delete all bands they own:
```typescript
async function cleanupTestUser(userId: string) {
  // Delete bands first (RESTRICT constraint)
  await adminClient.from('bands').delete().eq('owner_id', userId);
  // Now delete user (CASCADE handles songs, setlists, profiles, band_members)
  await adminClient.auth.admin.deleteUser(userId);
}
```
**Warning signs:** Worker teardown logs foreign key violation errors. Test user accumulates in Supabase dashboard.
**Confidence:** HIGH -- verified by reading the migration file `20260221000000_create_band_tables.sql` line 23.

### Pitfall 2: Auth Page Missing Email/Password Form

**What goes wrong:** Tests try to fill email/password fields on `/auth` but the page only has a "Sign in with Google" button. Tests fail immediately.
**Why it happens:** The current `src/routes/auth/+page.svelte` only implements Google OAuth via `signInWithOAuth`. There is no email/password form.
**How to avoid:** Add an email/password form to the auth page before writing any tests. The form calls `supabase.auth.signInWithPassword({ email, password })`. This is a prerequisite for the entire test infrastructure.
**Warning signs:** `page.getByLabel('Email')` throws "element not found".
**Confidence:** HIGH -- verified by reading the current auth page source.

### Pitfall 3: RLS Silently Blocking Factory Data

**What goes wrong:** Factory functions use the anon/authenticated client instead of the service role client. RLS blocks inserts (no matching `auth.uid()`). Supabase returns empty results, not errors. Tests pass but test nothing.
**How to avoid:** All factory/cleanup helpers MUST use the service role client:
```typescript
const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
```
**Warning signs:** UI shows empty lists after factory setup. Tests pass but screenshots show no data.
**Confidence:** HIGH.

### Pitfall 4: storageState File Not Refreshed Across Runs

**What goes wrong:** A stale `.auth/worker-0.json` from a previous run contains an expired session. Tests start authenticated but fail mid-run when the token expires.
**How to avoid:** Delete `.auth/` directory contents at the start of each test run, or use unique filenames with timestamps. The worker fixture should always create fresh state.
**Warning signs:** First few tests pass, later tests get 401 errors or redirect to login.
**Confidence:** MEDIUM.

### Pitfall 5: Supabase Connection Pool Exhaustion

**What goes wrong:** Multiple parallel workers each create Supabase clients + the SvelteKit dev server holds connections. Total exceeds the project's connection limit.
**How to avoid:** In CI, limit workers to 1-2. Locally, the default worker count is fine. Reuse a single admin client per worker (module-level singleton).
**Warning signs:** Tests hang or fail with connection timeout errors.
**Confidence:** MEDIUM -- depends on Supabase plan limits.

### Pitfall 6: SvelteKit Hydration Race After Login Redirect

**What goes wrong:** After submitting the email/password form, the page redirects to `/dashboard`. Playwright sees the URL change but SvelteKit hasn't finished hydrating. Subsequent clicks fail.
**How to avoid:** After login redirect, wait for a specific element that proves hydration is complete:
```typescript
await page.waitForURL('**/dashboard');
await expect(page.getByText('Dashboard')).toBeVisible();
```
**Warning signs:** Intermittent "element not found" errors on the first action after login.
**Confidence:** HIGH.

## Code Examples

### Playwright Config for SvelteKit

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

**Config rationale:**
- `fullyParallel: true` -- matches one-user-per-worker isolation model
- `workers: 1` in CI -- avoids connection pool exhaustion on shared Supabase
- `retries: 2` in CI only -- catches flaky network issues without masking local bugs
- `reporter: 'html'` locally for interactive debugging, `'github'` in CI for inline annotations
- `webServer` uses `npm run dev` (not build+preview) for faster feedback. `reuseExistingServer` lets devs keep a dev server running.
- `timeout: 120_000` on webServer -- CI cold starts can be slow

### Supabase Admin Client Singleton

```typescript
// tests/helpers/supabase-admin.ts
import { createClient } from '@supabase/supabase-js';

if (!process.env.PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE env vars. Ensure .env.test is loaded.');
}

export const adminClient = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
```

### Test User Creation via Admin API

```typescript
// tests/helpers/auth.ts
import { adminClient } from './supabase-admin';
import { faker } from '@faker-js/faker';

export async function createTestUser(workerIndex: number) {
  const email = `test-worker${workerIndex}-${Date.now()}@setlist.test`;
  const password = faker.internet.password({ length: 20 });
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`Failed to create test user: ${error.message}`);
  return { id: data.user.id, email, password };
}

export async function deleteTestUser(userId: string) {
  // Must delete bands first -- owner_id has ON DELETE RESTRICT
  const { error: bandError } = await adminClient
    .from('bands')
    .delete()
    .eq('owner_id', userId);
  if (bandError) {
    console.warn(`Cleanup warning: failed to delete bands for user ${userId}:`, bandError.message);
  }

  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) {
    console.warn(`Cleanup warning: failed to delete user ${userId}:`, error.message);
  }
}
```

### Factory Functions (Simplified)

```typescript
// tests/helpers/factories.ts
import { adminClient } from './supabase-admin';
import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';

export async function createSong(
  page: Page,
  userId: string,
  overrides: Record<string, unknown> = {}
) {
  const defaults = {
    user_id: userId,
    title: faker.music.songName(),
    duration_seconds: faker.number.int({ min: 60, max: 600 }),
    notes: faker.lorem.sentence(),
  };
  const song = { ...defaults, ...overrides };
  const { data, error } = await adminClient.from('songs').insert(song).select().single();
  if (error) throw new Error(`Failed to create song: ${error.message}`);
  await page.goto('/songs');
  return data;
}

export async function createSetlist(
  page: Page,
  userId: string,
  overrides: Record<string, unknown> = {}
) {
  const defaults = {
    user_id: userId,
    name: `${faker.word.adjective()} ${faker.word.noun()} Set`,
    gig_date: faker.date.future().toISOString().split('T')[0],
    venue: faker.location.city(),
    target_seconds: faker.number.int({ min: 1800, max: 7200 }),
    transition_seconds: faker.number.int({ min: 0, max: 30 }),
  };
  const setlist = { ...defaults, ...overrides };
  const { data, error } = await adminClient.from('setlists').insert(setlist).select().single();
  if (error) throw new Error(`Failed to create setlist: ${error.message}`);
  await page.goto(`/setlists/${data.id}`);
  return data;
}

export async function createBand(
  page: Page,
  userId: string,
  overrides: Record<string, unknown> = {}
) {
  const defaults = {
    owner_id: userId,
    name: `${faker.music.genre()} ${faker.animal.type()}s`,
  };
  const band = { ...defaults, ...overrides };
  const { data, error } = await adminClient.from('bands').insert(band).select().single();
  if (error) throw new Error(`Failed to create band: ${error.message}`);
  // Also add owner as band_member (matches app behavior)
  await adminClient.from('band_members').insert({
    band_id: data.id,
    user_id: userId,
    role: 'owner',
  });
  await page.goto(`/bands/${data.id}`);
  return data;
}
```

### Per-Test Cleanup Helper

```typescript
// tests/helpers/cleanup.ts
import { adminClient } from './supabase-admin';

export async function safeDelete(table: string, id: string) {
  try {
    const { error } = await adminClient.from(table).delete().eq('id', id);
    if (error) console.warn(`Cleanup warning [${table}/${id}]:`, error.message);
  } catch (e) {
    console.warn(`Cleanup warning [${table}/${id}]:`, e);
  }
}
```

### Manual Cleanup Script

```typescript
// scripts/cleanup-test-users.ts
// Run via: npx tsx scripts/cleanup-test-users.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

const admin = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanup() {
  const { data: { users } } = await admin.auth.admin.listUsers();
  const testUsers = users.filter(u => u.email?.endsWith('@setlist.test'));
  console.log(`Found ${testUsers.length} test users to clean up`);

  for (const user of testUsers) {
    // Delete bands first (RESTRICT constraint)
    await admin.from('bands').delete().eq('owner_id', user.id);
    await admin.auth.admin.deleteUser(user.id);
    console.log(`Deleted: ${user.email}`);
  }
}

cleanup().catch(console.error);
```

### Email/Password Auth Form Addition

```svelte
<!-- Addition to src/routes/auth/+page.svelte -->
<!-- Email/Password form for direct sign-in -->
<form onsubmit={signInWithEmail} class="mt-4 space-y-3">
  <input
    type="email"
    bind:value={email}
    placeholder="Email"
    aria-label="Email"
    class="w-full rounded-lg border px-4 py-2 ..."
  />
  <input
    type="password"
    bind:value={password}
    placeholder="Password"
    aria-label="Password"
    class="w-full rounded-lg border px-4 py-2 ..."
  />
  <button type="submit" class="w-full rounded-lg bg-accent-500 py-2 ...">
    Sign in
  </button>
</form>

<script>
  // Add to existing script
  let email = $state('');
  let password = $state('');

  const signInWithEmail = async (e: Event) => {
    e.preventDefault();
    error = '';
    const { error: authError } = await page.data.supabase.auth.signInWithPassword({
      email, password
    });
    if (authError) {
      error = authError.message;
      return;
    }
    const redirectParam = page.url.searchParams.get('redirect');
    window.location.href = redirectParam
      ? decodeURIComponent(redirectParam)
      : '/dashboard';
  };
</script>
```

### Smoke Test (Validates Harness Works)

```typescript
// tests/smoke.spec.ts
import { test, expect } from './fixtures';

test('smoke: app loads and user is authenticated', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/dashboard/);
  // Confirms: webServer started, auth worked, storageState injected
});

test('smoke: can create and see a song via factory', async ({ page, testUser }) => {
  const song = await createSong(page, testUser.id, { title: 'Smoke Test Song' });
  await expect(page.getByText('Smoke Test Song')).toBeVisible();
  await safeDelete('songs', song.id);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global setup project for auth | Worker-scoped fixture with storageState | Playwright 1.46+ | Better isolation, no project dependency chain |
| `page.dragAndDrop()` | `page.mouse.down/move/up` for custom DnD libs | Always true for pointer-event libs | Required for svelte-dnd-action |
| `networkidle` waits | Element-specific auto-retrying assertions | Playwright best practices | Avoids hangs with Supabase background requests |
| Separate test DB/project | Same project with cleanup (user decision) | Project-specific | Simpler ops, requires careful cleanup |

## Open Questions

1. **Email/password form: always visible vs test-only?**
   - What we know: Supabase supports email/password alongside Google OAuth at the API level. No dashboard config change needed for admin-created users.
   - What's unclear: Whether the user wants a production-visible email/password form or a test-only conditional.
   - Recommendation: Add it as a real feature (always visible). It is simpler, avoids test-only code paths, and gives users an alternative to Google.

2. **Supabase email auth provider setting**
   - What we know: `auth.admin.createUser()` with `email_confirm: true` works regardless of which providers are enabled in the Supabase dashboard. The user is created at the database/API level.
   - What's unclear: Whether `signInWithPassword()` from the browser client requires the Email provider to be explicitly enabled in Supabase dashboard settings.
   - Recommendation: Verify during implementation. If needed, enable Email provider in the Supabase Auth settings (it can coexist with Google OAuth).

3. **Redirect after email/password login**
   - What we know: The current Google OAuth flow uses a callback route (`/auth/callback`) and a cookie-based redirect. Email/password login doesn't need a callback -- it completes in one request.
   - What's unclear: Exact redirect behavior after `signInWithPassword()` succeeds in the browser.
   - Recommendation: After successful `signInWithPassword()`, read the `redirect` query param and do a client-side navigation. Use `goto()` from `$app/navigation` or `window.location.href`.

4. **Factory navigation targets**
   - What we know: `createSong` should navigate to `/songs`, `createSetlist` to `/setlists/{id}`, `createBand` to `/bands/{id}`.
   - What's unclear: Whether the factory should wait for the created item to be visible in the UI after navigation, or just navigate.
   - Recommendation: Navigate and wait for the item to appear (auto-retrying `expect`). This catches rendering bugs early.

## Sources

### Primary (HIGH confidence)
- [Playwright Authentication Docs](https://playwright.dev/docs/auth) -- storageState, per-worker auth fixture pattern
- [Playwright Fixtures Docs](https://playwright.dev/docs/test-fixtures) -- `test.extend`, worker-scoped fixtures, tuple syntax
- [Playwright Web Server Config](https://playwright.dev/docs/test-webserver) -- `webServer` options, `reuseExistingServer`
- [Playwright Global Setup/Teardown](https://playwright.dev/docs/test-global-setup-teardown) -- project dependencies vs globalSetup
- [Supabase `auth.admin.createUser()`](https://supabase.com/docs/reference/javascript/auth-admin-createuser) -- test user creation API
- [Supabase `auth.admin.deleteUser()`](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) -- test user cleanup API
- [Supabase `signInWithPassword()`](https://supabase.com/docs/reference/javascript/auth-signinwithpassword) -- email/password auth for browser client
- [Supabase Password-Based Auth Guide](https://supabase.com/docs/guides/auth/passwords) -- enabling email/password alongside OAuth

### Secondary (MEDIUM confidence)
- [Playwright Release Notes](https://playwright.dev/docs/release-notes) -- v1.58.2 current stable, Chrome for Testing switch in v1.57
- [Supabase Cascade Deletes Guide](https://supabase.com/docs/guides/database/postgres/cascade-deletes) -- FK cascade behavior
- Prior milestone research: `.planning/research/STACK.md`, `.planning/research/E2E-ARCHITECTURE.md`, `.planning/research/PITFALLS.md` -- extensively verified patterns

### Codebase Verification (HIGH confidence)
- `/Users/pete/Desktop/dev/setlist/src/routes/auth/+page.svelte` -- confirmed Google-only OAuth, no email/password form
- `/Users/pete/Desktop/dev/setlist/src/hooks.server.ts` -- confirmed JWT validation is provider-agnostic
- `/Users/pete/Desktop/dev/setlist/supabase/migrations/20260221000000_create_band_tables.sql` line 23 -- confirmed `ON DELETE RESTRICT` on `bands.owner_id`
- All other FK references confirmed `ON DELETE CASCADE`

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- Playwright v1.58.2 verified, Supabase admin API well-documented
- Architecture: HIGH -- per-worker fixture pattern from official Playwright docs, adapted for UI login per user decision
- Pitfalls: HIGH -- `ON DELETE RESTRICT` constraint verified in schema, auth page gap verified in source
- Factories: MEDIUM -- composition for complex scenarios (band + members + songs) needs implementation tuning

**Research date:** 2026-03-03
**Valid until:** 2026-04-03 (stable domain, 30-day window)
