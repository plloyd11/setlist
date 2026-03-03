# Architecture Patterns: Playwright E2E Testing Infrastructure

**Domain:** E2E test infrastructure for SvelteKit + Supabase app
**Researched:** 2026-03-02
**Overall confidence:** HIGH

## Recommended Architecture

### High-Level Structure

```
setlist/
  playwright.config.ts              # NEW - Playwright configuration
  e2e/                              # NEW - All E2E test infrastructure
    setup/
      auth.setup.ts                 # Global auth: creates test user, saves storageState
    fixtures/
      test.fixture.ts               # Extended test with auth + data helpers
    helpers/
      supabase-admin.ts             # Service-role client (bypasses RLS)
      test-user.ts                  # Test user creation, session injection
      seed.ts                       # Data factory functions
    pages/                          # Page Object Models
      songs.page.ts
      song-form.page.ts
      setlist-list.page.ts
      setlist-detail.page.ts
      bands.page.ts
      band-detail.page.ts
      band-invite.page.ts
      share.page.ts
      dashboard.page.ts
    tests/
      songs.spec.ts                 # Song CRUD
      setlists.spec.ts              # Setlist CRUD
      setlist-builder.spec.ts       # Drag-drop reorder, add/remove songs
      bands.spec.ts                 # Band CRUD, member management
      band-invite.spec.ts           # Invite flow (multi-user)
      share.spec.ts                 # Public share links (no auth)
      auth-guard.spec.ts            # Redirect behavior for unauthed users
    .auth/                          # GITIGNORED - storageState JSON files
      user.json
  .env.test                         # NEW - Test env vars (gitignored)
```

### New vs. Modified Files

**New files:**
- `playwright.config.ts` -- Playwright project configuration
- `e2e/` directory -- entire test infrastructure (all files above)
- `.env.test` -- Supabase local URL, anon key, service_role key

**Modified files:**
- `package.json` -- add `@playwright/test` devDependency, add `test:e2e` script
- `.gitignore` -- add `e2e/.auth/`, `.env.test`, `test-results/`, `playwright-report/`

**No production code changes required.** One recommended addition: `data-testid` attributes on draggable setlist song items for reliable drag-drop test selection. These are inert in production.

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `playwright.config.ts` | Projects, webServer, auth state paths, parallelism | Playwright runner |
| `auth.setup.ts` | One-time auth per run: create user, get session, save storageState | Supabase Auth Admin API, browser localStorage, filesystem |
| `supabase-admin.ts` | Service-role Supabase client for bypassing RLS in seed/cleanup | Supabase local Postgres |
| `test-user.ts` | Create/delete test users, get sessions programmatically | Supabase Auth Admin API |
| `seed.ts` | Factory functions: songs, setlists, setlist_songs, bands, band_members | supabase-admin.ts |
| `test.fixture.ts` | Playwright fixture: inject seeded data + cleanup into test lifecycle | seed.ts, test-user.ts |
| Page Objects | Encapsulate locators and user actions per page | Playwright Page API |
| Spec files | Test scenarios using fixtures + page objects | Everything above |

## Data Flow

### Authentication Flow (Setup Phase)

The critical challenge: production uses Google OAuth, which cannot be automated. Solution: create test users with email/password via Supabase Auth Admin API, then inject the session into browser storage.

```
auth.setup.ts runs once before all tests
  |
  +--> supabase.auth.admin.createUser({
  |      email: 'e2e-user@test.local',
  |      password: 'test-password-123',
  |      email_confirm: true          // Skip email verification
  |    })
  |
  +--> signInWithPassword(email, password)
  |      Returns: { access_token, refresh_token, ... }
  |
  +--> page.goto('/')
  |    page.evaluate(() => {
  |      localStorage.setItem('sb-localhost-auth-token', JSON.stringify(session))
  |    })
  |
  +--> page.goto('/dashboard')    // Forces server to read cookies
  |    Supabase @supabase/ssr sets auth cookies from the session
  |    hooks.server.ts sees valid session via safeGetSession()
  |
  +--> page.context().storageState({ path: 'e2e/.auth/user.json' })
         Saves cookies + localStorage for all subsequent tests
```

**Why this works with the existing hooks.server.ts:** The hook creates a Supabase server client from cookies (`getAll`/`setAll`). When the browser has a valid session in localStorage, `@supabase/ssr` syncs it to cookies on navigation. The hook's `safeGetSession()` calls `getUser()` which validates against Supabase Auth. No test-specific code paths needed.

### Per-Test Data Seeding Flow

```
test.fixture.ts (before each test)
  |
  +--> adminClient (service_role key, bypasses RLS)
  |      Insert songs with user_id = test user's ID
  |      Insert setlists, setlist_songs, bands, etc.
  |      Return { songIds, setlistId, ... } to the test
  |
  +--> Test runs: navigates pages, interacts with UI
  |    Page loaders see seeded data (RLS allows it for the test user)
  |
  +--> Fixture teardown (always runs, even on failure)
         adminClient.from('setlists').delete().eq('user_id', userId)
         adminClient.from('songs').delete().eq('user_id', userId)
         CASCADE handles child rows (setlist_songs, band_songs, etc.)
```

### Test Execution Pipeline

```
playwright.config.ts orchestrates:
  |
  +--> webServer starts: 'npm run build && npm run preview' on port 4173
  |
  +--> 'setup' project runs first:
  |      auth.setup.ts creates user + saves storageState
  |
  +--> 'chromium' project runs (depends on 'setup'):
         Each worker loads storageState from e2e/.auth/user.json
         Each spec:
           1. Fixture seeds data via service_role client
           2. Page already authenticated (storageState loaded)
           3. Page objects interact with UI
           4. Assertions verify outcomes
           5. Fixture cleans up seeded data
```

## Patterns to Follow

### Pattern 1: Setup Project for Auth State

**What:** Use Playwright's `setup` project dependency to authenticate once, share state across all tests via `storageState` JSON file.

**Why:** Every page behind the `(app)` route group requires auth. Logging in through UI for each test is slow and fragile (Google OAuth is not automatable). One programmatic auth creates state all tests reuse.

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';
import 'dotenv/config'; // loads .env.test

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testDir: './e2e/setup',
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
    env: {
      PUBLIC_SUPABASE_URL: process.env.PUBLIC_SUPABASE_URL!,
      PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    },
  },
});
```

### Pattern 2: Programmatic Auth via Supabase Admin API

**What:** Create test users with email/password using `supabase.auth.admin.createUser()`. No OAuth, no email confirmation, no UI interaction.

**Why:** Google OAuth is impossible to automate (CAPTCHAs, device verification, consent screen changes). Supabase local dev exposes a deterministic `service_role` key that grants Admin API access. Test users created this way are indistinguishable from real users at the RLS level.

```typescript
// e2e/helpers/test-user.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

// Admin client -- bypasses RLS, can manage users
export const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function createTestUser(email: string, password: string) {
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error && !error.message.includes('already been registered')) throw error;
  if (data?.user) return data.user;

  // User exists -- look up
  const { data: list } = await adminClient.auth.admin.listUsers();
  const user = list.users.find((u) => u.email === email);
  if (!user) throw new Error(`Could not find or create user: ${email}`);
  return user;
}

export async function getSession(email: string, password: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function deleteTestUser(userId: string) {
  await adminClient.auth.admin.deleteUser(userId);
}
```

### Pattern 3: localStorage Injection for Supabase Session

**What:** After getting a session from signInWithPassword, inject it into browser localStorage under the `sb-<ref>-auth-token` key. Then navigate to a protected page so @supabase/ssr establishes server-side cookies.

**Why:** Supabase SSR uses cookies on the server side (hooks.server.ts reads them), but the browser client reads from localStorage. Both must be present for the full auth flow to work. The existing `+layout.ts` creates either a browser or server client depending on `isBrowser()` -- localStorage is what the browser client checks.

```typescript
// e2e/setup/auth.setup.ts
import { test as setup, expect } from '@playwright/test';
import { createTestUser, getSession } from '../helpers/test-user';

const AUTH_FILE = 'e2e/.auth/user.json';
const TEST_EMAIL = 'e2e-primary@test.local';
const TEST_PASSWORD = 'test-password-secure-123';

setup('authenticate', async ({ page }) => {
  await createTestUser(TEST_EMAIL, TEST_PASSWORD);
  const session = await getSession(TEST_EMAIL, TEST_PASSWORD);

  // Navigate to public page first (no auth required)
  await page.goto('/');

  // Inject session into localStorage
  await page.evaluate((sessionData) => {
    // The key format for local Supabase: sb-127-auth-token or sb-localhost-auth-token
    // For local dev (127.0.0.1:54321), the ref is typically the hostname
    const keys = Object.keys(localStorage);
    // Clear any existing sb auth tokens
    keys.filter(k => k.startsWith('sb-')).forEach(k => localStorage.removeItem(k));
    // Set the new session -- use the project ref from the Supabase URL
    localStorage.setItem('sb-127-auth-token', JSON.stringify(sessionData));
  }, session);

  // Navigate to protected route to establish server-side cookies
  await page.goto('/dashboard');
  await page.waitForURL('/dashboard');

  // Verify we are authenticated
  await expect(page).not.toHaveURL(/\/auth/);

  // Save storage state
  await page.context().storageState({ path: AUTH_FILE });
});
```

**Important note on the localStorage key:** The exact key format depends on how Supabase local dev names its project ref. Running `supabase status` locally will show the API URL. The key format is `sb-<project-ref>-auth-token`. For local dev at `127.0.0.1:54321`, you may need to experiment -- check browser devtools on a manual login to find the exact key. This should be verified during implementation.

### Pattern 4: Service-Role Seeding with Factory Functions

**What:** Use the service_role Supabase client to insert test data directly, bypassing all RLS. Factory functions provide reusable data creation with sensible defaults.

**Why:** Test data must have specific `user_id` values to be visible through RLS. The service_role key bypasses RLS entirely, allowing insertion of data for any user. Factory functions avoid repetitive boilerplate across tests.

```typescript
// e2e/helpers/seed.ts
import { adminClient } from './test-user';

export async function seedSongs(userId: string, count = 3) {
  const songs = Array.from({ length: count }, (_, i) => ({
    user_id: userId,
    title: `Test Song ${Date.now()}-${i}`,
    duration_seconds: 180 + i * 30,
    notes: i === 0 ? 'First test song' : null,
  }));

  const { data, error } = await adminClient
    .from('songs')
    .insert(songs)
    .select();
  if (error) throw new Error(`seedSongs failed: ${error.message}`);
  return data!;
}

export async function seedSetlist(
  userId: string,
  songIds: string[] = [],
  overrides: Record<string, unknown> = {}
) {
  const { data: setlist, error } = await adminClient
    .from('setlists')
    .insert({
      user_id: userId,
      name: `Test Setlist ${Date.now()}`,
      ...overrides,
    })
    .select()
    .single();
  if (error) throw new Error(`seedSetlist failed: ${error.message}`);

  if (songIds.length > 0) {
    const { error: ssError } = await adminClient
      .from('setlist_songs')
      .insert(
        songIds.map((song_id, position) => ({
          setlist_id: setlist!.id,
          song_id,
          position,
        }))
      );
    if (ssError) throw new Error(`seedSetlistSongs failed: ${ssError.message}`);
  }

  return setlist!;
}

export async function seedBand(ownerId: string, memberIds: string[] = []) {
  const { data: band, error } = await adminClient
    .from('bands')
    .insert({
      name: `Test Band ${Date.now()}`,
      owner_id: ownerId,
    })
    .select()
    .single();
  if (error) throw new Error(`seedBand failed: ${error.message}`);

  // Add owner as member
  await adminClient.from('band_members').insert({
    band_id: band!.id,
    user_id: ownerId,
    role: 'owner',
  });

  // Add additional members
  for (const memberId of memberIds) {
    await adminClient.from('band_members').insert({
      band_id: band!.id,
      user_id: memberId,
      role: 'member',
    });
  }

  return band!;
}

export async function cleanupUserData(userId: string) {
  // Order matters for non-cascading FKs. CASCADE handles most children.
  // bands.owner_id is ON DELETE RESTRICT, so delete bands explicitly.
  await adminClient.from('bands').delete().eq('owner_id', userId);
  await adminClient.from('setlists').delete().eq('user_id', userId);
  await adminClient.from('songs').delete().eq('user_id', userId);
  await adminClient.from('profiles').delete().eq('id', userId);
}
```

### Pattern 5: Custom Playwright Fixtures for Data Lifecycle

**What:** Extend `test` with a custom fixture that provides seeded data and guarantees cleanup, even on test failure.

**Why:** Playwright fixtures are the correct abstraction for "setup before test, teardown after." Unlike `beforeEach`/`afterEach`, fixture teardown always executes. The `use()` callback pattern provides data to the test and defines the cleanup boundary.

```typescript
// e2e/fixtures/test.fixture.ts
import { test as base, expect } from '@playwright/test';
import { adminClient, createTestUser } from '../helpers/test-user';
import { seedSongs, seedSetlist, seedBand, cleanupUserData } from '../helpers/seed';

type SeedHelpers = {
  userId: string;
  seedSongs: (count?: number) => ReturnType<typeof seedSongs>;
  seedSetlist: (songIds?: string[], overrides?: Record<string, unknown>) => ReturnType<typeof seedSetlist>;
  seedBand: (memberIds?: string[]) => ReturnType<typeof seedBand>;
};

export const test = base.extend<{ seed: SeedHelpers }>({
  seed: async ({}, use, testInfo) => {
    // Look up the primary test user (created by auth.setup.ts)
    const { data: list } = await adminClient.auth.admin.listUsers();
    const user = list.users.find((u) => u.email === 'e2e-primary@test.local');
    if (!user) throw new Error('Test user not found. Did auth.setup.ts run?');

    const userId = user.id;

    // Provide seed helpers to the test
    await use({
      userId,
      seedSongs: (count) => seedSongs(userId, count),
      seedSetlist: (songIds, overrides) => seedSetlist(userId, songIds, overrides),
      seedBand: (memberIds) => seedBand(userId, memberIds),
    });

    // Teardown: clean all data created during the test
    await cleanupUserData(userId);
  },
});

export { expect };
```

**Usage in a spec file:**

```typescript
// e2e/tests/songs.spec.ts
import { test, expect } from '../fixtures/test.fixture';
import { SongsPage } from '../pages/songs.page';

test('can view seeded songs', async ({ page, seed }) => {
  const songs = await seed.seedSongs(3);
  const songsPage = new SongsPage(page);
  await songsPage.goto();

  for (const song of songs) {
    await expect(songsPage.getSongByTitle(song.title)).toBeVisible();
  }
});

test('can delete a song', async ({ page, seed }) => {
  const [song] = await seed.seedSongs(1);
  const songsPage = new SongsPage(page);
  await songsPage.goto();

  await songsPage.deleteSong(song.title);
  await expect(songsPage.getSongByTitle(song.title)).not.toBeVisible();
});
```

### Pattern 6: Page Objects -- Lean and Action-Oriented

**What:** One class per page or significant UI section. Encapsulate locators and user-facing actions. Return locators for assertions -- do not assert inside page objects.

**Why:** Playwright's official guidance. Keeps tests readable ("what does the user do, what do they see?") and page objects reusable across positive and negative test cases.

```typescript
// e2e/pages/setlist-detail.page.ts
import type { Page, Locator } from '@playwright/test';

export class SetlistDetailPage {
  readonly page: Page;
  readonly songItems: Locator;
  readonly addSongButton: Locator;
  readonly songPicker: Locator;
  readonly setlistName: Locator;
  readonly totalDuration: Locator;

  constructor(page: Page) {
    this.page = page;
    this.songItems = page.locator('[data-testid="setlist-song-item"]');
    this.addSongButton = page.getByRole('button', { name: /add/i });
    this.songPicker = page.getByRole('dialog');
    this.setlistName = page.getByRole('heading', { level: 1 });
    this.totalDuration = page.getByTestId('total-duration');
  }

  async goto(setlistId: string) {
    await this.page.goto(`/setlists/${setlistId}`);
  }

  async addSongFromLibrary(songTitle: string) {
    await this.addSongButton.click();
    await this.songPicker.getByText(songTitle).click();
  }

  async removeSong(songTitle: string) {
    const item = this.songItems.filter({ hasText: songTitle });
    await item.getByRole('button', { name: /remove|delete/i }).click();
  }

  getSongAtPosition(position: number): Locator {
    return this.songItems.nth(position);
  }

  getSongByTitle(title: string): Locator {
    return this.songItems.filter({ hasText: title });
  }
}
```

### Pattern 7: Drag-and-Drop for svelte-dnd-action

**What:** Use Playwright's low-level mouse API for drag-drop testing. svelte-dnd-action uses pointer events with a "consider" phase, not HTML5 drag events.

**Why:** `locator.dragTo()` fires HTML5 drag events which svelte-dnd-action does not listen to. The library uses `pointerdown` -> movement threshold -> `pointerup`. Must simulate this with `mouse.down()`, `mouse.move()` (with steps), `mouse.up()`.

```typescript
// e2e/pages/setlist-detail.page.ts (continued)
async reorderSong(fromIndex: number, toIndex: number) {
  const source = this.songItems.nth(fromIndex);
  const target = this.songItems.nth(toIndex);

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Elements not visible for drag');

  const srcX = sourceBox.x + sourceBox.width / 2;
  const srcY = sourceBox.y + sourceBox.height / 2;
  const tgtX = targetBox.x + targetBox.width / 2;
  const tgtY = targetBox.y + targetBox.height / 2;

  // Hover source, press, move in steps (triggers consider phase)
  await this.page.mouse.move(srcX, srcY);
  await this.page.mouse.down();

  // Two-phase move: midpoint then target (required for dragover in all browsers)
  await this.page.mouse.move(tgtX, (srcY + tgtY) / 2, { steps: 10 });
  await this.page.mouse.move(tgtX, tgtY, { steps: 10 });

  // Brief pause for svelte-dnd-action to process the finalize
  await this.page.waitForTimeout(200);
  await this.page.mouse.up();

  // Wait for the drop animation/transition to complete
  await this.page.waitForTimeout(400);
}
```

**Confidence:** MEDIUM. The exact timing and step counts for svelte-dnd-action may need tuning during implementation. The library's `flipDurationMs` and `dragDisabled` settings affect what the tests need. This is flagged as a pitfall area.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Automating Google OAuth UI

**What:** Driving Google's login page with Playwright.
**Why bad:** Google blocks bots (CAPTCHAs, 2FA prompts, device challenges). Breaks unpredictably. Cannot work in CI.
**Instead:** Email/password test users via Supabase Auth Admin API. Google OAuth is Google's concern, not something your E2E tests should validate.

### Anti-Pattern 2: Shared Mutable Test Data

**What:** All tests use the same pre-seeded songs/setlists.
**Why bad:** Test A deletes a song that Test B expects. Parallel workers corrupt shared state. Test ordering matters (fragile).
**Instead:** Each test seeds its own data via fixtures. Cleanup happens in fixture teardown. Tests are independent.

### Anti-Pattern 3: Resetting the Entire Database Between Tests

**What:** `TRUNCATE` all tables or `supabase db reset` before each test.
**Why bad:** Destroys parallelism completely. Slow (schema rebuild). Breaks other workers' in-flight tests.
**Instead:** Per-user data isolation. Each test creates data for a specific user_id and cleans only that user's data. RLS provides natural isolation -- one test user literally cannot see another's data.

### Anti-Pattern 4: Mocking Supabase in E2E

**What:** Intercepting Supabase API calls with MSW or `page.route()`.
**Why bad:** E2E tests exist to verify the full stack. Mocking the database makes RLS bugs, query errors, and migration issues invisible. You end up testing a fake version of your app.
**Instead:** Run `supabase start` locally. It gives you a real Postgres with real RLS, real Auth, real Storage. Tests hit the real stack.

### Anti-Pattern 5: Assertions Inside Page Objects

**What:** `songsPage.verifySongDeleted('My Song')` as a page object method.
**Why bad:** Mixes navigation logic with test expectations. Cannot reuse the page object for negative tests ("song should NOT be deleted"). Page objects become brittle.
**Instead:** Page objects return locators. Tests assert: `await expect(songsPage.getSongByTitle('My Song')).not.toBeVisible()`.

### Anti-Pattern 6: Using `dev` Server for E2E

**What:** `webServer: { command: 'npm run dev' }`.
**Why bad:** Dev server has HMR, source maps, unbundled modules. Not representative of production. Slower startup. Vite dev can have different behavior than built output.
**Instead:** `npm run build && npm run preview`. Tests run against the production build, catching build-time issues.

## Integration Points with Existing Architecture

### hooks.server.ts -- No Changes Required

The auth guard on lines 31-42 redirects unauthenticated requests to `/auth`. Tests bypass this naturally: storageState provides valid Supabase cookies, `safeGetSession()` returns a real session, and the guard passes. No test-only code paths, no env-var toggles.

### +layout.server.ts -- No Changes Required

The root layout loader returns `session`, `user`, and `cookies`. The test user's session flows through identically to a real user's. No special handling.

### +layout.ts (Browser Client) -- No Changes Required

The `isBrowser()` branch creates a browser Supabase client from the cookies provided by the server layout. storageState includes these cookies, so the client initializes with a valid session.

### +page.server.ts Loaders -- Tested Implicitly

Every test navigation exercises the loader. Data seeded via service_role with the correct `user_id` is visible through RLS. The loader queries work identically for test and real users.

### Form Actions -- Tested via UI Interaction

Tests fill forms and click buttons, which trigger SvelteKit form actions. The test verifies outcomes via UI state changes (list updates, redirects, success messages). This validates the full form action pipeline including SvelteKit's automatic data invalidation after actions.

### RLS Policies -- Validated as Side Effect

Because tests use real Supabase local with real RLS policies, any misconfiguration manifests as missing data or permission errors in tests. Multi-user band scenarios specifically exercise cross-user RLS.

### svelte-dnd-action -- Requires data-testid Attributes

The setlist builder's draggable items need `data-testid="setlist-song-item"` attributes for reliable test selection. This is the ONLY place production components need a minor addition. These attributes are harmless in production.

## Build Order (Dependency-Aware)

Each step can be verified before proceeding to the next:

| Order | Component | Depends On | Verification |
|-------|-----------|------------|--------------|
| 1 | `playwright.config.ts` + `package.json` scripts | Nothing | `npx playwright test --list` shows config loaded |
| 2 | `supabase-admin.ts` + `test-user.ts` | Supabase local running | Unit-test: create and delete a test user |
| 3 | `auth.setup.ts` | Steps 1-2 | `npx playwright test --project=setup` succeeds, `.auth/user.json` created |
| 4 | `seed.ts` factories | Step 2 | Call factories in a throwaway script, verify rows in Supabase Studio |
| 5 | `test.fixture.ts` | Steps 3-4 | Write a minimal spec that seeds + cleans; verify DB state before/after |
| 6 | First page object (`songs.page.ts`) | Nothing (pure locator wrappers) | N/A -- used by specs |
| 7 | First spec (`songs.spec.ts`) | Steps 1-6 | `npx playwright test songs` -- validates entire pipeline |
| 8 | Remaining page objects + specs | Pattern established | Parallel development of setlists, bands, dashboard, share |
| 9 | Drag-drop page object + spec | Setlist page object working | Most complex interaction -- needs tuning |
| 10 | Multi-user fixtures + band invite spec | Single-user tests working | Creates second test user, tests cross-user flows |
| 11 | CI integration (GitHub Actions) | All tests passing locally | `.github/workflows/e2e.yml` with `supabase start` |

**Rationale for ordering:**
- Steps 1-3 are the foundation: without config, admin client, and auth, nothing can run.
- Steps 4-5 provide the data layer that all tests need.
- Step 7 is the critical integration test: if songs.spec.ts works, the entire pipeline (config -> auth -> seed -> page object -> test -> cleanup) is proven.
- Steps 8-9 are independent of each other and can be built in any order.
- Step 10 requires additional auth state management (multiple users) so it builds on the single-user foundation.
- Step 11 is last because local must work before CI adds complexity.

## Parallel Test Isolation Strategy

```
All workers share one storageState (same test user)
  |
  Each test creates its own data via seed fixture:
    Test A: seeds songs [X, Y], setlist [S1]
    Test B: seeds songs [A, B, C], setlist [S2]
    Test C: seeds band [B1] with members
  |
  Each test cleans its own data in fixture teardown
```

For the current test suite size (likely 10-30 tests), a single shared test user with per-test seeded data is sufficient. Tests see each other's data (same user_id), but each test only interacts with its own named/timestamped data.

**If flakiness emerges from shared user:** Upgrade to per-worker users:
```
Worker 0: e2e-worker-0@test.local  -->  isolated by user_id + RLS
Worker 1: e2e-worker-1@test.local  -->  isolated by user_id + RLS
```
This requires creating storageState per worker rather than globally. Defer this complexity until needed.

**For band multi-user tests:** Create a second test user within the test fixture. User A owns the band, User B joins via invite. Both are cleaned up in teardown.

## Sources

- [Playwright Authentication Docs](https://playwright.dev/docs/auth) -- HIGH confidence (official docs)
- [Playwright Page Object Model Docs](https://playwright.dev/docs/pom) -- HIGH confidence (official docs)
- [Playwright Input/Drag Actions](https://playwright.dev/docs/input) -- HIGH confidence (official docs)
- [Supabase Local Development Docs](https://supabase.com/docs/guides/local-development) -- HIGH confidence (official docs)
- [Supabase Testing Overview](https://supabase.com/docs/guides/local-development/testing/overview) -- HIGH confidence (official docs)
- [Supabase Login via REST API in Playwright](https://mokkapps.de/blog/login-at-supabase-via-rest-api-in-playwright-e2e-test) -- MEDIUM confidence (community, verified pattern)
- [Supawright: Playwright test harness for Supabase](https://github.com/isaacharrisholt/supawright) -- MEDIUM confidence (evaluated; not recommended over custom approach for this project's simpler needs)
- [E2E Testing with SvelteKit and Playwright](https://www.okupter.com/blog/e2e-testing-with-sveltekit-and-playwright) -- MEDIUM confidence (community)
- [Svelte Testing Docs](https://svelte.dev/docs/svelte/testing) -- HIGH confidence (official docs)
- [Playwright Drag and Drop Guide](https://reflect.run/articles/how-to-test-drag-and-drop-interactions-in-playwright/) -- MEDIUM confidence (community, cross-referenced with official docs)
