# Phase 1: Foundation and Auth - Research

**Researched:** 2026-02-17
**Domain:** Supabase Auth (Google OAuth), SvelteKit SSR, App Shell with Dark/Light Mode
**Confidence:** HIGH

## Summary

Phase 1 requires setting up Supabase authentication with Google OAuth in a SvelteKit 2 / Svelte 5 application, creating a protected app shell with sidebar navigation (desktop) and bottom tab bar (mobile), and implementing a warm/amber themed design with dark and light mode toggling.

The `@supabase/ssr` package (v0.8.0) is the current standard for server-side auth in SvelteKit. It replaces the deprecated `@supabase/auth-helpers-sveltekit` package and provides `createServerClient` and `createBrowserClient` functions that handle cookie-based session management automatically. The PKCE flow is required for server-side OAuth. Tailwind CSS v4 supports manual dark mode toggling via `@custom-variant dark (&:where(.dark, .dark *))` in the CSS file.

**Primary recommendation:** Use the official Supabase SSR pattern with `hooks.server.ts` for session management and route protection, PKCE flow for Google OAuth with a `/auth/callback` server route, and layout groups for organizing protected vs. public routes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Visual Identity:** Warm and musical aesthetic -- rich colors, textured feel, analog/vinyl vibes
- **Primary/accent color:** amber/gold -- like tube amp glow
- **Theme:** Dark and light mode with user toggle (both themes from day one)
- **Typography:** Slightly retro feel -- slab or rounded fonts that nod to gig posters
- **Overall direction:** Warm, inviting, musical -- not sterile or corporate
- **Desktop navigation:** Left sidebar (like Linear or Spotify)
- **Mobile navigation:** Bottom tab bar (thumb-friendly, replaces sidebar on small screens)
- **Sidebar sections:** Home, Songs, Setlists, Settings
- **Bands section:** Added to sidebar in Phase 4 (not this phase)
- **Post sign-in landing:** Dashboard/home page with recent setlists and quick stats
- **Login experience:** Google OAuth sign-in page -- clean, branded with warm/amber aesthetic
- **Post-auth redirect:** Dashboard

### Claude's Discretion
- Exact font choices (within the "slightly retro" direction -- slab serif or rounded sans)
- Dark/light mode color scales (built around amber/gold accent)
- Dashboard home page layout and content (recent setlists, quick actions)
- Error states for auth failures
- Session expiry handling
- Loading states and transitions

### Deferred Ideas (OUT OF SCOPE)
- None specified
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can sign in with Google OAuth | Supabase `signInWithOAuth({ provider: 'google' })` with PKCE flow, callback route at `/auth/callback/+server.ts` exchanges code for session |
| AUTH-02 | User session persists across browser refresh | `@supabase/ssr` cookie-based sessions; `+layout.server.ts` passes session, `+layout.ts` creates browser client that reads cookies; `depends('supabase:auth')` enables reactivity |
| AUTH-03 | User can log out from any page | `supabase.auth.signOut()` available via layout-provided client; `invalidate('supabase:auth')` triggers re-evaluation; `hooks.server.ts` redirect guard sends unauthenticated users to login |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | ^2.96.0 | Supabase client (auth, DB, realtime) | Official Supabase JS client |
| `@supabase/ssr` | ^0.8.0 | SSR-aware auth with cookie management | Official replacement for deprecated auth-helpers; framework-agnostic cookie handling |
| `@sveltejs/kit` | ^2.50.2 | Already installed | App framework |
| `svelte` | ^5.49.2 | Already installed | UI framework |
| `tailwindcss` | ^4.1.18 | Already installed | Utility-first CSS |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tailwindcss/forms` | ^0.5.11 | Already installed | Form element reset styling for login form |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@supabase/ssr` | `@supabase/auth-helpers-sveltekit` | Deprecated -- do NOT use; `@supabase/ssr` is the replacement |
| Manual dark mode | `mode-watcher` | Adds a dependency for something achievable with ~20 lines of code + localStorage |
| Custom sidebar | Flowbite/shadcn-svelte sidebar | Adds component library dependency; custom is fine for 4 nav items |

**Installation:**
```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app.d.ts                           # Type declarations (Locals, PageData)
├── app.html                           # HTML shell (dark mode script in <head>)
├── hooks.server.ts                    # Supabase server client + auth guard
├── lib/
│   ├── assets/                        # Static assets (favicon, etc.)
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.svelte         # Desktop left sidebar
│   │   │   ├── BottomNav.svelte       # Mobile bottom tab bar
│   │   │   └── ThemeToggle.svelte     # Dark/light mode toggle
│   │   └── ui/                        # Shared UI primitives
│   ├── stores/
│   │   └── theme.ts                   # Theme state (dark/light/system)
│   └── index.ts                       # Barrel export
├── routes/
│   ├── +layout.server.ts              # Pass session + cookies to client
│   ├── +layout.ts                     # Create browser/server Supabase client
│   ├── +layout.svelte                 # Root layout (auth listener, theme)
│   ├── layout.css                     # Tailwind imports + custom variant
│   ├── auth/
│   │   ├── +page.svelte               # Login page (Google sign-in button)
│   │   └── callback/
│   │       └── +server.ts             # OAuth code exchange endpoint
│   └── (app)/                         # Layout group for protected routes
│       ├── +layout.svelte             # App shell (sidebar + bottom nav)
│       ├── +page.svelte               # Dashboard / Home
│       ├── songs/
│       │   └── +page.svelte           # Placeholder
│       ├── setlists/
│       │   └── +page.svelte           # Placeholder
│       └── settings/
│           └── +page.svelte           # Placeholder (includes logout)
```

### Pattern 1: Supabase Server Client in hooks.server.ts
**What:** Create a Supabase server client per request, attach to `event.locals`, and guard protected routes.
**When to use:** Every request -- this is the SSR entry point.

```typescript
// src/hooks.server.ts
// Source: https://supabase.com/docs/guides/getting-started/tutorials/with-sveltekit
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public'
import { createServerClient } from '@supabase/ssr'
import { type Handle, redirect } from '@sveltejs/kit'

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => event.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          event.cookies.set(name, value, { ...options, path: '/' })
        })
      },
    },
  })

  event.locals.safeGetSession = async () => {
    const {
      data: { user },
      error,
    } = await event.locals.supabase.auth.getUser()
    if (error) {
      return { session: null, user: null }
    }
    const {
      data: { session },
    } = await event.locals.supabase.auth.getSession()
    return { session, user }
  }

  // Auth guard: protect all routes except /auth/*
  if (!event.url.pathname.startsWith('/auth')) {
    const { session } = await event.locals.safeGetSession()
    if (!session) {
      throw redirect(303, '/auth')
    }
  }

  return resolve(event, {
    filterSerializedResponseHeaders(name) {
      return name === 'content-range' || name === 'x-supabase-api-version'
    },
  })
}
```

### Pattern 2: Layout Server + Client Chain
**What:** Pass session from server to client, create appropriate Supabase client based on environment.
**When to use:** Root layout -- provides Supabase client and session to all routes.

```typescript
// src/routes/+layout.server.ts
// Source: https://supabase.com/docs/guides/getting-started/tutorials/with-sveltekit
import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals: { safeGetSession }, cookies }) => {
  const { session, user } = await safeGetSession()
  return {
    session,
    user,
    cookies: cookies.getAll(),
  }
}
```

```typescript
// src/routes/+layout.ts
// Source: https://supabase.com/docs/guides/getting-started/tutorials/with-sveltekit
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public'
import type { LayoutLoad } from './$types'
import { createBrowserClient, createServerClient, isBrowser } from '@supabase/ssr'

export const load: LayoutLoad = async ({ data, depends, fetch }) => {
  depends('supabase:auth')

  const supabase = isBrowser()
    ? createBrowserClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
        global: { fetch },
      })
    : createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
        global: { fetch },
        cookies: {
          getAll() {
            return data.cookies
          },
        },
      })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  return { supabase, session, user: data.user }
}
```

### Pattern 3: OAuth Callback Route (PKCE)
**What:** Server endpoint that exchanges the OAuth authorization code for a session.
**When to use:** After Google redirects back to the app.

```typescript
// src/routes/auth/callback/+server.ts
// Source: https://github.com/supabase-community/supabase-by-example
import { redirect } from '@sveltejs/kit'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url, locals: { supabase } }) => {
  const code = url.searchParams.get('code')

  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
  }

  redirect(303, '/')
}
```

### Pattern 4: Google OAuth Sign-In
**What:** Initiate Google OAuth with PKCE flow.
**When to use:** Login page button handler.

```typescript
// In login page component
const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
  if (error) {
    console.error('OAuth error:', error.message)
  }
}
```

### Pattern 5: Dark Mode with Tailwind CSS v4
**What:** Manual dark mode toggle using class strategy and localStorage.
**When to use:** App-wide theme switching.

```css
/* src/routes/layout.css */
/* Source: https://tailwindcss.com/docs/dark-mode */
@import 'tailwindcss';
@plugin '@tailwindcss/forms';
@custom-variant dark (&:where(.dark, .dark *));
```

```html
<!-- In app.html <head>, BEFORE %sveltekit.head% to prevent FOUC -->
<script>
  (function() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  })();
</script>
```

### Pattern 6: Type Declarations
**What:** Extend SvelteKit's `App` namespace for Supabase types.
**When to use:** Once, in `app.d.ts`.

```typescript
// src/app.d.ts
// Source: https://supabase.com/docs/guides/getting-started/tutorials/with-sveltekit
import type { SupabaseClient, Session, User } from '@supabase/supabase-js'

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient
      safeGetSession(): Promise<{ session: Session | null; user: User | null }>
    }
    interface PageData {
      session: Session | null
      user: User | null
    }
  }
}

export {}
```

### Anti-Patterns to Avoid
- **Auth guard in `+layout.server.ts`:** Load functions run in parallel, so a layout guard does NOT prevent child load functions from executing. Use `hooks.server.ts` instead.
- **Using `getSession()` alone for server-side auth checks:** `getSession()` reads from cookies which can be tampered with. Always use `getUser()` first (calls Supabase Auth server to validate the JWT), then `getSession()` for the session object. This is what `safeGetSession` does.
- **Importing `@supabase/auth-helpers-sveltekit`:** This package is deprecated. Use `@supabase/ssr` instead.
- **Storing theme in a Svelte store alone:** Causes flash of wrong theme on page load. Must use inline `<script>` in `app.html` `<head>` to set class before render.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cookie-based auth sessions | Custom cookie management | `@supabase/ssr` `createServerClient` | Handles token refresh, chunked cookies for large JWTs, PKCE code verifier storage |
| JWT validation | Manual JWT decode/verify | `supabase.auth.getUser()` | Server-side validation against Supabase Auth; handles expiry, revocation |
| OAuth PKCE flow | Manual code_verifier/challenge | `signInWithOAuth()` + `exchangeCodeForSession()` | PKCE is security-critical; code_verifier stored in cookies by `@supabase/ssr` |
| Dark mode persistence | Custom implementation from scratch | localStorage + inline `<script>` + Tailwind `@custom-variant` | Well-established pattern; key detail is the inline script to prevent FOUC |

**Key insight:** Supabase SSR auth has many subtle edge cases (chunked cookies, PKCE code_verifier timing, token refresh races). The `@supabase/ssr` package handles all of them. Custom cookie management is the #1 source of auth bugs in SvelteKit + Supabase apps.

## Common Pitfalls

### Pitfall 1: Flash of Unstyled Content (FOUC) with Dark Mode
**What goes wrong:** Page loads in light mode, then flashes to dark after JS hydrates.
**Why it happens:** Theme preference is stored in localStorage, which is only accessible after JS loads. The `<html>` element starts without the `dark` class.
**How to avoid:** Add an inline `<script>` in `app.html` `<head>` (before `%sveltekit.head%`) that synchronously reads localStorage and applies the `dark` class.
**Warning signs:** Brief white flash when navigating to the app in dark mode.

### Pitfall 2: Auth Guard in Layout Instead of Hooks
**What goes wrong:** Protected page load functions execute before the layout auth check completes, potentially leaking data or causing errors.
**Why it happens:** SvelteKit runs load functions in parallel. `+layout.server.ts` load does not block `+page.server.ts` load.
**How to avoid:** Protect routes in `hooks.server.ts` `handle` function, which runs BEFORE all load functions.
**Warning signs:** Unauthenticated users briefly seeing protected content, or server errors from load functions that assume a user exists.

### Pitfall 3: Using getSession() for Server Auth Checks
**What goes wrong:** Auth can be spoofed because `getSession()` reads from cookies without server validation.
**Why it happens:** `getSession()` trusts the cookie data. A malicious user could forge cookie values.
**How to avoid:** Always call `getUser()` first (validates JWT against Supabase Auth server), then `getSession()` if needed. The `safeGetSession` pattern in `hooks.server.ts` does this correctly.
**Warning signs:** Security audit flags, or auth bypass in testing.

### Pitfall 4: Missing `path: '/'` in Cookie Options
**What goes wrong:** Cookies are scoped to specific paths, causing auth to work on some routes but not others.
**Why it happens:** SvelteKit's `cookies.set()` requires an explicit `path`. Without `path: '/'`, the cookie is scoped to the current path.
**How to avoid:** Always spread `{ ...options, path: '/' }` in the `setAll` cookie handler.
**Warning signs:** User is logged in on one page but logged out when navigating to another.

### Pitfall 5: PKCE Code Verifier Cookie Missing
**What goes wrong:** OAuth callback fails with "both auth code and code verifier should be non-empty".
**Why it happens:** The `code_verifier` is stored in a cookie during `signInWithOAuth()`. If cookies are misconfigured or cleared between the redirect, the exchange fails.
**How to avoid:** Ensure the `setAll` cookie handler works correctly. Test the full OAuth flow end-to-end. Verify cookies are not being blocked by browser settings.
**Warning signs:** OAuth works in some browsers but not others; intermittent auth failures.

### Pitfall 6: Supabase Environment Variables Not Prefixed
**What goes wrong:** Variables are undefined at runtime or not exposed to client-side code.
**Why it happens:** SvelteKit requires `PUBLIC_` prefix for client-accessible environment variables. Supabase URL and anon key must be public.
**How to avoid:** Use `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_PUBLISHABLE_KEY` (note: "publishable key" is the new name for "anon key" in recent Supabase docs).
**Warning signs:** `undefined` errors when creating the Supabase client.

## Code Examples

Verified patterns from official sources (see Architecture Patterns section above for complete code):

### Sign Out from Any Page
```typescript
// In any component that has access to the supabase client from layout data
const signOut = async () => {
  await supabase.auth.signOut()
  // invalidate triggers +layout.ts to re-run, which updates session
  invalidate('supabase:auth')
  // hooks.server.ts guard will redirect to /auth on next navigation
  goto('/auth')
}
```

### Auth State Listener in Root Layout
```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { invalidate } from '$app/navigation'
  import { onMount } from 'svelte'

  let { data, children } = $props()

  onMount(() => {
    const { data: { subscription } } = data.supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.expires_at !== data.session?.expires_at) {
          invalidate('supabase:auth')
        }
      }
    )

    return () => subscription.unsubscribe()
  })
</script>

{@render children()}
```

### Theme Toggle Component Pattern
```svelte
<!-- src/lib/components/layout/ThemeToggle.svelte -->
<script lang="ts">
  let isDark = $state(false)

  // Sync with actual DOM state on mount
  $effect(() => {
    isDark = document.documentElement.classList.contains('dark')
  })

  function toggle() {
    isDark = !isDark
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }
</script>

<button onclick={toggle} aria-label="Toggle dark mode">
  {isDark ? 'Light' : 'Dark'}
</button>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-sveltekit` | `@supabase/ssr` ^0.8.0 | 2024 | Single package for all frameworks; `getAll`/`setAll` cookie API |
| `PUBLIC_SUPABASE_ANON_KEY` | `PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 2025 (Supabase docs) | Renamed in docs; both still work but "publishable key" is the new terminology |
| Tailwind `darkMode: 'class'` config | `@custom-variant dark (&:where(.dark, .dark *))` in CSS | Tailwind v4 (2025) | Config moved from JS to CSS; no `tailwind.config.js` needed |
| `getSession()` for auth checks | `getUser()` + `getSession()` (safeGetSession pattern) | 2024 | Security fix: `getSession()` alone is insufficient for server-side verification |
| Svelte 4 `export let data` | Svelte 5 `let { data } = $props()` | 2024 | Runes syntax; `$props()` replaces `export let` |
| Svelte 4 `{@html children}` | Svelte 5 `{@render children()}` | 2024 | Snippets replace slots |

**Deprecated/outdated:**
- `@supabase/auth-helpers-sveltekit`: Replaced by `@supabase/ssr`
- `@supabase/auth-helpers-shared`: Replaced by `@supabase/ssr`
- Tailwind `darkMode` in `tailwind.config.js`: Replaced by `@custom-variant` in CSS for Tailwind v4
- `export let` in Svelte components: Replaced by `$props()` runes in Svelte 5

## Font Recommendations (Claude's Discretion)

For the "slightly retro, gig poster" direction with Google Fonts:

**Recommended heading font: Righteous**
- 70s-inspired, bold, smooth curves
- Works well for display text and navigation
- Single weight (400) keeps it simple
- Google Fonts: free, self-hostable

**Recommended body font: Inter or Nunito**
- Inter: clean, highly readable, pairs well with display fonts
- Nunito: more rounded, warmer feel, closer to the "friendly" vibe
- Both have excellent weight ranges for UI work

**Alternative heading options:**
- **Zilla Slab**: Contemporary slab serif, strong but modern
- **Caprasimo**: Bubbly, rounded, 70s groove (display only)
- **Bevan**: Traditional slab serif reinterpreted for screens

**Recommendation:** Righteous (headings/nav) + Nunito (body) for the warmest combination that reads "musical" without sacrificing readability.

## Color Scale Recommendations (Claude's Discretion)

**Amber/Gold accent palette (built around Tailwind `amber`):**
- Primary: `amber-500` (#f59e0b) -- tube amp glow
- Primary hover: `amber-600` (#d97706)
- Primary muted: `amber-400` (#fbbf24)

**Light mode:**
- Background: `stone-50` (#fafaf9) -- warm white, not blue-white
- Surface: `white` with subtle warm tint
- Text: `stone-900` (#1c1917)
- Text muted: `stone-500` (#78716c)
- Border: `stone-200` (#e7e5e4)

**Dark mode:**
- Background: `stone-950` (#0c0a09) -- warm black
- Surface: `stone-900` (#1c1917)
- Text: `stone-100` (#f5f5f4)
- Text muted: `stone-400` (#a8a29e)
- Border: `stone-800` (#292524)
- Amber glow effect: `amber-500/20` as subtle accent shadows

**Why stone over gray/slate/zinc:** Stone has warm undertones that complement amber/gold. Gray/slate/zinc are cool-toned and would fight the warm aesthetic.

## Open Questions

1. **Supabase project setup**
   - What we know: Need a Supabase project with Google OAuth enabled
   - What's unclear: Whether the user already has a Supabase project created
   - Recommendation: Include Supabase project creation and Google Cloud Console OAuth setup as a prerequisite/manual step in the plan (not automatable by code)

2. **Database schema for Phase 1**
   - What we know: Supabase provides `auth.users` automatically. A `profiles` table is the standard pattern for app-specific user data.
   - What's unclear: Whether Phase 1 needs a `profiles` table or can defer to Phase 2 (songs/setlists)
   - Recommendation: Create a minimal `profiles` table (id, display_name, avatar_url, created_at) with RLS policies. It's needed for the dashboard and costs nothing to set up now. This prevents a migration headache later.

3. **`PUBLIC_SUPABASE_PUBLISHABLE_KEY` vs `PUBLIC_SUPABASE_ANON_KEY`**
   - What we know: Recent Supabase docs use "publishable key" terminology. The actual key value is the same anon key.
   - What's unclear: Whether the env var name matters functionally (it doesn't -- it's just a string the app reads)
   - Recommendation: Use `PUBLIC_SUPABASE_PUBLISHABLE_KEY` to match current Supabase docs, but note in comments that this is the "anon key" from the Supabase dashboard.

## Sources

### Primary (HIGH confidence)
- Supabase Official Docs: [Build a User Management App with SvelteKit](https://supabase.com/docs/guides/getting-started/tutorials/with-sveltekit) -- Complete hooks.server.ts, +layout.ts, +layout.server.ts, app.d.ts code
- Supabase Official Docs: [Setting up Server-Side Auth for SvelteKit](https://supabase.com/docs/guides/auth/server-side/sveltekit) -- SSR auth pattern overview
- Supabase Official Docs: [Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google) -- Google OAuth setup, PKCE flow, callback handler
- Supabase Official Docs: [Creating a Supabase Client for SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=sveltekit) -- createBrowserClient/createServerClient API
- Tailwind CSS Official Docs: [Dark Mode](https://tailwindcss.com/docs/dark-mode) -- v4 @custom-variant syntax, manual toggle pattern
- npm registry: `@supabase/ssr` v0.8.0, peer dep `@supabase/supabase-js` ^2.76.1
- npm registry: `@supabase/supabase-js` v2.96.0

### Secondary (MEDIUM confidence)
- [supabase-community/supabase-by-example](https://github.com/supabase-community/supabase-by-example/blob/main/oauth-flow/sveltekit/src/routes/(auth)/auth/callback/+server.ts) -- OAuth callback pattern for SvelteKit
- [j4w8n/sveltekit-supabase-ssr](https://github.com/j4w8n/sveltekit-supabase-ssr) -- Reference implementation with session validation
- [Protected Routes in SvelteKit](https://gebna.gg/blog/protected-routes-svelte-kit) -- Why hooks.server.ts over +layout.server.ts for auth guards
- [SvelteKit Advanced Routing (Route Groups)](https://svelte.dev/tutorial/kit/route-groups) -- Layout group pattern docs

### Tertiary (LOW confidence)
- Google Fonts font choices -- based on web search of "retro slab serif gig poster" recommendations; should be validated visually before committing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- verified via npm registry (exact versions) and official Supabase docs
- Architecture: HIGH -- all patterns from official Supabase SvelteKit tutorial with verified code
- Pitfalls: HIGH -- documented in official Supabase discussions and multiple community sources
- Visual design (fonts/colors): MEDIUM -- font recommendations from web searches; color palette extrapolated from Tailwind defaults. Both need visual validation.

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- Supabase SSR API is stable at v0.8.0; Tailwind v4 dark mode API is stable)
