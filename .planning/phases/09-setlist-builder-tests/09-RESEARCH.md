# Phase 9: Setlist Builder Tests - Research

**Researched:** 2026-03-06
**Domain:** Playwright E2E tests for setlist CRUD, drag-and-drop, timing, and sharing in SvelteKit + Supabase
**Confidence:** HIGH

## Summary

Phase 9 writes E2E tests for the complete setlist-building workflow: creating setlists, adding/reordering songs via drag-and-drop, live timing updates, setlist management (duplicate/rename/delete), and public sharing. The test infrastructure from Phase 7 and the patterns from Phase 8 are fully in place. This phase adds one new test file (`setlists.spec.ts`) and one new helper (`tests/helpers/dnd.ts`) for the custom pointer event DnD helper.

The primary technical challenge is testing `svelte-dnd-action` drag-and-drop. Per prior decisions (v1.2), Playwright's built-in `locator.dragTo()` fails silently with svelte-dnd-action because the library uses custom pointer event handling. A custom helper using `page.mouse.down()`, `page.mouse.move()` (with sufficient steps), and `page.mouse.up()` is required. This helper was deferred from Phase 7 to be built and tuned in Phase 9.

The app has two DnD zones on the setlist detail page (`/setlists/[id]`): a library panel (left) and a setlist panel (right). Songs are dragged from library to setlist to add them, and reordered within the setlist by dragging. Both zones use `svelte-dnd-action` with `type: 'setlist-songs'`. The library zone has `dropFromOthersDisabled: true` (copy-on-drag pattern). The setlist list page (`/setlists`) handles create, duplicate, rename, and delete via form actions and a three-dot context menu on `SetlistCard` components. Sharing is toggled on the setlist detail page and produces a `/share/[token]` public URL accessible without authentication.

**Primary recommendation:** Build a reusable `dragAndDrop(page, source, target, options?)` helper in `tests/helpers/dnd.ts` first, then write `setlists.spec.ts` organized by requirement. Test timing updates via the `TimingBar` component's visible text (Total, Diff labels). Test sharing by enabling it, extracting the share URL, then visiting it in an unauthenticated browser context.

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SETL-01 | User can create a new setlist | `/setlists` page has inline create form: click "New setlist" button (aria-label), fill name input, submit. Server action redirects to `/setlists/[id]`. Test: create setlist, verify redirect to detail page with correct name. |
| SETL-02 | User can add songs to a setlist via drag-and-drop | Library panel (left) contains user's songs. Drag from library zone to setlist zone adds song. `handleSetlistFinalize` detects new items and calls `persistOrder`. Test: create songs via factory, navigate to setlist, drag from library to setlist, verify song appears in setlist zone. |
| SETL-03 | User can reorder songs within a setlist via drag-and-drop | Setlist zone supports reorder. `SetlistSongRow` has drag handle (grip dots icon). Test: add 2+ songs, drag one above/below another, verify new order persists after reload. |
| SETL-04 | Running time total updates as songs are added/removed/reordered | `TimingBar` computes `totalSeconds = sum(duration_seconds) + (n-1) * transition_seconds`. Displays formatted duration. Test: verify Total text updates after adding/removing songs. |
| SETL-05 | User can set target time and see over/under indicator | `TimingBar` has target input (placeholder "Set target"). When set, shows Diff label with +/- formatted duration, color-coded (danger-500 for over, success-400 for under). Test: set target, verify over/under indicator appears with correct sign. |
| SETL-06 | User can set global transition time between songs | `TimingBar` has Gap stepper with +/- buttons (aria-labels "Decrease/Increase transition time"). Increments by 5s. Test: click + button, verify gap label updates, verify total time changes. |
| SETL-07 | User can duplicate, delete, and rename setlists | `/setlists` list page: SetlistCard has three-dot menu (aria-label "Setlist options") with Duplicate and Delete. Rename via clicking setlist name on the card. Delete shows ConfirmDialog. Duplicate creates "(Copy)" suffix. Test all three operations. |
| SETL-08 | User can share a setlist via public link | Setlist detail page has "Share" toggle button. When enabled, shows share URL with copy button. `/share/[token]` page is public (no auth). Test: toggle sharing on, extract URL, visit in unauthenticated context, verify setlist name and songs visible. |

</phase_requirements>

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@playwright/test` | ^1.58.2 | Test runner, browser automation, assertions | Already installed. Provides `test`, `expect`, `page`, `browser` fixtures. |
| `@faker-js/faker` | ^10.3.0 | Generate unique test data | Already installed. Used by factories for setlist names, song titles. |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `svelte-dnd-action` | ^0.9.69 | DnD library under test | The target of our DnD tests. No test-side dependency needed. |

### No New Dependencies Needed

Phase 9 writes test files and one helper. All infrastructure and dependencies were established in Phase 7.

## Architecture Patterns

### New Files for Phase 9
```
tests/
├── helpers/
│   └── dnd.ts               # Custom pointer event DnD helper
└── setlists.spec.ts          # All setlist tests (SETL-01 through SETL-08)
```

### Pattern 1: Custom DnD Pointer Event Helper
**What:** A helper function that simulates drag-and-drop using low-level pointer events
**When to use:** Any test that needs to drag songs between zones or reorder within a zone
**Why needed:** svelte-dnd-action listens for pointer events (pointerdown, pointermove, pointerup). Playwright's `locator.dragTo()` dispatches HTML5 drag events which svelte-dnd-action ignores. The library requires sustained pointer movement to trigger its consider/finalize cycle.

**Implementation approach:**
```typescript
// tests/helpers/dnd.ts
import type { Page, Locator } from '@playwright/test';

interface DragOptions {
  steps?: number;       // Number of intermediate mouse.move steps (default: 10)
  holdMs?: number;      // Time to hold before starting move (default: 100)
  pauseMs?: number;     // Pause after move before release (default: 100)
}

export async function dragAndDrop(
  page: Page,
  source: Locator,
  target: Locator,
  options: DragOptions = {}
) {
  const { steps = 10, holdMs = 100, pauseMs = 100 } = options;

  // Get bounding boxes
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error('Could not get bounding box for source or target');
  }

  const sourceCenter = {
    x: sourceBox.x + sourceBox.width / 2,
    y: sourceBox.y + sourceBox.height / 2
  };
  const targetCenter = {
    x: targetBox.x + targetBox.width / 2,
    y: targetBox.y + targetBox.height / 2
  };

  // Simulate pointer-driven drag
  await page.mouse.move(sourceCenter.x, sourceCenter.y);
  await page.mouse.down();
  await page.waitForTimeout(holdMs);  // svelte-dnd-action needs time to register
  await page.mouse.move(targetCenter.x, targetCenter.y, { steps });
  await page.waitForTimeout(pauseMs);  // Let consider events settle
  await page.mouse.up();
}
```

**Key tuning parameters:**
- `steps`: More steps = more pointermove events = smoother drag recognition. svelte-dnd-action needs multiple move events to trigger its consider phase. Start with 10, increase if flaky.
- `holdMs`: svelte-dnd-action has a delay before initiating drag. 100ms should be sufficient (the library default is typically 0ms for pointer, 200ms for touch).
- `pauseMs`: Pause before mouse.up lets the drop zone finalize. svelte-dnd-action processes the drop target on the last move event before up.

### Pattern 2: Setlist Creation via UI
**What:** Creating a setlist through the actual form on `/setlists`
**When to use:** SETL-01 tests, and as setup for other tests that need a setlist with UI-created state
**Example:**
```typescript
await page.goto('/setlists');
await page.getByLabel('New setlist').click();
await page.getByPlaceholder('Setlist name...').fill('My Test Set');
await page.getByRole('button', { name: 'Create' }).click();
// Redirects to /setlists/[id]
await expect(page).toHaveURL(/\/setlists\//);
```

### Pattern 3: Factory-Based Setlist Setup
**What:** Using the existing `createSetlist` factory for fast test setup
**When to use:** Tests that need a setlist but aren't testing creation (SETL-02 through SETL-08)
**Example:**
```typescript
import { createSetlist, createSong } from './helpers/factories';

const setlist = await createSetlist(page, testUser.id, {
  name: 'DnD Test Set',
  target_seconds: 3600,    // 60:00
  transition_seconds: 10
});
// Factory navigates to /setlists/[id] automatically

const song = await createSong(page, testUser.id, {
  title: 'Test Song',
  duration_seconds: 180    // 3:00
});
// Factory navigates to /songs -- need to navigate back
await page.goto(`/setlists/${setlist.id}`);
```

### Pattern 4: Adding Songs to Setlist via Factory
**What:** Using the admin client to pre-populate setlist_songs for tests that don't test DnD add
**When to use:** Tests for timing, reorder, sharing -- where songs need to already be in the setlist
**Example:**
```typescript
import { adminClient } from './helpers/supabase-admin';

// After creating setlist and songs via factories
await adminClient.from('setlist_songs').insert([
  { setlist_id: setlist.id, song_id: song1.id, position: 0 },
  { setlist_id: setlist.id, song_id: song2.id, position: 1 }
]);
await page.goto(`/setlists/${setlist.id}`);
```

### Pattern 5: Testing Share in Unauthenticated Context
**What:** Enabling sharing then visiting the share URL without auth
**When to use:** SETL-08 tests
**Example:**
```typescript
// Enable sharing (authenticated)
await page.getByRole('button', { name: /share/i }).click();
// Wait for share URL to appear
const shareUrlText = await page.locator('.truncate').innerText();

// Visit in unauthenticated context
const context = await browser.newContext({ storageState: undefined });
const publicPage = await context.newPage();
await publicPage.goto(shareUrlText);
await expect(publicPage.getByText(setlist.name)).toBeVisible();
await context.close();
```

### Pattern 6: Verifying Timing Updates
**What:** Reading computed values from TimingBar
**When to use:** SETL-04, SETL-05, SETL-06 tests
**Locator strategy:** TimingBar renders "Total" label followed by a formatted duration (e.g., "3:00"), "Diff" label with +/- duration, "Gap" label with stepper.

```typescript
// Total time - desktop layout uses font-display text-xl font-bold
// Look for the formatted duration text near the "Total" label
const totalText = page.locator('text=Total').locator('..').locator('.font-display');

// Over/under indicator - has text-danger-500 or text-success-400 class
const diffIndicator = page.locator('.text-danger-500, .text-success-400');

// Gap stepper
await page.getByLabel('Increase transition time').click();
```

### Anti-Patterns to Avoid
- **Using `locator.dragTo()` for svelte-dnd-action:** Will fail silently. Always use the custom pointer event helper.
- **Hardcoding pixel coordinates for DnD:** Use `boundingBox()` on actual elements. Screen size varies.
- **Testing DnD without waiting for persistence:** After a drag, the app calls `persistOrder` asynchronously. Wait for visible UI confirmation (song appearing in new position, timing update) before asserting.
- **Creating songs and setlists in the same factory call chain without navigating:** The `createSong` factory navigates to `/songs`, so subsequent calls to interact with the setlist page need explicit navigation back to `/setlists/[id]`.
- **Relying on CSS class names for timing assertions:** The timing display uses computed text. Assert on visible text content, not class presence.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test user creation | Manual Supabase SQL | Existing `createTestUser()` | Already handles email, password, confirmation |
| Setlist creation for setup | Navigating UI | Existing `createSetlist()` factory | API-based creation is faster |
| Song creation for setup | Navigating UI to add songs | Existing `createSong()` factory | API-based, returns song data with ID |
| Setlist song population | DnD for every test | Direct `adminClient.from('setlist_songs').insert()` | Only use DnD helper for tests that specifically test DnD |
| Auth state management | Manual cookie injection | Existing `workerStorageState` fixture | Handles full auth flow |
| Cleanup | Manual delete calls | `safeDelete()` + worker teardown CASCADE | Worker teardown handles most cleanup |

**Key insight:** Only use DnD simulation for tests that specifically test drag-and-drop (SETL-02, SETL-03). For all other tests that need songs in a setlist (SETL-04, SETL-05, SETL-06, SETL-08), use admin client direct insert -- it is faster and eliminates DnD flakiness from unrelated tests.

## Common Pitfalls

### Pitfall 1: DnD Helper Needs Sufficient Steps
**What goes wrong:** Drag appears to work but svelte-dnd-action never fires finalize.
**Why it happens:** svelte-dnd-action needs multiple pointermove events to transition from idle -> consider -> finalize. With `steps: 1`, only one move event fires, which may not cross the internal threshold.
**How to avoid:** Start with `steps: 10`. If still flaky, increase to 20. The `steps` parameter controls how many intermediate mousemove events Playwright dispatches.
**Warning signs:** Source element moves visually but drops back to original position. No network request to `?/saveOrder`.

### Pitfall 2: DnD Hold Time Before Move
**What goes wrong:** Drag doesn't initiate -- element doesn't "pick up".
**Why it happens:** svelte-dnd-action may require a brief hold after mousedown before movement begins to register as a drag vs. a click.
**How to avoid:** Use `holdMs: 100` or higher in the DnD helper. Add `page.waitForTimeout(holdMs)` between `mouse.down()` and `mouse.move()`.
**Warning signs:** The element clicks instead of dragging. Click handlers fire on the source element.

### Pitfall 3: SetlistCard Three-Dot Menu is Hover-Only
**What goes wrong:** Tests can't find the "Setlist options" button.
**Why it happens:** The three-dot menu button has `opacity-0 group-hover:opacity-100` -- it's invisible until the card is hovered.
**How to avoid:** Hover over the card first, then click the menu button: `await card.hover()` then `await page.getByLabel('Setlist options').click()`.
**Warning signs:** Locator for "Setlist options" times out.

### Pitfall 4: Rename on SetlistCard Uses Click-to-Edit Pattern
**What goes wrong:** Tests try to find a "Rename" option in the three-dot menu.
**Why it happens:** The rename UI on the setlist list page is clicking the setlist name directly (not through the menu). It switches to an inline input.
**How to avoid:** Click the setlist name text to enter edit mode, fill the input, blur or press Enter.
**Warning signs:** No "Rename" option in the dropdown menu.

### Pitfall 5: Duplicate Creates "(Copy)" Suffix
**What goes wrong:** Tests look for the wrong name after duplicating.
**Why it happens:** The server `duplicate` action appends " (Copy)" to the original name.
**How to avoid:** After duplicating "My Set", look for "My Set (Copy)" on the setlists list page.
**Warning signs:** Assertion for duplicated setlist name fails.

### Pitfall 6: Share Toggle Text Changes State
**What goes wrong:** Tests click the wrong button or can't find the toggle.
**Why it happens:** The share button text changes: "Share" when off, "Sharing On" when enabled. It's a toggle.
**How to avoid:** Use `page.getByRole('button', { name: /share/i })` which matches both states. After clicking once, look for the share URL container and "Copy" button.
**Warning signs:** Button not found after first click.

### Pitfall 7: Share URL Is Not a Stable Locator
**What goes wrong:** Tests can't extract the share URL reliably.
**Why it happens:** The share URL is displayed in a `<span>` with class `truncate` inside a container that only appears when `isShared && shareUrl` is true.
**How to avoid:** Wait for the share URL container to be visible, then extract text. The URL follows the pattern `/share/[uuid]`.
**Warning signs:** Empty string when reading share URL text.

### Pitfall 8: TimingBar Has Desktop and Mobile Layouts
**What goes wrong:** Locators match the wrong layout or match both.
**Why it happens:** TimingBar renders two layouts: desktop (`hidden md:flex`) and mobile (`md:hidden`). Both are in the DOM but only one is visible based on viewport.
**How to avoid:** Playwright's default viewport is Desktop Chrome (1280x720), so the desktop layout will be visible. Use visible locators or scope to the desktop container: `page.locator('.md\\:flex')` or use text-based locators that are visible.
**Warning signs:** Duplicate matches for timing elements.

### Pitfall 9: Setlist Create Redirects to Detail Page
**What goes wrong:** Tests try to verify creation on the list page but end up on the detail page.
**Why it happens:** The `create` server action does `throw redirect(303, '/setlists/${id}')` -- after creating, the browser navigates to the new setlist's detail page.
**How to avoid:** After creating a setlist, verify you're on `/setlists/[id]` (the detail page). To verify it appears on the list page, navigate back to `/setlists`.
**Warning signs:** URL assertions fail because the test expects `/setlists` but is on `/setlists/[uuid]`.

### Pitfall 10: isMutating Guard and $effect Race Conditions in Tests
**What goes wrong:** Assertions fire before the UI has settled after a DnD operation.
**Why it happens:** The setlist detail page has an `isMutating` guard that prevents `$effect` from overwriting optimistic state during async operations. After DnD finalize, `persistOrder` fires asynchronously, then `isMutating` is reset, then `$effect` may re-sync from server data.
**How to avoid:** After DnD operations, wait for the expected UI state (song visible in new position, timing updated) rather than asserting immediately. Use Playwright's auto-retrying `expect(locator).toBeVisible()` which will retry until the assertion passes or times out.
**Warning signs:** Flaky tests where assertions sometimes pass and sometimes fail.

## Code Examples

### DnD: Adding a Song from Library to Setlist
```typescript
// Navigate to setlist detail page (factory or direct)
await page.goto(`/setlists/${setlist.id}`);

// Locate song in library panel and setlist drop zone
const librarySong = page.getByText('Test Song Title').first();
const setlistZone = page.locator('[class*="min-h-"]').last(); // The setlist DnD zone

await dragAndDrop(page, librarySong, setlistZone, { steps: 10 });

// Verify song appears in setlist
await expect(page.locator('.mb-1\\.5').filter({ hasText: 'Test Song Title' })).toBeVisible();
```

### DnD: Reordering Songs Within Setlist
```typescript
// Songs already in setlist (via admin insert)
// Song A at position 0, Song B at position 1

const songA = page.getByText('Song A');
const songB = page.getByText('Song B');

// Drag Song B above Song A
await dragAndDrop(page, songB, songA, { steps: 15 });

// Verify new order after reload
await page.reload();
const songs = page.locator('[class*="SetlistSongRow"]');
// Or verify by checking song order in the setlist zone
```

### Timing: Verifying Total Time Updates
```typescript
// Add two 3:00 songs to setlist via admin
// Navigate to setlist detail

// Verify total shows 6:00
await expect(page.getByText('6:00')).toBeVisible();

// Remove one song
await page.getByLabel('Remove Test Song A from setlist').click();

// Verify total updates to 3:00
await expect(page.getByText('3:00')).toBeVisible();
```

### Timing: Target Time and Over/Under
```typescript
// Songs total 6:00 (two 3:00 songs), transition 0
// Set target to 5:00 (under by 1:00 = over +1:00)
const targetInput = page.getByPlaceholder('Set target');
await targetInput.fill('5:00');
await targetInput.blur();

// Should show over indicator: +1:00
await expect(page.getByText('+1:00')).toBeVisible();
// The text should have danger color class (visual, but text content is what matters)
```

### Timing: Transition Gap Adjustment
```typescript
// Two songs in setlist, transition_seconds = 0
// Click + 3 times (5s each = 15s gap)
const increaseGap = page.getByLabel('Increase transition time');
await increaseGap.click();
await increaseGap.click();
await increaseGap.click();
// Gap shows "15s"
await expect(page.getByText('15s')).toBeVisible();
// Total should include transition: songs_total + 15s (one gap for 2 songs)
```

### Setlist Management: Create
```typescript
await page.goto('/setlists');
await page.getByLabel('New setlist').click();
await page.getByPlaceholder('Setlist name...').fill('Friday Night Gig');
await page.getByRole('button', { name: 'Create' }).click();
await expect(page).toHaveURL(/\/setlists\/.+/);
// Verify name displayed on detail page
await expect(page.getByText('Friday Night Gig')).toBeVisible();
```

### Setlist Management: Duplicate
```typescript
await page.goto('/setlists');
const card = page.getByText('Friday Night Gig').locator('..');
await card.hover();
await page.getByLabel('Setlist options').click();
await page.getByText('Duplicate').click();
// Wait for page update
await expect(page.getByText('Friday Night Gig (Copy)')).toBeVisible();
```

### Setlist Management: Delete with Confirm
```typescript
await page.goto('/setlists');
const card = page.getByText('To Delete Set').locator('..');
await card.hover();
await page.getByLabel('Setlist options').click();
await page.getByText('Delete').click();
// Confirm dialog
await expect(page.locator('dialog')).toBeVisible();
await page.locator('dialog').getByRole('button', { name: 'Delete' }).click();
await expect(page.getByText('To Delete Set')).not.toBeVisible();
```

### Share: Enable and Visit as Unauthenticated User
```typescript
// On setlist detail page
await page.getByRole('button', { name: /share/i }).click();
// Wait for URL to appear
await expect(page.getByText('Sharing On')).toBeVisible();
const shareUrl = await page.locator('.truncate').innerText();

// Visit in fresh unauthenticated context
const context = await browser.newContext({ storageState: undefined });
const publicPage = await context.newPage();
await publicPage.goto(shareUrl);

// Verify setlist content is visible
await expect(publicPage.getByText('My Setlist Name')).toBeVisible();
await expect(publicPage.getByText('Song Title 1')).toBeVisible();

await context.close();
```

## Key UI Locators Reference

### Setlist List Page (`/setlists`)

| Element | Locator |
|---------|---------|
| Page heading | `page.getByRole('heading', { name: 'Setlists' })` |
| New setlist button | `page.getByLabel('New setlist')` |
| Create form input | `page.getByPlaceholder('Setlist name...')` |
| Create submit | `page.getByRole('button', { name: 'Create' })` |
| Create cancel | `page.getByRole('button', { name: 'Cancel' })` |
| Setlist card link | `page.getByText('Setlist Name')` |
| Three-dot menu | `page.getByLabel('Setlist options')` |
| Duplicate menu item | Menu dropdown > `page.getByText('Duplicate')` |
| Delete menu item | Menu dropdown > `page.getByText('Delete')` with danger color |
| Confirm dialog | `page.locator('dialog')` |
| Empty state | `page.getByText('No setlists yet')` |

### Setlist Detail Page (`/setlists/[id]`)

| Element | Locator |
|---------|---------|
| Setlist name (clickable) | Name shown as button with `title="Click to rename"` |
| Name edit input | After click, input with `font-display text-2xl` |
| Library search input | `page.getByPlaceholder('Search songs...')` |
| Library song row | `LibrarySongRow` - song title text in library panel |
| Setlist song row | `SetlistSongRow` - song title with drag handle and remove button |
| Remove song button | `page.getByLabel('Remove {title} from setlist')` |
| Share toggle | `page.getByRole('button', { name: /share/i })` |
| Share URL text | `page.locator('.truncate')` (when sharing enabled) |
| Copy share link | `page.getByRole('button', { name: 'Copy' })` |
| Empty setlist text | `page.getByText('Drag songs here to build your setlist')` |

### TimingBar (sticky bottom of detail page)

| Element | Locator |
|---------|---------|
| Total time display | Text after "Total" label, `.font-display` sibling |
| Target time input | `page.getByPlaceholder('Set target')` |
| Over/under indicator | Text with `text-danger-500` (over) or `text-success-400` (under) |
| Decrease gap button | `page.getByLabel('Decrease transition time')` |
| Increase gap button | `page.getByLabel('Increase transition time')` |
| Gap value display | Text between - and + buttons |

### Share Page (`/share/[token]`)

| Element | Locator |
|---------|---------|
| Setlist name heading | `page.getByRole('heading', { name: setlistName })` |
| Song items | `page.locator('li')` (ordered list items) |
| Venue/date subtitle | `page.locator('.text-gray-500')` |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `locator.dragTo()` | Custom `mouse.down/move/up` helper | Required for pointer-event DnD libs | `dragTo()` dispatches HTML5 drag events, ignored by svelte-dnd-action |
| Inline DnD simulation in each test | Reusable `dragAndDrop()` helper | Best practice | Centralizes tuning parameters, reduces test duplication |
| DnD to populate setlists for every test | Admin client direct insert for non-DnD tests | Performance optimization | Eliminates DnD flakiness from timing/sharing tests |

## Open Questions

1. **Optimal DnD steps/timing parameters**
   - What we know: svelte-dnd-action needs multiple pointermove events. The library version is 0.9.69.
   - What's unclear: Exact steps count and hold timing that reliably triggers consider -> finalize cycle. This needs empirical tuning.
   - Recommendation: Start with `steps: 10, holdMs: 100, pauseMs: 100`. If flaky, increase steps to 20 and holdMs to 200. Document what works in the helper's JSDoc.

2. **Cross-zone DnD (library to setlist) may need different parameters than same-zone reorder**
   - What we know: Cross-zone drag (library -> setlist) involves the library zone's `dropFromOthersDisabled: false` on the setlist side. Same-zone reorder within setlist zone has different internal logic.
   - What's unclear: Whether the same helper parameters work for both scenarios.
   - Recommendation: Build one helper with configurable options. Test both scenarios early and adjust if needed.

3. **SetlistCard three-dot menu hover requirement for Playwright**
   - What we know: The menu button has `opacity-0 group-hover:opacity-100`. Playwright can click invisible elements, but `page.getByLabel('Setlist options').click()` may fail if the element has `opacity: 0` but is technically in the DOM.
   - What's unclear: Whether Playwright requires the element to be visible (opacity > 0) for click actions.
   - Recommendation: Use `.hover()` on the parent card element first, which will trigger the CSS hover state and make the button visible. Alternatively, use `{ force: true }` on the click.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct reading of all source files:
  - `src/routes/(app)/setlists/+page.svelte` -- Setlist list page with create/delete/duplicate/rename
  - `src/routes/(app)/setlists/+page.server.ts` -- Server actions for setlist CRUD
  - `src/routes/(app)/setlists/[id]/+page.svelte` -- Setlist detail page with DnD, timing, sharing
  - `src/routes/(app)/setlists/[id]/+page.server.ts` -- Server actions for saveOrder, addSong, removeSong, toggleShare, updateSetlist
  - `src/routes/share/[token]/+page.svelte` -- Public share page
  - `src/routes/share/[token]/+page.server.ts` -- Share page loader (no auth required)
  - `src/lib/components/setlists/TimingBar.svelte` -- Timing display with target, gap stepper, over/under
  - `src/lib/components/setlists/SetlistHeader.svelte` -- Editable setlist name/date/venue
  - `src/lib/components/setlists/SetlistSongRow.svelte` -- Song row with drag handle and remove button
  - `src/lib/components/setlists/LibrarySongRow.svelte` -- Library song row with add button
  - `src/lib/components/setlists/SetlistCard.svelte` -- Card on list page with menu
  - `src/lib/components/ui/ProgressBar.svelte` -- Progress bar for target time
  - `supabase/migrations/20260218100000_create_setlist_tables.sql` -- DB schema
  - `tests/fixtures.ts` -- Worker-scoped auth fixtures
  - `tests/helpers/factories.ts` -- createSong, createSetlist, createBand factories
  - `tests/helpers/cleanup.ts` -- safeDelete utility
  - `tests/helpers/supabase-admin.ts` -- Admin client singleton
  - `tests/songs.spec.ts` -- Existing test patterns from Phase 8
  - `tests/auth.spec.ts` -- Unauthenticated context pattern
  - `.planning/debug/dnd-reorder-jank.md` -- DnD race condition diagnosis
  - `.planning/debug/setlist-remove-song-race.md` -- Remove song race condition diagnosis
  - `playwright.config.ts` -- Test configuration

### Secondary (MEDIUM confidence)
- [Playwright Mouse API docs](https://playwright.dev/docs/api/class-mouse) -- `mouse.move()` steps parameter
- [Playwright Input docs](https://playwright.dev/docs/input) -- Low-level mouse control for DnD
- [svelte-dnd-action GitHub](https://github.com/isaacHagoel/svelte-dnd-action) -- Library behavior, pointer event handling
- [BrowserStack DnD guide](https://www.browserstack.com/guide/playwright-drag-and-drop) -- Manual pointer control pattern
- Phase 7 research (`.planning/phases/07-test-infrastructure/07-RESEARCH.md`) -- DnD testing approach decision
- Phase 8 research (`.planning/phases/08-auth-song-library-tests/08-RESEARCH.md`) -- Test patterns and locator strategies

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies; all infrastructure from Phase 7 verified in codebase
- Architecture: HIGH - All UI elements, locators, form actions, and server-side logic verified by direct source reading
- DnD helper approach: MEDIUM - Pointer event approach is well-documented and confirmed necessary by prior decisions, but exact tuning parameters (steps, timing) need empirical validation
- Pitfalls: HIGH - Every pitfall identified from actual code review (hover menu, rename pattern, redirect, timing layout, share flow)

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stable -- tests target existing UI that won't change during this phase)
