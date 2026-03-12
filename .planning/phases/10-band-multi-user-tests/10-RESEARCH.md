# Phase 10: Band & Multi-User Tests - Research

**Researched:** 2026-03-12
**Domain:** Playwright E2E multi-user testing, Supabase RLS verification
**Confidence:** HIGH

## Summary

Phase 10 tests band collaboration and RLS data isolation using multiple browser contexts with separately authenticated users. The existing test infrastructure (fixtures, factories, admin client, auth helpers) provides a solid foundation. The primary new capability needed is a `createSecondUser(browser)` helper that creates a user via admin API, authenticates them in a fresh browser context, and returns a page + cleanup function.

The band UI is fully built: create band (`/bands`), invite members (`/bands/[id]/members`), accept invite (`/bands/invite/[token]`), shared songs (`/bands/[id]/songs`), shared setlists (`/bands/[id]/setlists`). RLS policies are comprehensive with `user_band_ids()` security definer function gating all band data. The invite flow uses one-time tokens with 7-day expiry stored in `band_invites` table.

**Primary recommendation:** Build a `tests/helpers/multi-user.ts` helper that wraps user creation + browser context auth + cleanup, then write two spec files (`bands.spec.ts` for BAND-01 through BAND-05, `rls.spec.ts` for RLS-01 through RLS-04) following the established BDD-style pattern from phases 8-9.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Per-test inline creation via Supabase admin API (not worker-scoped second fixture)
- Second user authenticates via real login UI in a new browser context (consistent with primary user)
- Standalone helper function: `createSecondUser(browser)` returns `{ page, user, cleanup }`
- Cleanup via returned `cleanup()` function called explicitly by the test (not afterEach hook)
- Helper lives in new file `tests/helpers/multi-user.ts`
- Full UI flow: User A creates band via UI, generates invite link, User B opens link in separate context and accepts
- Invite link extracted from UI element (similar to SETL-08 share URL extraction pattern)
- Shared data (songs, setlists) created via admin API, verified in UI by both users
- Collaboration verification = both users can view AND edit (add/remove/reorder songs in shared setlist)
- Direct URL navigation to another user's resources (not list page absence checks)
- Expected behavior: redirect or error page when accessing forbidden resource (assert URL change or error message)
- RLS-03: Separate test from SETL-08 -- verify shared link works unauthenticated AND that navigating to protected routes from that context fails
- RLS-04: Third non-member user to prove band membership enforcement (User A = owner, User B = member, User C = outsider)
- Two files: `bands.spec.ts` (BAND-01 through BAND-05) and `rls.spec.ts` (RLS-01 through RLS-04)
- Parallel execution with all other specs (default Playwright behavior, no serial mode)
- BDD-style naming consistent with Phase 8-9 pattern

### Claude's Discretion
- Exact locator strategies for band UI elements (settings page, invite link display)
- How createSecondUser/createThirdUser share code internally
- Test data values (band names, song titles)
- Whether RLS-04 third user helper is a separate function or reuses createSecondUser

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BAND-01 | User can create a band | Band create UI: `/bands` page has `aria-label="Create band"` button, inline form with `placeholder="Band name..."`, "Create" submit button. Redirects to `/bands/[id]` on success. |
| BAND-02 | User can invite another user to a band via invite link | Members page (`/bands/[id]/members`) has "Generate Invite Link" button (form POST `?/createInvite`). Response shows invite URL in `#invite-url-input` readonly input. |
| BAND-03 | Invited user can join a band via invite link | Invite page (`/bands/invite/[token]`) shows band name, "Join Band" submit button. On accept, redirects to `/bands/[band_id]`. |
| BAND-04 | Band members can see shared song library | Songs page (`/bands/[id]/songs`) shows band songs. Songs added via "Share from Library" panel or "Add New" form. Both members see same list. |
| BAND-05 | Band members can collaborate on shared setlists | Setlists page (`/bands/[id]/setlists`) has inline create form. Band setlist detail page at `/bands/[id]/setlists/[setlistId]`. |
| RLS-01 | User cannot see another user's songs via direct URL | Navigate User B to User A's `/songs` or specific song -- RLS blocks. App throws 404 or redirects. Direct URL test via `page.goto()`. |
| RLS-02 | User cannot see another user's setlists via direct URL | Navigate User B to User A's `/setlists/[id]` -- RLS blocks. App returns error or redirects. |
| RLS-03 | Unauthenticated user can view shared setlist via public link | Share route `/share/[token]` works without auth. But navigating to `/dashboard` or `/songs` from unauthenticated context redirects to `/auth`. |
| RLS-04 | Band data is only visible to band members | User C (non-member) navigates to `/bands/[id]` -- layout server load returns 404 (RLS: `bands` select requires membership via `user_band_ids()`). |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @playwright/test | (project version) | E2E test runner | Already configured in project |
| @supabase/supabase-js | (project version) | Admin API for test data setup | Already used by `adminClient` |
| @faker-js/faker | (project version) | Test data generation | Already used in factories |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tests/fixtures.ts | N/A | Worker-scoped primary user fixture | Every test (import `test` and `expect`) |
| tests/helpers/supabase-admin.ts | N/A | Service-role Supabase client | All admin API operations |
| tests/helpers/factories.ts | N/A | `createBand`, `createSong`, `createSetlist` | Data setup via admin API |
| tests/helpers/cleanup.ts | N/A | `safeDelete` | Per-test cleanup |

### No New Dependencies
All required libraries are already installed. No new npm packages needed.

## Architecture Patterns

### Recommended File Structure
```
tests/
  helpers/
    multi-user.ts    # NEW: createSecondUser() helper
    auth.ts          # Existing: createTestUser, deleteTestUser
    cleanup.ts       # Existing: safeDelete
    factories.ts     # Existing: createBand, createSong, createSetlist
    supabase-admin.ts # Existing: adminClient
    dnd.ts           # Existing: dragAndDrop
  bands.spec.ts      # NEW: BAND-01 through BAND-05
  rls.spec.ts        # NEW: RLS-01 through RLS-04
  fixtures.ts        # Existing: worker-scoped primary user
```

### Pattern 1: Multi-User Helper
**What:** A standalone function that creates an ad-hoc user, opens a new browser context, authenticates via the login UI, and returns `{ page, user, cleanup }`.
**When to use:** Any test needing a second or third authenticated user.
**Example:**
```typescript
// tests/helpers/multi-user.ts
import type { Browser } from '@playwright/test';
import { createTestUser, deleteTestUser } from './auth';

export async function createSecondUser(browser: Browser) {
  // Create user via admin API (unique email with timestamp)
  const user = await createTestUser(Date.now()); // workerIndex param accepts any number

  // Open fresh browser context (no existing auth)
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();

  // Authenticate via real login UI
  await page.goto('/auth');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: /sign in with email/i }).click();
  await page.waitForURL('**/dashboard');

  const cleanup = async () => {
    await context.close();
    await deleteTestUser(user.id);
  };

  return { page, user, cleanup };
}
```

### Pattern 2: Invite Link Extraction
**What:** Generate invite link via UI and extract URL from readonly input.
**When to use:** BAND-02 and BAND-03 tests.
**Example:**
```typescript
// On /bands/[id]/members page as band owner
await page.getByRole('button', { name: /generate invite link/i }).click();
// Wait for invite URL input to appear
const inviteInput = page.locator('#invite-url-input');
await expect(inviteInput).toBeVisible();
const inviteUrl = await inviteInput.inputValue();
```

### Pattern 3: RLS Violation Detection
**What:** Navigate to a forbidden resource and assert error/redirect behavior.
**When to use:** RLS-01 through RLS-04.
**Key insight:** The band layout (`/bands/[id]/+layout.server.ts`) throws `error(404)` when RLS blocks the band query. For personal resources, the server loads return null/error. The test should check for either an error page or redirect to `/auth`.
**Example:**
```typescript
// User B tries to access User A's setlist directly
await userBPage.goto(`/setlists/${userASetlistId}`);
// Expect either error page content or URL change away from the setlist
// The server load will get null from RLS-blocked query and throw 404
await expect(userBPage.getByText(/not found/i)).toBeVisible();
// OR: await expect(userBPage).not.toHaveURL(`/setlists/${userASetlistId}`);
```

### Pattern 4: Admin API Data Setup + UI Verification
**What:** Create shared band data (songs, setlists) via admin API, then verify both users can see it in the UI.
**When to use:** BAND-04 and BAND-05.
**Example:**
```typescript
// Create band song via admin API
await adminClient.from('band_songs').insert({
  band_id: bandId,
  song_id: songId,
  added_by: userAId
});

// User A sees it
await userAPage.goto(`/bands/${bandId}/songs`);
await expect(userAPage.getByText('Shared Song Title')).toBeVisible();

// User B sees it too
await userBPage.goto(`/bands/${bandId}/songs`);
await expect(userBPage.getByText('Shared Song Title')).toBeVisible();
```

### Anti-Patterns to Avoid
- **Worker-scoped second user fixture:** Creates lifecycle complexity; per-test inline creation with explicit cleanup is cleaner for multi-user scenarios.
- **Checking list page absence for RLS:** The CONTEXT.md explicitly says use direct URL navigation, not "User B's songs page doesn't show User A's songs."
- **Sharing browser contexts between users:** Each user MUST have their own `browser.newContext()` with separate auth state.
- **Forgetting to close contexts:** Always close additional browser contexts in cleanup to prevent resource leaks.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| User creation | Custom SQL inserts | `createTestUser()` from `helpers/auth.ts` | Handles email format, password gen, email_confirm |
| User deletion | Manual cascade deletes | `deleteTestUser()` from `helpers/auth.ts` | Handles band RESTRICT constraint, CASCADE |
| Band creation via API | Raw admin SQL | `createBand()` from `helpers/factories.ts` | Creates band + owner member row |
| Song/setlist creation | Raw inserts | `createSong()`, `createSetlist()` factories | Handles defaults, navigates browser |
| Safe cleanup | try/catch everywhere | `safeDelete()` from `helpers/cleanup.ts` | Warn-but-never-throw pattern |

## Common Pitfalls

### Pitfall 1: createTestUser workerIndex Collision
**What goes wrong:** Two concurrently running tests call `createTestUser` with the same workerIndex, causing email collision.
**Why it happens:** The email format is `test-worker{N}-{timestamp}@setlist.test`. If called at the same millisecond with the same index, collision occurs.
**How to avoid:** Use `Date.now()` as the workerIndex argument for inline-created users (not the actual workerIndex). The timestamp provides uniqueness.
**Warning signs:** "User already exists" errors during test setup.

### Pitfall 2: Band Owner RESTRICT Constraint on Cleanup
**What goes wrong:** `deleteTestUser` fails because the user owns a band and `bands.owner_id` has `ON DELETE RESTRICT`.
**Why it happens:** Bands must be deleted before the owning user.
**How to avoid:** The existing `deleteTestUser` already handles this (deletes bands where `owner_id` matches first). For inline-created users, the same function is used. But if a test creates a band via admin API for a different user, that band must be cleaned up explicitly.
**Warning signs:** "update or delete on table 'users' violates foreign key constraint" errors.

### Pitfall 3: Invite Token One-Time Use
**What goes wrong:** Test tries to reuse an invite token after it has been accepted.
**Why it happens:** The accept action marks the invite as used (`used_at` set, `used_by` set). Subsequent attempts return 404.
**How to avoid:** Generate a fresh invite for each test that needs one. Do not share invites across tests.
**Warning signs:** "Invite expired or already used" error in test.

### Pitfall 4: RLS Blocks Service-Role Operations
**What goes wrong:** This does NOT happen -- the adminClient uses service-role key which bypasses RLS.
**Why it matters:** Test data setup via `adminClient` always works regardless of RLS policies. Only browser-driven operations respect RLS. This is by design.

### Pitfall 5: Browser Context Auth State Leakage
**What goes wrong:** Second user's page retains first user's auth cookies.
**Why it happens:** Reusing a browser context instead of creating a new one.
**How to avoid:** Always pass `{ storageState: undefined }` when creating new contexts for additional users.
**Warning signs:** Second user sees first user's data, or actions succeed when they should fail.

### Pitfall 6: Parallel Test Data Collision
**What goes wrong:** Tests in bands.spec.ts and rls.spec.ts interfere with each other's band/user data.
**Why it happens:** Both specs create bands and users. If they share the worker-scoped primary user and create bands with the same name, locators may match wrong elements.
**How to avoid:** Use unique band/song names per test (faker handles this). Each test creates and cleans up its own data. The primary user from fixtures is worker-scoped and isolated.

### Pitfall 7: Non-Member Band Access Returns 404, Not Redirect
**What goes wrong:** Test expects redirect to `/auth` but gets a 404 error page.
**Why it happens:** The band layout (`+layout.server.ts`) throws `error(404, 'Band not found')` when RLS blocks the query (returns null). It does NOT redirect.
**How to avoid:** For RLS-04 (non-member access), assert error page content (e.g., "Band not found" or a 404 indicator), not a redirect.
**Warning signs:** Test looking for URL change that never happens.

### Pitfall 8: Personal Resource RLS -- Songs Have No Direct URL
**What goes wrong:** Test tries to navigate to `/songs/[id]` but that route doesn't exist.
**Why it happens:** The songs page is a list at `/songs` -- there is no individual song detail page.
**How to avoid:** For RLS-01 (song isolation), the approach should be: User B navigates to `/songs` and verifies User A's songs are NOT listed. Alternatively, use the setlist builder to check if User A's songs appear in User B's library panel. The CONTEXT says "direct URL navigation" but songs have no individual URLs -- adjust to verify via the list page or API-level check.
**Warning signs:** 404 on non-existent route, not an RLS violation.

## Code Examples

### Multi-User Helper (createSecondUser)
```typescript
// tests/helpers/multi-user.ts
import type { Browser } from '@playwright/test';
import { createTestUser, deleteTestUser } from './auth';

export async function createSecondUser(browser: Browser) {
  const user = await createTestUser(Date.now());
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();

  await page.goto('/auth');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: /sign in with email/i }).click();
  await page.waitForURL('**/dashboard');

  const cleanup = async () => {
    await context.close();
    await deleteTestUser(user.id);
  };

  return { page, user, cleanup };
}
```

### Band Creation via UI (BAND-01)
```typescript
test('should create a band via UI and redirect to band page', async ({ page }) => {
  await page.goto('/bands');
  await page.getByLabel('Create band').click();
  await page.getByPlaceholder('Band name...').fill('The Test Band');
  await page.getByRole('button', { name: 'Create' }).click();

  // Redirects to /bands/[id]
  await expect(page).toHaveURL(/\/bands\/.+/);
  // Band dashboard shows stats
  await expect(page.getByText('Members')).toBeVisible();

  // Cleanup: extract band ID from URL
  const bandId = page.url().split('/bands/')[1];
  await safeDelete('bands', bandId);
});
```

### Invite Flow (BAND-02 + BAND-03)
```typescript
test('should invite and join band via invite link', async ({ page, browser, testUser }) => {
  // User A creates band
  const band = await createBand(page, testUser.id);

  // User A generates invite
  await page.goto(`/bands/${band.id}/members`);
  await page.getByRole('button', { name: /generate invite link/i }).click();
  const inviteInput = page.locator('#invite-url-input');
  await expect(inviteInput).toBeVisible();
  const inviteUrl = await inviteInput.inputValue();

  // User B joins
  const userB = await createSecondUser(browser);
  try {
    await userB.page.goto(inviteUrl);
    await expect(userB.page.getByText(band.name)).toBeVisible();
    await userB.page.getByRole('button', { name: 'Join Band' }).click();
    await expect(userB.page).toHaveURL(new RegExp(`/bands/${band.id}`));
  } finally {
    await userB.cleanup();
    await safeDelete('bands', band.id);
  }
});
```

### RLS Direct URL Test (RLS-01/02)
```typescript
test('should block access to another user setlist via direct URL', async ({ page, browser, testUser }) => {
  // User A creates a setlist
  const setlist = await createSetlist(page, testUser.id, { name: 'Private Set' });

  // User B tries to access it
  const userB = await createSecondUser(browser);
  try {
    await userB.page.goto(`/setlists/${setlist.id}`);
    // RLS blocks -- server load returns null, app shows error
    // The exact behavior depends on how the setlist page handles null data
    // Could be 404, error text, or redirect
    await expect(userB.page.locator('body')).not.toContainText('Private Set');
  } finally {
    await userB.cleanup();
    await safeDelete('setlists', setlist.id);
  }
});
```

### RLS-04: Non-Member Band Access
```typescript
test('should block non-member from accessing band', async ({ page, browser, testUser }) => {
  const band = await createBand(page, testUser.id, { name: 'Members Only' });

  const userC = await createSecondUser(browser);
  try {
    // User C (not a band member) navigates to band page
    await userC.page.goto(`/bands/${band.id}`);
    // Layout server throws error(404, 'Band not found') because RLS blocks query
    await expect(userC.page.getByText(/not found/i)).toBeVisible();
  } finally {
    await userC.cleanup();
    await safeDelete('bands', band.id);
  }
});
```

## UI Locator Reference

Key locators derived from examining the actual Svelte components:

| Element | Page | Locator |
|---------|------|---------|
| Create band button | `/bands` | `getByLabel('Create band')` |
| Band name input | `/bands` | `getByPlaceholder('Band name...')` |
| Create submit | `/bands` | `getByRole('button', { name: 'Create' })` |
| Generate invite | `/bands/[id]/members` | `getByRole('button', { name: /generate invite link/i })` |
| Invite URL input | `/bands/[id]/members` | `locator('#invite-url-input')` |
| Copy invite button | `/bands/[id]/members` | `getByRole('button', { name: 'Copy' })` |
| Join Band button | `/bands/invite/[token]` | `getByRole('button', { name: 'Join Band' })` |
| Already member text | `/bands/invite/[token]` | `getByText("You're already a member")` |
| Go to Band link | `/bands/invite/[token]` | `getByText('Go to Band')` |
| Add Songs link | `/bands/[id]` | `getByText('Add Songs')` |
| Create Setlist link | `/bands/[id]` | `getByText('Create Setlist')` |
| Invite Members link | `/bands/[id]` | `getByText('Invite Members')` |
| Share from Library | `/bands/[id]/songs` | Button text "Share from Library" |
| Add New (song) | `/bands/[id]/songs` | Button text "Add New" |
| New setlist button | `/bands/[id]/setlists` | `getByLabel('New setlist')` |
| Setlist name input | `/bands/[id]/setlists` | `getByPlaceholder('Setlist name...')` |
| Remove song from band | `/bands/[id]/songs` | `getByLabel('Remove {title} from band')` |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Global test fixtures for all users | Worker-scoped primary + per-test inline secondary | Phase 10 design | Avoids fixture complexity for multi-user |
| RLS testing via unit tests | E2E RLS testing via browser contexts | Phase 10 design | Tests actual user experience, not just policy logic |

## Open Questions

1. **RLS-01: Songs have no individual detail page**
   - What we know: `/songs` is a list page, no `/songs/[id]` route exists. RLS-01 says "direct URL navigation."
   - What's unclear: How to test song isolation via "direct URL" when there is no per-song URL.
   - Recommendation: Test by navigating User B to `/songs` and asserting User A's songs are not listed. This still validates RLS because the songs table has `user_id`-based RLS policies. Alternatively, create a song via admin for User A, then have User B's page check their song list doesn't include it.

2. **Error page behavior for RLS violations on personal resources**
   - What we know: Band pages return 404 via layout. Personal setlist/song pages may behave differently.
   - What's unclear: Whether navigating to another user's setlist returns 404, shows empty page, or throws error.
   - Recommendation: Test empirically in the first task. Check the setlist detail page server load to understand its error handling.

## Sources

### Primary (HIGH confidence)
- Project source code: `src/routes/(app)/bands/` -- all route files examined
- Project source code: `tests/` -- all existing helpers and specs examined
- Project source code: `supabase/migrations/` -- RLS policies examined
- `10-CONTEXT.md` -- locked decisions from user discussion

### Secondary (MEDIUM confidence)
- Playwright multi-context patterns -- based on existing `auth.spec.ts` pattern (uses `browser.newContext({ storageState: undefined })`)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in use, no new deps
- Architecture: HIGH - extending proven patterns from phases 8-9
- Pitfalls: HIGH - derived from examining actual code (RESTRICT constraints, RLS policies, route structure)
- UI locators: HIGH - derived directly from Svelte component source code

**Research date:** 2026-03-12
**Valid until:** 2026-04-12 (stable -- internal project patterns)
