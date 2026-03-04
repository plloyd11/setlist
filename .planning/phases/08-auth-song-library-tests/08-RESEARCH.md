# Phase 8: Auth & Song Library Tests - Research

**Researched:** 2026-03-04
**Domain:** Playwright E2E tests for auth flows and song CRUD in SvelteKit + Supabase
**Confidence:** HIGH

## Summary

Phase 8 writes the first real E2E test files on top of the test infrastructure built in Phase 7. The infrastructure is already in place: worker-scoped test user creation via Supabase admin API, UI-based authentication with storageState persistence, factory functions (`createSong`, `createSetlist`, `createBand`), and safe cleanup utilities. This phase needs two test files: `auth.spec.ts` for authentication flows and `songs.spec.ts` for the full song library lifecycle.

The auth tests require testing both authenticated and unauthenticated states. The existing fixture system (`tests/fixtures.ts`) provides an authenticated `page` by default (via `workerStorageState`). For unauthenticated tests, tests must create a fresh browser context with `storageState: undefined` to bypass the worker's saved auth. The auth guard lives in `src/hooks.server.ts` and redirects unauthenticated requests to `/auth?redirect={returnUrl}`, preserving the return URL as a query parameter. Sign-out happens on the `/settings` page via `supabase.auth.signOut()` followed by `goto('/auth')`.

The song tests exercise the `/songs/new` form (add), inline editing on `/songs` via `SongRow.svelte` (edit), search via `SongSearch.svelte`, the context menu delete flow with `ConfirmDialog`, and "batch entry" (which means adding multiple songs sequentially on `/songs/new` since the form clears after each submission). All song CRUD uses standard form elements with accessible labels and roles, making Playwright locator strategies straightforward.

**Primary recommendation:** Write two test files using the existing fixture system. Auth tests need explicit `browser.newPage({ storageState: undefined })` for unauthenticated scenarios. Song tests use the `createSong` factory for setup and direct UI interaction for CRUD verification.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Auth test scenarios
- Unauthenticated user hitting protected route: verify redirect to login page AND that the return URL is preserved (user returns to original page after login)
- Session persistence: test that reloading the page keeps the user authenticated
- Logout: verify redirect to landing page AND that navigating to a protected route after logout redirects back to login
- Route coverage: test one representative protected route (e.g., /dashboard) -- if it works, they all work

#### Song CRUD coverage
- Test form validation: verify required fields show errors and invalid inputs are rejected
- Song editing: test full-form save (edit multiple fields at once), not individual field edits
- Search: test search by title only -- create songs, search, verify correct results
- Batch entry: enter multiple songs via batch, verify each appears in the library with correct title and duration

#### Test organization
- File structure: one file per feature area (auth.spec.ts, songs.spec.ts)
- Naming convention: BDD-style "should [verb] when [condition]" pattern
- Test independence: each test is fully independent -- own login, own data, no shared state between tests
- No Page Object Model -- use direct locators (page.getByRole(), page.locator()) in tests

#### Failure & edge cases
- Negative testing: key validations only -- test empty required field (title) and one invalid value to confirm validation works
- Delete confirmation: test the full dialog flow -- verify dialog appears, cancel preserves the song, confirm deletes it
- Empty state: verify empty library state message/UI shows for a fresh user with no songs
- Delete persistence: after deleting a song, reload the page and verify it's still gone

### Claude's Discretion
- Exact test data values (song titles, durations)
- Test timeout configuration
- Whether to use test.describe grouping within feature files
- Assertion specificity (exact text vs contains)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | Unauthenticated user visiting protected routes is redirected to login | Auth guard in `hooks.server.ts` redirects to `/auth?redirect={returnUrl}`. Test: create page with `storageState: undefined`, navigate to `/dashboard`, assert URL contains `/auth` with redirect param. |
| AUTH-02 | Authenticated user can access dashboard and all app routes | Default fixture provides authenticated `page` via `workerStorageState`. Test: navigate to `/dashboard`, assert no redirect occurs and page content loads. |
| AUTH-03 | User can log out and is redirected appropriately | Sign-out button on `/settings` page calls `supabase.auth.signOut()` then `goto('/auth')`. Test: navigate to settings, click sign-out, verify redirect. |
| SONG-01 | User can add a song with name and duration | `/songs/new` form with title (required), duration (required, mm:ss), notes (optional). Server action validates and inserts. Form clears on success with toast. |
| SONG-02 | User can edit an existing song's details | Inline editing in `SongRow.svelte`: click song row to enter edit mode, modify title/duration/notes fields, click save (checkmark) or press Enter. Uses Supabase client directly. |
| SONG-03 | User can delete a song from their library | Context menu (right-click/long-press) > Delete > ConfirmDialog. Hidden form submits `?/delete` action. Toast on success. |
| SONG-04 | User can search/filter songs by title | `SongSearch.svelte`: toggle search with button, type in text input, client-side filter on title. Search is expanded by clicking the search icon button. |
| SONG-05 | User can batch-add multiple songs | Batch = sequential adds on `/songs/new`. Form clears after each success (`update({ reset: true })`). Test: add multiple songs, navigate to `/songs`, verify all appear. |

</phase_requirements>

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | ^1.58.2 | Test runner, browser automation, assertions | Already installed in Phase 7. Provides `test`, `expect`, `page`, `browser` fixtures. |
| `@faker-js/faker` | ^10.3.0 | Generate unique test data | Already installed in Phase 7. Used by factories for song titles, durations. |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `dotenv` | (in playwright.config.ts) | Loads `.env.test` for Supabase credentials | Already configured. No changes needed. |

### No New Dependencies Needed

Phase 8 writes test files only. All infrastructure and dependencies were established in Phase 7.

## Architecture Patterns

### Existing Test File Structure
```
tests/
├── fixtures.ts              # Worker-scoped auth fixtures (testUser, workerStorageState)
├── smoke.spec.ts            # Smoke tests from Phase 7
├── helpers/
│   ├── supabase-admin.ts    # Service role client singleton
│   ├── auth.ts              # createTestUser, deleteTestUser
│   ├── cleanup.ts           # safeDelete utility
│   └── factories.ts         # createSong, createSetlist, createBand
└── .auth/                   # Generated worker auth state files
```

### New Files for Phase 8
```
tests/
├── auth.spec.ts             # Auth flow tests (AUTH-01, AUTH-02, AUTH-03)
└── songs.spec.ts            # Song library tests (SONG-01 through SONG-05)
```

### Pattern 1: Authenticated Test (Default)
**What:** Most tests use the worker's pre-authenticated page
**When to use:** Any test that needs a logged-in user
**Example:**
```typescript
// Source: existing tests/smoke.spec.ts pattern
import { test, expect } from './fixtures';

test('should display songs page when authenticated', async ({ page }) => {
    // page is already authenticated via workerStorageState
    await page.goto('/songs');
    await expect(page).toHaveURL(/songs/);
});
```

### Pattern 2: Unauthenticated Test (Override storageState)
**What:** Tests that need a fresh browser without auth cookies
**When to use:** Testing auth redirects, login flow
**Example:**
```typescript
import { test, expect } from './fixtures';

test('should redirect to login when unauthenticated', async ({ browser }) => {
    // Create a fresh context with NO auth state
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth\?redirect=/);

    await context.close();
});
```

### Pattern 3: Context Menu Interaction
**What:** Opening context menu to access Edit/Delete actions on songs
**When to use:** Song delete and edit-via-context-menu tests
**Example:**
```typescript
// SongRow uses oncontextmenu (right-click) to show ContextMenu
// Then ContextMenu renders menu items as positioned div
await songRow.click({ button: 'right' });
await page.getByText('Delete').click();
// ConfirmDialog appears as <dialog> element
await page.getByRole('button', { name: 'Delete' }).click();
```

### Pattern 4: Song Edit via Inline Row Click
**What:** Clicking a song row enters edit mode directly (no context menu needed)
**When to use:** Song editing tests
**Example:**
```typescript
// SongRow.svelte: clicking the row button calls enterEdit()
// This switches the row to edit mode with input fields
await page.getByText('Original Title').click();
// Now in edit mode - fill the inputs
await page.locator('input[placeholder="Song title"]').fill('Updated Title');
await page.locator('input[placeholder="3:45"]').fill('4:30');
// Save via checkmark button
await page.getByLabel('Save').click();
```

### Pattern 5: Factory + Cleanup Per Test
**What:** Each test creates its own data and cleans up after
**When to use:** Every song test
**Example:**
```typescript
import { test, expect } from './fixtures';
import { createSong } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';

test('should edit song details', async ({ page, testUser }) => {
    const song = await createSong(page, testUser.id, { title: 'Before Edit' });

    // ... test interaction ...

    await safeDelete('songs', song.id);
});
```

### Anti-Patterns to Avoid
- **Shared state between tests:** Each test must create its own data. Never rely on data from another test.
- **Using `page` fixture for unauthenticated tests:** The default `page` has storageState injected. Use `browser.newContext({ storageState: undefined })` instead.
- **Locating by CSS class:** Use `getByRole()`, `getByLabel()`, `getByText()`, `getByPlaceholder()` for resilient selectors.
- **Forgetting to close contexts:** When creating new contexts for unauth tests, always `await context.close()` to avoid resource leaks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test user creation | Manual Supabase SQL | Existing `createTestUser()` in `tests/helpers/auth.ts` | Already handles email format, password generation, email confirmation |
| Song creation for tests | Navigating UI to add songs | Existing `createSong()` factory | API-based creation is faster and more reliable for test setup |
| Auth state management | Manual cookie/token injection | Existing `workerStorageState` fixture | Handles full auth flow, cookie serialization, file persistence |
| Cleanup | Manual delete calls | Existing `safeDelete()` helper | Warns instead of throwing, prevents cleanup from failing tests |

## Common Pitfalls

### Pitfall 1: Unauthenticated Page Using Default storageState
**What goes wrong:** Tests for auth redirects pass even when they shouldn't because the page is already authenticated.
**Why it happens:** The `page` fixture from `fixtures.ts` injects `workerStorageState` automatically.
**How to avoid:** Always use `browser.newContext({ storageState: undefined })` for unauthenticated scenarios.
**Warning signs:** Auth redirect tests pass suspiciously without the expected URL change.

### Pitfall 2: Sign-Out Redirects to /auth, Not Landing Page
**What goes wrong:** The context document says "verify redirect to landing page" but the actual code redirects to `/auth`.
**Why it happens:** `settings/+page.svelte` calls `goto('/auth')` after sign-out, not `goto('/')`.
**How to avoid:** Test should assert redirect to `/auth` (the actual behavior), not `/` (the landing page). The `/auth` page IS the appropriate post-logout destination since unauthenticated users on `/` get the landing page, not the login form.
**Warning signs:** Test expects `/` but sees `/auth`.

### Pitfall 3: Context Menu Requires Right-Click
**What goes wrong:** Tests try to find Edit/Delete buttons directly on the song row.
**Why it happens:** The context menu is a separate component triggered by right-click (`oncontextmenu`), not visible by default.
**How to avoid:** Right-click the song row first (`click({ button: 'right' })`), then interact with the context menu items.
**Warning signs:** "Delete" or "Edit" text not found on page.

### Pitfall 4: Edit Mode via Row Click vs Context Menu
**What goes wrong:** Confusion about how to enter edit mode.
**Why it happens:** There are TWO ways to enter edit mode: (1) click the song row directly (calls `enterEdit()`), or (2) right-click > Edit from context menu (sets `editingSongId`).
**How to avoid:** For edit tests, the simplest path is clicking the song row directly. Context menu "Edit" also works.
**Warning signs:** N/A -- both approaches work.

### Pitfall 5: Song Delete Uses Hidden Form + ConfirmDialog
**What goes wrong:** Tests try to directly submit a delete request or click a visible delete button.
**Why it happens:** Delete flow is: right-click > context menu "Delete" > ConfirmDialog > "Delete" button. The actual form submission is via a hidden `<form>` with `use:enhance`.
**How to avoid:** Follow the full UI flow: right-click, click "Delete" in context menu, click "Delete" in confirm dialog.
**Warning signs:** Song not deleted after test.

### Pitfall 6: Search Toggle Must Be Expanded First
**What goes wrong:** Tests try to fill the search input but it doesn't exist in the DOM.
**Why it happens:** `SongSearch` is wrapped in `{#if expanded}` and toggled by the search icon button.
**How to avoid:** Click the search toggle button (`aria-label="Toggle search"`) before trying to fill the search input.
**Warning signs:** Search input locator times out.

### Pitfall 7: Empty Library Has No Search Toggle
**What goes wrong:** Tests try to click the search toggle when no songs exist.
**Why it happens:** The search toggle and SongSearch only render when `{#if hasSongs}` is true.
**How to avoid:** Create songs first before testing search functionality.
**Warning signs:** Search toggle button not found.

### Pitfall 8: ConfirmDialog Button Text is "Delete" (Same as Context Menu)
**What goes wrong:** Ambiguity between "Delete" in context menu and "Delete" in confirm dialog.
**Why it happens:** Both use the text "Delete".
**How to avoid:** After clicking "Delete" in context menu, the context menu closes and the dialog opens. Use `page.getByRole('button', { name: 'Delete' })` for the dialog button (it's inside a `<dialog>` element). Alternatively, scope: `page.locator('dialog').getByRole('button', { name: 'Delete' })`.
**Warning signs:** Wrong "Delete" clicked, dialog never opens or closes prematurely.

### Pitfall 9: Batch Entry Is Sequential Single-Song Adds
**What goes wrong:** Tests look for a multi-song batch input or paste feature.
**Why it happens:** "Batch entry" in this app means: add a song on `/songs/new`, form clears, add another song, repeat.
**How to avoid:** Test batch entry by navigating to `/songs/new`, filling and submitting the form multiple times, then verifying all songs appear on `/songs`.
**Warning signs:** Looking for a textarea or multi-row input that doesn't exist.

## Code Examples

### Auth: Unauthenticated Redirect with Return URL Preservation
```typescript
// hooks.server.ts redirects to: /auth?redirect={encodeURIComponent(pathname + search)}
test('should redirect unauthenticated user to login with return URL', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/auth/);

    const url = new URL(page.url());
    const redirect = url.searchParams.get('redirect');
    expect(redirect).toBe('/dashboard');

    await context.close();
});
```

### Auth: Session Persistence After Reload
```typescript
test('should maintain session after page reload', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/);

    await page.reload();
    await expect(page).toHaveURL(/dashboard/);
    // Verify actual content loaded (not just URL)
    await expect(page.getByText('Welcome back')).toBeVisible();
});
```

### Auth: Sign Out and Post-Logout Protection
```typescript
test('should redirect to auth page after sign out', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page).toHaveURL(/\/auth/);
});
```

### Songs: Add Single Song via Form
```typescript
test('should add a song with title and duration', async ({ page }) => {
    await page.goto('/songs/new');

    await page.getByLabel('Title').fill('Test Song Alpha');
    await page.getByLabel('Duration').fill('3:45');
    await page.getByRole('button', { name: 'Add Song' }).click();

    // Form clears on success (batch entry behavior)
    await expect(page.getByLabel('Title')).toHaveValue('');

    // Verify song appears in library
    await page.goto('/songs');
    await expect(page.getByText('Test Song Alpha')).toBeVisible();
});
```

### Songs: Edit Inline (Click Row to Enter Edit Mode)
```typescript
test('should edit song details via inline edit', async ({ page, testUser }) => {
    const song = await createSong(page, testUser.id, {
        title: 'Original Title',
        duration_seconds: 225  // 3:45
    });

    // Click song row to enter edit mode
    await page.getByText('Original Title').click();

    // Edit fields
    await page.locator('input[placeholder="Song title"]').fill('Updated Title');
    await page.locator('input[placeholder="3:45"]').fill('4:30');

    // Save
    await page.getByLabel('Save').click();

    // Verify updated values
    await expect(page.getByText('Updated Title')).toBeVisible();
    await expect(page.getByText('4:30')).toBeVisible();

    await safeDelete('songs', song.id);
});
```

### Songs: Delete with Confirm Dialog
```typescript
test('should delete song after confirming dialog', async ({ page, testUser }) => {
    const song = await createSong(page, testUser.id, { title: 'Song to Delete' });

    // Right-click to open context menu
    await page.getByText('Song to Delete').click({ button: 'right' });
    await page.getByText('Delete').click();  // Context menu item

    // ConfirmDialog appears
    await expect(page.locator('dialog')).toBeVisible();
    await page.locator('dialog').getByRole('button', { name: 'Delete' }).click();

    // Verify song is gone
    await expect(page.getByText('Song to Delete')).not.toBeVisible();
});
```

### Songs: Search by Title
```typescript
test('should filter songs by search query', async ({ page, testUser }) => {
    const song1 = await createSong(page, testUser.id, { title: 'Alpha Song' });
    // Navigate back to /songs (factory navigates there, but second factory call replaces)
    const song2 = await createSong(page, testUser.id, { title: 'Beta Song' });

    // Expand search
    await page.getByLabel('Toggle search').click();
    await page.getByPlaceholder('Search songs...').fill('Alpha');

    // Verify filter
    await expect(page.getByText('Alpha Song')).toBeVisible();
    await expect(page.getByText('Beta Song')).not.toBeVisible();

    await safeDelete('songs', song1.id);
    await safeDelete('songs', song2.id);
});
```

### Songs: Batch Entry (Sequential Adds)
```typescript
test('should add multiple songs via batch entry', async ({ page }) => {
    await page.goto('/songs/new');

    // Add first song
    await page.getByLabel('Title').fill('Batch Song One');
    await page.getByLabel('Duration').fill('2:30');
    await page.getByRole('button', { name: 'Add Song' }).click();
    await expect(page.getByLabel('Title')).toHaveValue('');  // Form cleared

    // Add second song (still on /songs/new)
    await page.getByLabel('Title').fill('Batch Song Two');
    await page.getByLabel('Duration').fill('4:15');
    await page.getByRole('button', { name: 'Add Song' }).click();
    await expect(page.getByLabel('Title')).toHaveValue('');

    // Verify both in library
    await page.goto('/songs');
    await expect(page.getByText('Batch Song One')).toBeVisible();
    await expect(page.getByText('Batch Song Two')).toBeVisible();
});
```

### Songs: Empty State
```typescript
test('should show empty state when no songs exist', async ({ page }) => {
    await page.goto('/songs');
    await expect(page.getByText('Your song library is empty')).toBeVisible();
    await expect(page.getByText('Add your first song')).toBeVisible();
});
```

## Key UI Locators Reference

This section maps each interactive element to its recommended Playwright locator.

### Auth Page (`/auth`)
| Element | Locator |
|---------|---------|
| Email input | `page.getByLabel('Email')` |
| Password input | `page.getByLabel('Password')` |
| Sign in button | `page.getByRole('button', { name: /sign in with email/i })` |

### Songs List (`/songs`)
| Element | Locator |
|---------|---------|
| Page heading | `page.getByRole('heading', { name: 'Songs' })` |
| Add song link | `page.getByLabel('Add song')` |
| Search toggle | `page.getByLabel('Toggle search')` |
| Search input | `page.getByPlaceholder('Search songs...')` |
| Song row | `page.getByText('Song Title')` (within the list) |
| Empty state text | `page.getByText('Your song library is empty')` |
| Context menu Delete | `page.getByText('Delete')` (after right-click) |
| Confirm dialog | `page.locator('dialog')` |
| Confirm Delete button | `page.locator('dialog').getByRole('button', { name: 'Delete' })` |
| Confirm Cancel button | `page.locator('dialog').getByRole('button', { name: 'Cancel' })` |

### Add Song Form (`/songs/new`)
| Element | Locator |
|---------|---------|
| Title input | `page.getByLabel('Title')` |
| Duration input | `page.getByLabel('Duration')` |
| Notes textarea | `page.getByLabel(/Notes/)` |
| Submit button | `page.getByRole('button', { name: 'Add Song' })` |
| Error message | `page.getByText(errorMessage)` |

### Song Edit Mode (inline on `/songs`)
| Element | Locator |
|---------|---------|
| Title input | `page.locator('input[placeholder="Song title"]')` |
| Duration input | `page.locator('input[placeholder="3:45"]')` |
| Notes input | `page.locator('input[placeholder="Notes (optional)"]')` |
| Save button | `page.getByLabel('Save')` |
| Cancel button | `page.getByLabel('Cancel')` |
| Edit error | `page.locator('.text-danger-500')` |

### Settings Page (`/settings`)
| Element | Locator |
|---------|---------|
| Sign out button | `page.getByRole('button', { name: /sign out/i })` |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `page.click()` + CSS selectors | `page.getByRole()`, `page.getByLabel()` | Playwright 1.27+ | More resilient to UI changes, recommended by Playwright docs |
| `page.waitForSelector()` | Auto-waiting built into all locator actions | Playwright 1.0+ | No manual waits needed; `expect(locator).toBeVisible()` auto-waits |
| `test.beforeAll` for shared data | Per-test factories + cleanup | Current best practice | Ensures test independence, enables parallel execution |

## Open Questions

1. **Sign-out redirect destination mismatch**
   - What we know: The CONTEXT.md says "verify redirect to landing page" but `settings/+page.svelte` calls `goto('/auth')` after sign-out
   - What's unclear: Whether the user considers `/auth` the "landing page" in this context or wants the actual landing page (`/`)
   - Recommendation: Test the actual behavior (`/auth` redirect). The auth page IS the correct post-logout destination. Note this in test comments.

2. **Post-sign-out protected route test**
   - What we know: The context asks to "verify navigating to a protected route after logout redirects back to login"
   - What's unclear: After `goto('/auth')` from sign-out, the browser still has the same context. Need to verify the session is actually invalidated.
   - Recommendation: After sign-out redirect to `/auth`, navigate to `/dashboard` and verify it redirects back to `/auth`. This confirms the session was truly destroyed.

3. **Batch entry cleanup**
   - What we know: Batch entry tests add songs through the UI (not factory), so we don't get back song IDs for cleanup
   - What's unclear: Whether to query for songs after the test to clean them up, or rely on worker teardown CASCADE
   - Recommendation: Rely on worker teardown CASCADE for batch entry tests. The test user deletion will CASCADE all songs. Alternatively, use the admin client to query and delete songs by title after the test.

4. **Form validation error display**
   - What we know: The `/songs/new` server action returns `fail(400, { error: 'Title is required' })` and the page displays `{form?.error}`
   - What's unclear: Whether HTML5 `required` attribute prevents form submission before the server action fires, which would mean the server-side validation error never shows
   - Recommendation: Test HTML5 validation by checking that the form doesn't submit with empty required fields. For the server-side validation test of duration format, the HTML `pattern` attribute also does client-side validation. Use `page.getByLabel('Duration').fill('abc')` then submit -- the browser's pattern validation may intercept. To test server-side validation specifically, may need to bypass HTML5 validation or test a value that passes pattern but fails server parsing.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct reading of all source files listed below
  - `src/hooks.server.ts` -- Auth guard with redirect logic
  - `src/routes/auth/+page.svelte` -- Login form with email/password and redirect handling
  - `src/routes/(app)/settings/+page.svelte` -- Sign-out flow
  - `src/routes/(app)/songs/+page.svelte` -- Song list with search, context menu, delete
  - `src/routes/(app)/songs/+page.server.ts` -- Song list loader and delete action
  - `src/routes/(app)/songs/new/+page.svelte` -- Add song form
  - `src/routes/(app)/songs/new/+page.server.ts` -- Add song server action with validation
  - `src/lib/components/songs/SongRow.svelte` -- Inline edit mode
  - `src/lib/components/songs/SongSearch.svelte` -- Search/filter UI
  - `src/lib/components/ui/ConfirmDialog.svelte` -- Delete confirmation dialog
  - `tests/fixtures.ts` -- Worker-scoped auth fixtures
  - `tests/helpers/factories.ts` -- createSong, createSetlist, createBand
  - `tests/helpers/cleanup.ts` -- safeDelete
  - `tests/helpers/auth.ts` -- createTestUser, deleteTestUser
  - `tests/smoke.spec.ts` -- Existing test patterns
  - `playwright.config.ts` -- Current Playwright configuration

### Secondary (MEDIUM confidence)
- Phase 7 research (`07-RESEARCH.md`) -- Test infrastructure decisions and patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies needed; all infrastructure from Phase 7 verified in codebase
- Architecture: HIGH - All UI elements, locators, and interaction patterns verified by reading source files
- Pitfalls: HIGH - Every pitfall identified from actual code review (context menu, edit mode, search toggle, dialog ambiguity, batch entry semantics, sign-out redirect)

**Research date:** 2026-03-04
**Valid until:** 2026-04-04 (stable -- tests target existing UI that won't change during this phase)
