# Phase 5: Landing Page Structure - Research

**Researched:** 2026-02-26
**Domain:** SvelteKit marketing landing page with auth-based routing
**Confidence:** HIGH

## Summary

This phase builds a marketing landing page at `/` for logged-out visitors, with auth-based routing that redirects logged-in users to the dashboard. The current codebase has a clear architecture that makes this achievable through targeted modifications to the existing routing and hooks.

The primary technical challenge is the auth guard in `hooks.server.ts` (line 32-38), which currently redirects ALL non-`/auth` and non-`/share` routes to the login page. The landing page must be exempted from this guard while still maintaining the authenticated dashboard at the same `/` path. SvelteKit's route groups and server-side load functions provide clean patterns for this.

No new libraries are needed. The existing stack (SvelteKit, Tailwind v4, Supabase Auth) handles everything. The landing page is pure static HTML/CSS with Svelte templating, using the app's existing design tokens (dark navy/copper/chartreuse theme, Cartridge display font, Klima body font).

**Primary recommendation:** Create a new top-level `+page.svelte` at `src/routes/+page.svelte` that replaces the current `(app)/+page.svelte` dashboard, using server-side auth detection to either redirect logged-in users to a `/dashboard` route or conditionally render the landing page vs dashboard content.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
#### Hero messaging & tone
- Bold & direct voice — confident, no-nonsense (e.g., "Know your set. Own the stage.")
- Subheadline explains WHAT the app does (feature-focused, not identity-focused)
- CTA button: "Build Your First Setlist" → routes to sign-up
- Hero is large but not full viewport (~70-80vh) — hints at content below
- Dramatic typography with oversized headline

#### Feature showcase
- Highlight 3 core capabilities: Setlist timing, Song library, Band collaboration
- Floating UI crop screenshots (cropped actual UI, no device frames)
- Each card has headline + 1-2 sentence description alongside screenshot
- Stacked alternating layout — full-width rows, screenshot alternates left/right on desktop

#### Social proof strategy
- Aspirational credibility through tool precision — "Every second of your set, accounted for" style
- No fake testimonials or placeholder quotes — identity and capability messaging instead
- Secondary CTA button repeating "Build Your First Setlist" in or near social proof section

#### Visual personality
- Dark & dramatic aesthetic throughout — dark backgrounds, high contrast, stage-lighting feel
- Use existing app design tokens (surface/accent colors, fonts, dark theme)
- Very bold typography — hero headline 5-6rem+, section headings 3-4rem
- Subtle dividers between sections (thin lines or gradient fades)
- Minimal footer — logo, few links (sign up, login), copyright

### Claude's Discretion
- Social proof visual treatment (stats-style numbers vs typographic statement)
- Exact headline/subheadline copy
- Responsive breakpoint behavior
- Section spacing and padding values
- Screenshot selection and cropping

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ROUTE-01 | Logged-out visitors see marketing landing page at `/` | Auth guard modification in hooks.server.ts + new root page route (Architecture Pattern 1) |
| ROUTE-02 | Logged-in users are redirected to dashboard from `/` | Server-side redirect in +page.server.ts load function (Architecture Pattern 1) |
| HERO-01 | Hero section with bold headline, subheadline, and sign-up CTA button | Landing page component structure (Architecture Pattern 2) |
| HERO-03 | Dramatic typography with large, impactful font sizes | Existing Cartridge display font + Tailwind custom sizes (Design Tokens section) |
| FEAT-01 | Feature highlight section with 3-4 cards showcasing core capabilities | Landing page sections with alternating layout (Architecture Pattern 3) |
| FEAT-02 | Real app screenshots embedded in feature cards | Static image files in `static/images/` (Screenshot Strategy section) |
| SOCL-01 | Social proof section with testimonials, stats, or credibility indicators | Aspirational messaging section (Architecture Pattern 4) |
| FOOT-01 | Footer with branding and relevant links | Minimal footer component (Architecture Pattern 5) |
| DSGN-01 | Responsive design that works on mobile, tablet, and desktop | Tailwind breakpoints, existing patterns in codebase (Responsive Strategy section) |
| DSGN-02 | Uses app's existing design system (surface/accent tokens, fonts, dark/light theme) | All design tokens already defined in layout.css (Design Tokens section) |
| DSGN-03 | Bold typography throughout with dramatic heading sizes | Cartridge font at 5-6rem hero, 3-4rem sections (Design Tokens section) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| SvelteKit | ^2.50.2 | App framework, routing, SSR | Already in use; handles auth-based routing natively |
| Svelte | ^5.49.2 | Component framework | Already in use; runes for reactive state |
| Tailwind CSS | ^4.1.18 | Utility-first styling | Already in use; all design tokens defined |
| @supabase/ssr | ^0.8.0 | Auth session detection | Already in use; needed for auth-based routing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tailwindcss/forms | ^0.5.11 | Form element styling | Already installed, no action needed |

### Alternatives Considered
None — this phase uses only what is already installed. No new dependencies required.

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Route Structure

The key architectural decision is how to handle the `/` route showing different content based on auth state. There are two viable approaches:

**Approach A: Conditional rendering in a single route (RECOMMENDED)**
```
src/routes/
├── +layout.svelte          # Root layout (exists)
├── +layout.server.ts       # Root server load (exists)
├── +layout.ts              # Root client load (exists)
├── +page.svelte            # NEW: Landing page (logged-out) or redirect (logged-in)
├── +page.server.ts         # NEW: Auth check, load dashboard data if logged in
├── (app)/
│   ├── +layout.svelte      # App shell with sidebar/nav (exists)
│   └── +page.svelte        # Dashboard content (MOVE to here or keep)
└── ...
```

**Approach B: Separate route groups**
```
src/routes/
├── (marketing)/
│   ├── +page.svelte        # Landing page
│   └── +page.server.ts     # Redirect if logged in
├── (app)/
│   ├── dashboard/
│   │   └── +page.svelte    # Dashboard (moved from +page.svelte)
│   └── ...
```

**Recommendation: Approach A** — simpler, fewer route changes, avoids moving the dashboard to a new URL.

### Pattern 1: Auth-Based Routing at `/`

**What:** The root `/` shows the landing page for logged-out visitors and redirects to the dashboard for logged-in users.

**Current problem:** `hooks.server.ts` line 32-38 redirects ALL unauthenticated requests (except `/auth/*` and `/share/*`) to the login page. The root `/` is inside the `(app)` route group, which wraps content in the sidebar/nav layout.

**Implementation strategy:**

1. **Modify `hooks.server.ts`** to exempt `/` (exact match) from the auth guard
2. **Create `src/routes/+page.server.ts`** (at root level, NOT inside `(app)`) that checks auth and redirects logged-in users
3. **Create `src/routes/+page.svelte`** with the landing page content
4. **Move dashboard** from `src/routes/(app)/+page.svelte` to `src/routes/(app)/dashboard/+page.svelte` (or keep at `/` with conditional rendering)

```typescript
// src/hooks.server.ts — modified auth guard
// Add exact '/' match to the exemption list
if (
  !event.url.pathname.startsWith('/auth') &&
  !event.url.pathname.startsWith('/share') &&
  event.url.pathname !== '/'  // Allow landing page
) {
  const { session } = await event.locals.safeGetSession();
  if (!session) {
    const returnUrl = event.url.pathname + event.url.search;
    throw redirect(303, `/auth?redirect=${encodeURIComponent(returnUrl)}`);
  }
}
```

```typescript
// src/routes/+page.server.ts — NEW root page load
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (session) {
    // Logged-in users go to dashboard
    throw redirect(303, '/dashboard');
  }
  // Logged-out users see landing page (no data needed)
  return {};
};
```

**Critical detail:** The new `src/routes/+page.svelte` renders OUTSIDE the `(app)` layout group, so it will NOT have the sidebar/nav shell. It uses the root `+layout.svelte` directly, which only provides the favicon and auth listener. This is exactly what we want — a clean, full-width marketing page.

**Dashboard relocation:** The current dashboard at `src/routes/(app)/+page.svelte` needs to move to `src/routes/(app)/dashboard/+page.svelte` (along with its `+page.server.ts`). Sidebar/BottomNav links for "Home" should update from `/` to `/dashboard`.

### Pattern 2: Landing Page Component Structure

**What:** The landing page as a single Svelte component with semantic sections.

```svelte
<!-- src/routes/+page.svelte -->
<svelte:head>
  <title>Setlist — Know your set. Own the stage.</title>
  <meta name="description" content="..." />
</svelte:head>

<div class="min-h-screen bg-surface-950 text-surface-100">
  <!-- Nav bar (minimal: logo + sign in link) -->
  <nav>...</nav>

  <!-- Hero section (~70-80vh) -->
  <section class="hero">...</section>

  <!-- Feature sections (3 alternating rows) -->
  <section class="features">...</section>

  <!-- Social proof section -->
  <section class="social-proof">...</section>

  <!-- Footer -->
  <footer>...</footer>
</div>
```

**Key insight:** The landing page is ALWAYS dark mode (per user decision "dark & dramatic aesthetic throughout"). It should NOT respect the dark/light theme toggle — it forces dark styling by using the dark palette colors directly (e.g., `bg-surface-950` instead of `bg-surface-50 dark:bg-surface-950`). This avoids visual flicker and ensures the dramatic aesthetic regardless of system preference.

### Pattern 3: Alternating Feature Layout

**What:** Full-width rows where screenshot and text alternate sides on desktop, stack on mobile.

```svelte
<!-- Desktop: even rows = image left, odd rows = image right -->
<!-- Mobile: always stacked (image on top, text below) -->

{#each features as feature, i}
  <div class="flex flex-col md:flex-row {i % 2 !== 0 ? 'md:flex-row-reverse' : ''} items-center gap-8 md:gap-12 py-16 md:py-24">
    <!-- Screenshot -->
    <div class="w-full md:w-1/2">
      <img src={feature.screenshot} alt={feature.alt}
        class="rounded-xl shadow-lg" />
    </div>
    <!-- Text -->
    <div class="w-full md:w-1/2">
      <h3 class="font-display text-3xl md:text-4xl text-surface-100">{feature.title}</h3>
      <p class="mt-4 text-lg text-surface-400">{feature.description}</p>
    </div>
  </div>
{/each}
```

### Pattern 4: Social Proof as Aspirational Statement

**What:** Instead of fake testimonials, use bold typographic statements about tool precision.

**Recommended treatment (Claude's Discretion — stats-style with typographic emphasis):**

A centered section with 2-3 bold stat-like statements, using the Cartridge display font at large sizes. No numbers that require real data — instead, capability-focused statements:

```
"Every second of your set, accounted for."
"One library. Unlimited setlists."
"Your band, in sync."
```

Each statement could be on its own line, large Cartridge font, with the accent/neon color for emphasis words. Below: the secondary CTA "Build Your First Setlist".

### Pattern 5: Minimal Footer

**What:** Simple footer with logo, few links, copyright.

```svelte
<footer class="border-t border-surface-800 px-6 py-12">
  <div class="mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
    <span class="font-display text-xl text-accent-500">Setlist</span>
    <div class="flex gap-6 text-sm text-surface-400">
      <a href="/auth">Sign Up</a>
      <a href="/auth">Log In</a>
    </div>
    <p class="text-sm text-surface-600">&copy; 2026 Setlist</p>
  </div>
</footer>
```

### Anti-Patterns to Avoid
- **Don't use the dark: variant prefix on the landing page:** The landing page is always dark. Using `dark:` classes means it would look different in light mode. Use the dark palette values directly.
- **Don't put the landing page inside the (app) route group:** It would inherit the sidebar/nav layout.
- **Don't conditionally render landing vs dashboard in the same component:** Use server-side redirects instead — cleaner separation, no layout flash.
- **Don't create a separate (marketing) route group:** Unnecessary complexity for a single page.

## Design Tokens (Already Available)

The entire design system is defined in `src/routes/layout.css`:

### Color Palette
| Token | Hex | Use on Landing Page |
|-------|-----|---------------------|
| `surface-950` | `#080c13` | Page background (deepest dark) |
| `surface-900` | `#0f1720` | Section background variations |
| `surface-800` | `#162030` | Card/panel backgrounds |
| `surface-700` | `#1e2a3d` | Borders, subtle dividers |
| `surface-400` | `#5a7190` | Body text (muted) |
| `surface-100` | `#d0dce8` | Primary text (headings, hero) |
| `accent-400` | `#a78265` | CTA buttons, brand color (copper) |
| `accent-500` | `#8a6a4f` | CTA hover state |
| `neon-300` | `#d1d895` | Emphasis/highlight accents (chartreuse) |
| `neon-400` | `#bcc56e` | Secondary accent |

### Typography
| Font | Family | Use |
|------|--------|-----|
| Cartridge | `font-display` | All headings (h1-h6 auto-apply via layout.css rule) |
| Klima | `font-sans` | Body text |

**Available Cartridge weights:** 300 (Light), 400 (Regular), 600 (Semibold), 700 (Bold), 900 (Black)
**Available Klima weights:** 300 (Light), 400 (Regular), 500 (Medium), 700 (Bold)

### Recommended Typography Scale for Landing Page
| Element | Size (mobile) | Size (desktop) | Weight | Font |
|---------|---------------|----------------|--------|------|
| Hero headline | `text-4xl` (2.25rem) | `text-7xl` (4.5rem) to `text-8xl` (6rem) | 900 (Black) | Cartridge |
| Hero subheadline | `text-lg` (1.125rem) | `text-xl` (1.25rem) | 400 | Klima |
| Section headings | `text-2xl` (1.5rem) | `text-4xl` (2.25rem) | 700 (Bold) | Cartridge |
| Feature descriptions | `text-base` (1rem) | `text-lg` (1.125rem) | 400 | Klima |
| Social proof statements | `text-xl` (1.25rem) | `text-3xl` (1.875rem) | 600 (Semibold) | Cartridge |

**Note:** For the 5-6rem+ hero headline on desktop, Tailwind's `text-7xl` is 4.5rem and `text-8xl` is 6rem. Use `text-8xl` or a custom size for the dramatic effect. The `text-[5.5rem]` arbitrary value syntax works in Tailwind v4.

### Shadows/Glows (for screenshot cards)
| Token | Effect |
|-------|--------|
| `shadow-lg` | Card depth |
| `shadow-glow-accent` | Copper glow for CTA buttons |
| `shadow-glow-neon` | Chartreuse glow for highlights |

## Screenshot Strategy

### What to Screenshot
The three core capabilities to showcase:
1. **Setlist timing** — The setlist builder view with the TimingBar showing total/target/diff and progress bar
2. **Song library** — The songs list view showing titles and durations
3. **Band collaboration** — The band members view or band setlists view

### Screenshot Implementation
- Screenshots should be placed as static files: `static/images/screenshots/`
- Use PNG format for UI screenshots (sharp text)
- Crop to show just the relevant UI portion (floating UI crops, no device frames per user decision)
- Recommended dimensions: ~800-1200px wide, variable height based on content
- Add `rounded-xl shadow-lg` for card-like presentation
- Consider adding a subtle border (`border border-surface-700`) to define edges against dark backgrounds

### Important Note
Screenshots need to be manually captured from the running app. The planner should include a task for creating placeholder images that can be replaced with real screenshots. Placeholder images could be solid color blocks with text labels indicating what screenshot goes there.

## Responsive Strategy

### Breakpoints (from existing codebase patterns)
The app uses Tailwind's default breakpoints:
| Breakpoint | Min Width | Use in Landing Page |
|------------|-----------|---------------------|
| (default) | 0px | Mobile-first base styles |
| `sm` | 640px | Minor spacing adjustments |
| `md` | 768px | Feature rows go side-by-side, nav horizontal |
| `lg` | 1024px | Max-width containers, larger spacing |

### Responsive Patterns (from existing codebase)
- **Grid layouts:** `grid gap-6 sm:grid-cols-2 lg:grid-cols-3` (seen in dashboard)
- **Flex direction switching:** `flex flex-col md:flex-row` (common pattern)
- **Hidden/shown elements:** `hidden md:flex` / `md:hidden` (sidebar vs bottom nav)
- **Container max-width:** Use `max-w-6xl mx-auto px-6` for content sections

### Landing Page Responsive Plan
- **Mobile (< 768px):** Single column, hero at ~60vh, stacked features, smaller type
- **Tablet (768px+):** Side-by-side feature layout, hero at ~70vh
- **Desktop (1024px+):** Full-width sections with max-width content, hero at ~80vh, dramatic typography

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth detection | Custom cookie parsing | `safeGetSession()` from existing locals | Already implemented and secure |
| Responsive grid | Custom media queries | Tailwind responsive prefixes (`md:`, `lg:`) | Consistent with rest of app |
| Dark theme colors | New CSS variables | Existing `surface-*`, `accent-*`, `neon-*` tokens | Full palette already defined |
| Display font | Loading new fonts | Cartridge (already loaded in layout.css) | Available at weights 300-900 |
| Route protection | Client-side auth checks | Server-side redirect in `+page.server.ts` | No flash of wrong content |

**Key insight:** This phase needs zero new dependencies. Everything required is already in the stack.

## Common Pitfalls

### Pitfall 1: Auth Guard Blocks Landing Page
**What goes wrong:** The hooks.server.ts auth guard redirects logged-out visitors at `/` to `/auth`, preventing them from ever seeing the landing page.
**Why it happens:** The current guard exempts only `/auth/*` and `/share/*` paths.
**How to avoid:** Modify the guard to also exempt the exact path `/` before any other work.
**Warning signs:** Landing page returns 303 redirect instead of 200.

### Pitfall 2: Landing Page Inherits App Layout
**What goes wrong:** The landing page shows inside the sidebar/nav shell meant for authenticated users.
**Why it happens:** If the landing page `+page.svelte` is placed inside the `(app)/` route group, it inherits the `(app)/+layout.svelte` which includes Sidebar and BottomNav.
**How to avoid:** Place the landing page route at `src/routes/+page.svelte` (root level), outside the `(app)` group.
**Warning signs:** Sidebar visible on landing page, content squeezed into the app layout.

### Pitfall 3: Flash of Wrong Content (FOUC)
**What goes wrong:** Logged-in users briefly see the landing page before client-side redirect kicks in.
**Why it happens:** Using client-side auth detection (`onMount` check) instead of server-side redirect.
**How to avoid:** Use `+page.server.ts` with `throw redirect(303, '/dashboard')` for logged-in users. This happens on the server before any HTML is sent.
**Warning signs:** Brief flash of landing page when navigating to `/` while logged in.

### Pitfall 4: Dark/Light Mode Inconsistency
**What goes wrong:** Landing page looks wrong in light mode because it uses `dark:` prefixed classes.
**Why it happens:** The app supports theme toggling, but the landing page should always be dark.
**How to avoid:** Use the dark palette colors directly (e.g., `bg-surface-950`, `text-surface-100`) without `dark:` variants. The landing page forces a dark aesthetic regardless of system preference.
**Warning signs:** Landing page has light backgrounds or wrong contrast in light mode.

### Pitfall 5: Dashboard Route Collision
**What goes wrong:** After creating root `+page.svelte`, the `(app)/+page.svelte` dashboard route conflicts because both resolve to `/`.
**Why it happens:** SvelteKit route groups like `(app)` don't add path segments — `(app)/+page.svelte` and `+page.svelte` both match `/`.
**How to avoid:** Move the dashboard to `src/routes/(app)/dashboard/+page.svelte` and update nav links accordingly.
**Warning signs:** Build errors or unexpected page rendering at `/`.

### Pitfall 6: CTA Link Goes Nowhere Useful
**What goes wrong:** "Build Your First Setlist" CTA button links to sign-up, but user lands on generic dashboard after auth.
**Why it happens:** Default redirect after auth goes to `/` which is now the landing page for logged-out users.
**How to avoid:** CTA should link to `/auth?redirect=/dashboard` (or `/auth?redirect=/setlists`) so after sign-up the user lands on a useful page, not back at the landing page.
**Warning signs:** User signs up, gets redirected back to landing page or login screen.

## Code Examples

### Server-Side Auth Redirect
```typescript
// src/routes/+page.server.ts
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals: { safeGetSession } }) => {
  const { session } = await safeGetSession();
  if (session) {
    throw redirect(303, '/dashboard');
  }
  return {};
};
```

### CTA Button Linking to Auth
```svelte
<a
  href="/auth?redirect=/dashboard"
  class="inline-flex items-center rounded-lg bg-accent-400 px-8 py-4 font-display text-lg font-bold text-surface-950 shadow-glow-accent transition-all hover:bg-accent-300 hover:shadow-lg"
>
  Build Your First Setlist
</a>
```

### Forced Dark Background (No Theme Dependency)
```svelte
<!-- Always dark, regardless of system preference -->
<div class="min-h-screen bg-surface-950 text-surface-100">
  <!-- All children use dark palette values directly -->
</div>
```

### Responsive Hero Section
```svelte
<section class="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center md:min-h-[70vh] lg:min-h-[80vh]">
  <h1 class="font-display text-4xl font-black leading-tight text-surface-100 md:text-6xl lg:text-8xl">
    Know your set.<br />Own the stage.
  </h1>
  <p class="mt-6 max-w-2xl text-lg text-surface-400 md:text-xl">
    Build setlists, track timing to the second, and keep your band in sync — all in one place.
  </p>
  <a href="/auth?redirect=/dashboard" class="mt-10 ...">
    Build Your First Setlist
  </a>
</section>
```

### Section Divider
```svelte
<!-- Subtle gradient fade divider -->
<div class="mx-auto h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-surface-700 to-transparent"></div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SvelteKit load functions with fetch | SvelteKit load with Svelte 5 runes | Svelte 5 (2024) | Use `$props()` not `export let data` |
| Tailwind v3 with config file | Tailwind v4 with CSS-first config | Tailwind v4 (2025) | Theme defined in `@theme {}` block in CSS, not tailwind.config.js |
| Route layouts via `__layout.svelte` | Route groups via `(group)/+layout.svelte` | SvelteKit 1.0 (2022) | Use `(app)` grouping to scope layouts |

**Deprecated/outdated:**
- `export let` for props in Svelte 5 — use `$props()` instead (already done in this codebase)
- `$:` reactive declarations — use `$derived` and `$effect` (already done in this codebase)

## Open Questions

1. **Screenshot images — when to capture?**
   - What we know: Screenshots need to show actual app UI. Placeholder images can be used during development.
   - What's unclear: Whether to use dev screenshots or set up a demo account with staged data.
   - Recommendation: Use placeholder colored boxes with labels during implementation. Replace with real screenshots as a final polish step. The planner should include this as a separate task.

2. **Auth callback redirect after sign-up**
   - What we know: Current auth callback in `src/routes/auth/callback/+server.ts` redirects to the `redirect` query parameter or `/` by default.
   - What's unclear: After the landing page is at `/`, the default redirect should probably go to `/dashboard` instead of `/`.
   - Recommendation: Update the default redirect in the auth callback from `/` to `/dashboard`. This is a small but important change to avoid redirect loops.

3. **SEO metadata**
   - What we know: The landing page needs good SEO for discoverability.
   - What's unclear: Whether to add Open Graph tags, structured data, etc. in this phase.
   - Recommendation: Add basic meta tags (title, description) in `<svelte:head>`. Full OG/structured data can be a future enhancement (LAND-04 in requirements).

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** — Direct reading of `hooks.server.ts`, route files, `layout.css`, `package.json`, and all component files
- **SvelteKit routing** — Route groups and server-side load patterns verified from codebase usage

### Secondary (MEDIUM confidence)
- **SvelteKit docs** — Route group behavior and load function redirect patterns are well-established SvelteKit patterns used throughout this codebase
- **Tailwind v4** — CSS-first configuration verified from `layout.css` `@theme {}` block in the codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries, entire stack already in use and verified from package.json
- Architecture: HIGH — routing patterns verified from existing codebase; auth guard, route groups, and server loads all have working examples
- Pitfalls: HIGH — identified from direct codebase analysis of auth guard behavior and route group mechanics
- Design tokens: HIGH — complete palette read directly from layout.css
- Screenshot strategy: MEDIUM — approach is sound but actual screenshot capture is a manual process

**Research date:** 2026-02-26
**Valid until:** 2026-03-26 (stable — no fast-moving dependencies)
