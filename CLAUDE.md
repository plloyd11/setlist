# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Setlist — a web app where bands and musicians manage song libraries and build timed setlists. Users add songs (name + duration), drag them into setlists to see running totals against a target time, and share setlists via public links or band workspaces.

## Commands

Uses **pnpm** (pinned via `packageManager`), Node >= 20.

```sh
pnpm dev                 # Vite dev server
pnpm build               # Production build (Netlify adapter)
pnpm check               # svelte-kit sync + svelte-check type checking
pnpm lint                # Prettier check (no ESLint in this project)
pnpm format              # Prettier write
pnpm test                # Playwright E2E suite (requires .env.test — see below)
pnpm test:ui             # Playwright UI mode
pnpm test:cleanup        # Delete stale e2e-* test users from Supabase

npx playwright test tests/songs.spec.ts        # single spec file
npx playwright test -g "creates a setlist"     # single test by title
```

### E2E test requirements

Tests run against a **real Supabase instance** (no mocks) and mutate live data. They require a `.env.test` file with `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Playwright auto-starts the dev server on port 5173. CI (`.github/workflows/ci.yml`) intentionally runs only check/lint/build with placeholder env vars — the test suite is local-only.

## Architecture

**Stack:** SvelteKit 2 + Svelte 5 (runes), TypeScript strict, Tailwind CSS v4, Supabase (Postgres + Auth + RLS), `svelte-dnd-action`, deployed to Netlify.

### Auth & routing

- `src/hooks.server.ts` creates a per-request Supabase server client (`@supabase/ssr` with cookie handlers) and a **memoized `safeGetSession()`** on `locals` (getUser() is a network call; guard + layouts all share one promise). It also enforces the auth guard: everything is protected except `/auth/*`, `/share/*`, and `/`.
- `/` redirects logged-in users to `/dashboard` (marketing landing page for logged-out visitors).
- `src/routes/(app)/` is the authenticated app (dashboard, songs, setlists, bands, settings). `/share/[token]` is the public read-only setlist view. `/auth` handles Google OAuth (PKCE) and email/password sign-in.
- `src/routes/+layout.ts` creates the browser/server Supabase client used client-side; invalidate with `depends('supabase:auth')`.

### Data layer

- **There is no API middleware — Supabase RLS is the authorization layer.** Page `+page.server.ts` loads query through `locals.supabase` (user-scoped, RLS-enforced). Schema and policies live in `supabase/migrations/`.
- Band access control flows through a `user_band_ids()` security-definer Postgres function referenced by all band RLS policies.
- Band shared songs use a **junction table referencing the original song row** — edits sync automatically, no duplication.
- TypeScript row types are hand-maintained in `src/lib/types/database.ts` (not generated) — keep in sync with migrations.
- Durations are stored as integer seconds; parse/format via `src/lib/utils/duration.ts` ("mm:ss" strings).

### UI patterns

- Setlist builder uses `svelte-dnd-action` with **copy-on-drag** from the library panel (library resets after drop) and **optimistic UI**: update local state immediately, sync via `fetch` + `invalidateAll()`.
- Theme is DOM-based (inline script in `app.html` prevents FOUC), not store-driven; `src/lib/stores/theme.svelte.ts` wraps it.
- Components organized by domain: `src/lib/components/{bands,layout,setlists,songs,ui}/`.
- Prettier: tabs, single quotes, 100-char width, no trailing commas, Tailwind class sorting.

### Test infrastructure (`tests/`)

- `fixtures.ts`: **worker-scoped fixtures** — one test user per worker created via admin API, authenticated through the real UI once, `storageState` reused by all tests in the worker. Teardown deletes the user (CASCADE cleans up data).
- `helpers/supabase-admin.ts`: service-role client that bypasses RLS — used only by factories/cleanup, never in assertions.
- `helpers/factories.ts`: `createSong`/`createSetlist`/`createBand` insert via admin API (bypass UI when testing data, not workflow).
- `helpers/dnd.ts`: custom `dragAndDrop` using raw `page.mouse` — **Playwright's `locator.dragTo()` does not work with svelte-dnd-action**. Assert reorder results by comparing bounding-box y-coordinates.
- `helpers/multi-user.ts`: `createSecondUser(browser)` returns `{ page, user, cleanup }` for cross-user/band scenarios in separate browser contexts.
- Cleanup philosophy is warn-not-throw: stale data logs a warning instead of failing the run.

## Planning docs

`.planning/` holds milestone planning (GSD workflow). `PROJECT.md` (requirements, key decisions table), `STATE.md` (current position), and `ROADMAP.md` (phases) are current. **`.planning/codebase/*.md` is stale** — written 2026-02-17 against the bare scaffold, before the app was built; don't trust it over the code. Out-of-scope decisions (no song metadata beyond name+length, no set sections, no real-time collab) are documented in PROJECT.md.

## Design Context

Design work is governed by two root files (consumed by `/impeccable` and useful to any agent touching UI):

- **`PRODUCT.md`** — strategic context: register (`product`), users, brand personality ("stage-ready and confident"), anti-references (no generic SaaS dashboard, no Spotify clone, no corporate/enterprise), design principles, WCAG AA target.
- **`DESIGN.md`** — visual spec: "The Backline" north star, color roles (Backstage Navy surfaces, Tube Glow copper for actions, Limelight chartreuse strictly for live signals like focus/drop targets), Cartridge display + Klima body typography, glow-as-signal elevation, component doctrine. Tokens themselves live in `src/routes/layout.css`; DESIGN.md explains how to apply them.
