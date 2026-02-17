# Technology Stack

**Project:** Setlist
**Researched:** 2026-02-17
**Overall confidence:** MEDIUM -- external verification tools were unavailable; recommendations based on training data (cutoff May 2025). Version numbers should be verified against npm before installing.

## Already Decided (Locked In)

These are pre-selected and already in `package.json`. Not up for debate.

| Technology | Version (in package.json) | Purpose |
|------------|---------------------------|---------|
| SvelteKit 2 | ^2.50.2 | Full-stack framework |
| Svelte 5 | ^5.49.2 | UI framework (runes reactivity) |
| Tailwind CSS v4 | ^4.1.18 | Styling |
| @tailwindcss/forms | ^0.5.11 | Form element styling |
| @sveltejs/adapter-netlify | ^5.2.4 | Netlify deployment |
| TypeScript | ^5.9.3 | Type safety |
| Vite 7 | ^7.3.1 | Build tool |
| Prettier | ^3.8.1 | Code formatting |

## Recommended Stack

### Supabase Client + Auth

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| @supabase/supabase-js | ^2.x | Supabase client (DB, auth, realtime) | Official JS client; includes auth, Postgres queries, realtime subscriptions, storage | HIGH |
| @supabase/ssr | ^0.5.x | Server-side auth for SvelteKit | Replaces deprecated `@supabase/auth-helpers-sveltekit`; handles cookie-based session management in SSR context; required for secure server-side auth in SvelteKit | HIGH |

**Why @supabase/ssr over auth-helpers:** Supabase deprecated the framework-specific auth helpers in favor of the generic `@supabase/ssr` package. It provides `createServerClient` and `createBrowserClient` helpers that work with SvelteKit's `hooks.server.ts` and `+layout.server.ts` patterns. This is the officially recommended approach.

**Why NOT @supabase/auth-helpers-sveltekit:** Deprecated. Do not use. Supabase consolidated all framework SSR helpers into `@supabase/ssr`.

### Drag-and-Drop

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| svelte-dnd-action | ^0.9.x | Drag-and-drop for setlist song ordering | Purpose-built for Svelte; uses the `use:dndzone` action pattern; supports keyboard accessibility, auto-scroll, and works with Svelte's reactivity model. Most mature DnD library in the Svelte ecosystem | MEDIUM |

**Svelte 5 compatibility note:** svelte-dnd-action was built for Svelte 3/4. As of my training cutoff, the author was working on Svelte 5 compatibility. **VERIFY before installing** that the current version supports Svelte 5 runes. If it does not yet, the fallback plan is:

**Fallback option: SortableJS + custom Svelte 5 action.** SortableJS is framework-agnostic and can be wrapped in a Svelte `use:` action with minimal code (~30 lines). Less ergonomic than svelte-dnd-action but guaranteed to work.

**Why NOT @dnd-kit (React-only):** React library. Not usable in Svelte.
**Why NOT HTML5 native drag-and-drop:** Poor mobile support, no auto-scroll, no keyboard accessibility. Not worth the effort for a production app.

### Time/Duration Utilities

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| *None -- use custom utility* | N/A | Song duration formatting and setlist time calculations | Setlist time math is simple: sum seconds, format as MM:SS or H:MM:SS. A 10-line utility function handles this. No library needed. | HIGH |

**Why NOT date-fns or dayjs:** These are date/calendar libraries. Song durations are just numbers (seconds or minutes:seconds). Adding a date library for `formatDuration(totalSeconds)` is massive overkill. Write a simple `formatTime(seconds: number): string` utility instead.

**The math involved:**
- Store durations as integer seconds in the database
- Sum them: `songs.reduce((sum, s) => sum + s.duration_seconds, 0)`
- Format: `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, '0')}`

This does not warrant a dependency.

### Form Handling & Validation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| sveltekit-superforms | ^2.x | Form handling with validation | Integrates deeply with SvelteKit's form actions; handles client+server validation, progressive enhancement, loading states | HIGH |
| zod | ^3.x | Schema validation | Most popular TS-first schema validation; works with superforms; reusable for API validation and DB types | HIGH |

**Why superforms:** SvelteKit has built-in form actions, but superforms adds: type-safe form data, automatic client-side validation, loading/error states, and flash messages. For a multi-form app (add song, create setlist, edit song, share settings), this pays for itself immediately.

**Why NOT formsnap:** Formsnap is a thin wrapper around superforms focused on accessible form components. It adds complexity without much value for a Tailwind-styled app where you control form markup directly.

### Icons

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| lucide-svelte | ^0.4x.x | Icon library | Tree-shakable, large icon set, Svelte-native components. Clean, consistent style. Used widely in the Svelte ecosystem | MEDIUM |

**Why NOT heroicons:** Heroicons work fine but require manual SVG imports or a wrapper. lucide-svelte provides ready-made Svelte components with proper typing.
**Why NOT iconify:** More icons but heavier runtime; overkill for a focused app.

### Toast/Notifications

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| svelte-sonner | ^1.x | Toast notifications | Port of the popular React sonner library; minimal API, beautiful defaults, supports Svelte 5. Used for: "Song added", "Setlist shared", error messages | MEDIUM |

**Why NOT roll your own:** Toast management (queueing, auto-dismiss, stacking, accessibility announcements) is surprisingly tricky. svelte-sonner is tiny and handles all edge cases.

### URL/Link Sharing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| nanoid | ^5.x | Generate short, URL-safe share codes | Generates compact IDs (e.g., `V1StGXR8_Z5jdHi6B-myT`) for shareable setlist links. Collision-resistant, no external service needed | HIGH |

**Why NOT uuid:** UUIDs are 36 characters. Share links should be short and typeable. nanoid generates 21-char URL-safe IDs by default, customizable length.
**Why NOT Supabase-generated UUIDs:** Supabase row IDs are UUIDs. Use nanoid for a separate, shorter `share_code` column specifically for public URLs (e.g., `/setlist/V1StGXR8`).

### Database Type Generation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| supabase (CLI) | latest | Generate TypeScript types from DB schema, run migrations, local dev | Official CLI; `supabase gen types typescript` outputs full DB types. Essential for type-safe queries | HIGH |

**Why CLI-generated types over manual types:** The Supabase CLI reads your actual Postgres schema and generates matching TypeScript types. Manual types drift from the actual schema. Always generate.

## Libraries Explicitly NOT Recommended

| Library | Category | Why Not |
|---------|----------|---------|
| @supabase/auth-helpers-sveltekit | Auth | Deprecated in favor of @supabase/ssr |
| date-fns / dayjs / moment | Time | Overkill for duration arithmetic; write a utility |
| @dnd-kit/* | DnD | React-only |
| drizzle-orm / prisma | ORM | Supabase JS client IS the query layer; adding an ORM creates two sources of truth |
| socket.io | Realtime | Supabase has built-in realtime via Postgres changes; no need for separate WebSocket layer |
| next-auth / lucia | Auth | Supabase Auth handles everything including Google OAuth; external auth libraries conflict |
| formsnap | Forms | Adds abstraction over superforms without enough value for Tailwind apps |
| bits-ui / melt-ui | UI components | Unnecessary for this app's scope; Tailwind + native HTML elements + a few custom components suffice |

## Full Installation Commands

```bash
# Supabase
pnpm add @supabase/supabase-js @supabase/ssr

# Forms & validation
pnpm add sveltekit-superforms zod

# Drag and drop (verify Svelte 5 compat first)
pnpm add svelte-dnd-action

# Icons
pnpm add -D lucide-svelte

# Toasts
pnpm add svelte-sonner

# Share codes
pnpm add nanoid

# Supabase CLI (global or dev dependency)
pnpm add -D supabase
```

## Environment Variables (Netlify + Supabase)

```env
PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
PUBLIC_SUPABASE_ANON_KEY=[anon-key]
# Never expose the service role key to the client
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]  # server-side only
```

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| DnD | svelte-dnd-action | SortableJS wrapper | Less ergonomic; use only if svelte-dnd-action lacks Svelte 5 support |
| Auth SSR | @supabase/ssr | Manual cookie handling | Error-prone, security pitfalls with refresh tokens |
| Forms | sveltekit-superforms + zod | Plain SvelteKit form actions | Works for 1-2 forms; painful at scale without type safety |
| Validation | zod | valibot | Valibot is smaller but zod has broader ecosystem support and superforms integration |
| Icons | lucide-svelte | heroicons SVG imports | More manual work for same result |
| Toast | svelte-sonner | Custom toast store | Re-inventing accessibility and animation logic |
| Share IDs | nanoid | cuid2, shortid | nanoid is fastest, smallest, most widely adopted |

## Version Verification Needed

**IMPORTANT:** The following versions could not be verified against live npm and should be checked before installing:

| Package | Stated Version | What to Check |
|---------|---------------|---------------|
| svelte-dnd-action | ^0.9.x | Does it support Svelte 5 runes? Check npm/GitHub |
| @supabase/ssr | ^0.5.x | Verify latest version on npm |
| sveltekit-superforms | ^2.x | Verify Svelte 5 / SvelteKit 2 compat |
| svelte-sonner | ^1.x | Verify Svelte 5 compat |
| lucide-svelte | ^0.4x.x | Verify latest version on npm |

Run `pnpm info [package] version` for each before adding to the project.

## Sources

- Training data (Anthropic Claude, cutoff May 2025) -- MEDIUM confidence
- Supabase official docs recommend @supabase/ssr for all framework SSR setups -- HIGH confidence (well-established before cutoff)
- svelte-dnd-action is the canonical Svelte DnD library -- HIGH confidence (well-established)
- superforms is the standard SvelteKit form library -- HIGH confidence (well-established)
- All version numbers are approximate and need live verification -- flagged above
