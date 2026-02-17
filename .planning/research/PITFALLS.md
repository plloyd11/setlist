# Domain Pitfalls

**Domain:** Setlist management web app (SvelteKit + Supabase + drag-and-drop)
**Researched:** 2026-02-17
**Overall confidence:** MEDIUM -- based on training data; WebSearch/WebFetch unavailable for live verification

---

## Critical Pitfalls

Mistakes that cause rewrites, data leaks, or major UX failures.

---

### Pitfall 1: RLS Policies That Look Correct but Leak Data Through Band Membership

**What goes wrong:** In a multi-tenant model where users belong to bands, the most common RLS mistake is writing policies that check `auth.uid() = user_id` on the setlist table, but forget that setlists belong to *bands*, not individual users. The policy needs to traverse the `band_members` junction table. Developers either (a) skip the join and expose all band data to any authenticated user, or (b) write the join but forget to add RLS to the `band_members` table itself, allowing a user to insert themselves into any band.

**Why it happens:** RLS policies are SQL, but developers test them through the app UI -- which naturally constrains access. The vulnerability only appears when someone hits the Supabase REST API directly (which any authenticated user can do via the public anon/service key).

**Consequences:** Any authenticated user can read/modify any band's setlists. This is a data leak and integrity violation.

**Prevention:**
- Every table gets RLS enabled, no exceptions. Use `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` as step one for every migration.
- Write RLS policies that chain through `band_members`: `EXISTS (SELECT 1 FROM band_members WHERE band_members.band_id = setlists.band_id AND band_members.user_id = auth.uid())`.
- Add RLS to `band_members` itself: only existing members (or the band creator) can insert new members.
- Test RLS by calling Supabase REST API directly with a token from a user who should NOT have access. Automate this as a test.

**Detection:** Create a second test user not in any band. If they can `SELECT * FROM setlists` and get results, RLS is broken.

**Phase:** Phase 1 (Auth + data model). Get this right before any features are built on top.

---

### Pitfall 2: Supabase Auth SSR Token Handling -- Stale Sessions and Cookie Mismatch

**What goes wrong:** SvelteKit runs on both server and client. Supabase auth tokens live in cookies, but the server-side Supabase client and the client-side Supabase client can disagree about the current session. Common symptoms: (a) user appears logged out on first server render after login, (b) RLS queries fail server-side because the token is missing or expired, (c) redirect loops on protected routes.

**Why it happens:** Developers create a single `createClient()` call and use it everywhere, instead of creating separate server/client instances. The server needs to read cookies from the request; the client uses browser storage. Using `@supabase/ssr` (formerly `@supabase/auth-helpers-sveltekit`) is required but has specific setup steps that are easy to get subtly wrong.

**Consequences:** Intermittent auth failures, server-rendered pages showing logged-out state, RLS returning empty results on SSR.

**Prevention:**
- Use `@supabase/ssr` package. Create the server client in `hooks.server.ts` using `event.cookies`. Create the client-side client in a `+layout.ts` load function or a shared module that reads the session from the server.
- In `hooks.server.ts`, call `supabase.auth.getUser()` (not `getSession()`) to validate the token on every request. `getSession()` reads from the cookie without verifying the JWT; `getUser()` makes a round-trip to Supabase to confirm validity.
- Pass the session from server to client via `+layout.server.ts` returning `{ session }`, then initialize client-side Supabase with that session.
- Never import a server-side Supabase client in client code (SvelteKit will error on this, but be aware).

**Detection:** After login, hard-refresh the page. If the user appears logged out for a flash before hydration fixes it, the server-side auth is broken.

**Phase:** Phase 1 (Auth setup). This is foundational -- every subsequent feature depends on correct SSR auth.

---

### Pitfall 3: Drag-and-Drop Reordering Loses Position Data or Creates Race Conditions

**What goes wrong:** Setlist songs need a `position` (or `order`) column. The naive approach uses sequential integers (1, 2, 3...). When a song is dragged from position 5 to position 2, you need to update positions 2-4 to shift down AND set the moved song to position 2. This means updating N rows for every drag operation. Common failures: (a) concurrent edits produce duplicate positions, (b) optimistic UI shows the new order but the database update fails silently, leaving the UI and DB out of sync, (c) rapid drag operations queue up and execute out of order.

**Why it happens:** Integer position ordering requires updating multiple rows atomically. Without a transaction, partial updates leave gaps or duplicates. Optimistic updates in the UI make the user think it worked when it may not have.

**Consequences:** Setlist order appears different for different band members. Songs disappear from view (filtered out by a sort that can't handle duplicate positions). Data corruption that's hard to debug.

**Prevention:**
- Use fractional indexing (e.g., the `fractional-indexing` npm package or a simple string-based approach). Instead of integers, positions are strings like "a0", "a1", "a2". Inserting between "a1" and "a2" generates "a1V" -- only ONE row update needed.
- Wrap position updates in a Supabase RPC (Postgres function) that runs in a transaction. Never do multi-row position updates from the client.
- Debounce drag operations -- don't fire a DB update on every pixel of movement, only on drop.
- After each drop, compare the local order with what the server returns. If they diverge, snap to the server state.

**Detection:** Open the same setlist in two browser tabs. Reorder in both rapidly. Check if both tabs converge to the same order.

**Phase:** Phase 2 (Setlist builder with drag-and-drop). This is the core interaction -- get ordering strategy right before building the UI.

---

### Pitfall 4: Supabase RLS Performance -- N+1 Policy Checks Kill Load Times

**What goes wrong:** RLS policies run per-row. A policy like `EXISTS (SELECT 1 FROM band_members WHERE ...)` executes for every row returned. Loading a setlist with 20 songs means 20 subqueries against `band_members`. For a band page showing 10 setlists each with 20 songs, that's 200 subquery executions.

**Why it happens:** Postgres is generally efficient with `EXISTS` subqueries and will often cache/optimize them. But without proper indexes, or with complex multi-table policies, the query planner can't optimize and performance degrades noticeably.

**Consequences:** Slow page loads (500ms+) that feel sluggish. Worse on Supabase free tier with limited connection pooling.

**Prevention:**
- Add explicit indexes: `CREATE INDEX idx_band_members_user_band ON band_members(user_id, band_id)`. This is the single most important index for the entire app.
- Keep RLS policies simple -- one `EXISTS` check, not nested subqueries.
- For read-heavy views (setlist with all songs), create a Postgres function (`get_setlist_with_songs(setlist_id uuid)`) that runs as `SECURITY DEFINER` with its own auth check inside, bypassing per-row RLS. This gives you one auth check instead of N.
- Use `EXPLAIN ANALYZE` on queries to see actual RLS overhead.

**Detection:** Monitor Supabase query performance in the dashboard. If `SELECT` queries on setlist_songs take >50ms for 20 rows, investigate the query plan.

**Phase:** Phase 2-3. Implement indexes in Phase 2 (data model). Monitor and add RPC functions in Phase 3 if performance issues appear.

---

### Pitfall 5: Time/Duration Calculations with Floating Point and Display Inconsistencies

**What goes wrong:** Song durations stored as seconds (integer) seem simple, but problems emerge: (a) storing as float/decimal introduces floating-point arithmetic issues (3:30 = 210 seconds, but 3.5 minutes as a float leads to display rounding errors), (b) summing durations across a setlist with breaks/transitions produces totals that don't visually add up, (c) users input "3:30" meaning 3 minutes 30 seconds, but the parser interprets it as 3 hours 30 minutes or 3.30 minutes.

**Why it happens:** Duration is deceptively simple. The mm:ss format is ambiguous (is "1:05:30" one hour five minutes thirty seconds, or a typo?). Summing and displaying requires consistent units throughout.

**Consequences:** Setlist shows "Total: 42:00" but manually adding songs gives 41:58. Users lose trust in the core feature.

**Prevention:**
- Store duration as integer seconds in the database. Never use float or interval types.
- Parse user input strictly: accept `mm:ss` and `h:mm:ss` formats only. Validate that seconds < 60.
- Create a single `formatDuration(totalSeconds: number): string` utility and use it everywhere -- never format inline.
- Write unit tests for the duration parser and formatter with edge cases: 0 seconds, exactly 60 seconds, durations over an hour, single-digit seconds (3:05 not 3:5).
- Sum durations server-side (in the Postgres query) as well as client-side, and compare. Use `SUM(duration_seconds)` in SQL.

**Detection:** Add a song with duration 3:05. If it displays as "3:5" or "3:50" anywhere, the formatter is broken.

**Phase:** Phase 2 (Song library). Get the parser/formatter right as a utility before building any UI that displays durations.

---

## Moderate Pitfalls

---

### Pitfall 6: Svelte 5 Reactivity Gotchas with Drag-and-Drop State

**What goes wrong:** Svelte 5 uses runes (`$state`, `$derived`, `$effect`) instead of Svelte 4's implicit reactivity. Drag-and-drop libraries that worked with Svelte 4 may not trigger reactivity correctly in Svelte 5 because they mutate arrays directly. In Svelte 5, `$state` arrays need reassignment (or use `$state` with fine-grained tracking) to trigger updates.

**Why it happens:** Most Svelte drag-and-drop libraries (svelte-dnd-action, etc.) were written for Svelte 4 where `array = array` triggered reactivity. In Svelte 5, direct array mutation via `splice()` IS tracked when the array is `$state`, but the library may be creating new arrays or using patterns that bypass Svelte's proxy.

**Prevention:**
- Verify the drag-and-drop library explicitly supports Svelte 5. Check GitHub issues/releases for Svelte 5 compatibility.
- If using `svelte-dnd-action`, test thoroughly -- it has been updated for Svelte 5 but edge cases may exist.
- Consider building a simple drag-and-drop with the HTML5 Drag and Drop API or Pointer Events for this specific use case (reordering a flat list is simpler than a general-purpose DnD solution).
- Keep the source of truth for song order in a `$state` array and derive the display from it. Don't let the DnD library own the state.

**Detection:** Drag a song to a new position. If the UI snaps back or shows the wrong order momentarily, the reactivity binding is broken.

**Phase:** Phase 2 (Setlist builder). Evaluate DnD approach early and prototype before committing to a library.

---

### Pitfall 7: Google OAuth Redirect Issues on Netlify

**What goes wrong:** Supabase Google OAuth requires a redirect URL. On Netlify, the deploy URL changes for preview deploys (e.g., `deploy-preview-42--yoursite.netlify.app`). Developers configure only the production URL in Supabase and Google Cloud Console, then OAuth breaks on all preview/staging environments. Additionally, Netlify's edge functions and SvelteKit's server routes can conflict on redirect handling.

**Why it happens:** OAuth redirect URLs must be whitelisted exactly. Google is strict about this. Supabase allows multiple redirect URLs but developers forget to configure them.

**Consequences:** Login works in production but breaks in development and preview deploys. Team members can't test auth features in PRs.

**Prevention:**
- Add `http://localhost:5173` (Vite dev server) to both Supabase redirect URLs and Google Cloud Console authorized redirect URIs.
- Add a wildcard pattern in Supabase: `https://*.netlify.app/**` (Supabase supports wildcard redirects).
- In Google Cloud Console, you cannot use wildcards -- add the production URL and localhost. For preview deploys, consider using Supabase's built-in redirect URL parameter to route back correctly.
- Set the `SITE_URL` environment variable in Netlify to the production URL, and use it in auth configuration.

**Detection:** Try logging in on a Netlify preview deploy. If you get a "redirect_uri_mismatch" error, the URLs aren't configured.

**Phase:** Phase 1 (Auth setup). Configure all redirect URLs before anyone else on the team tries to test.

---

### Pitfall 8: Netlify Adapter and SvelteKit API Routes -- Cold Starts and Function Limits

**What goes wrong:** `@sveltejs/adapter-netlify` converts SvelteKit server routes into Netlify Functions (or Edge Functions). Each `+server.ts` and `+page.server.ts` becomes a serverless function. Cold starts add 200-500ms latency. Netlify's free tier has function invocation limits (125K/month) that a small collaborative app can hit if every page load triggers multiple server functions.

**Why it happens:** SvelteKit's server-side rendering means every page visit invokes a serverless function. With Supabase, many operations can be done client-side (direct Supabase calls), but developers default to putting everything in `+page.server.ts` load functions.

**Consequences:** Slow initial page loads. Unexpected bills or rate limits on Netlify.

**Prevention:**
- Prefer client-side Supabase calls for data fetching where SSR isn't needed (e.g., loading songs after the page shell renders). Use `+page.ts` (universal load) instead of `+page.server.ts` where possible.
- Use `+page.server.ts` only for operations that need server-side secrets or initial SEO-relevant content.
- Configure adapter-netlify to use edge functions for SSR routes (lower cold start latency): `adapter: netlifyAdapter({ edge: true })` -- but verify Supabase SSR client works in edge runtime.
- Monitor function invocations in Netlify dashboard.

**Detection:** Check Netlify function logs. If you see >300ms cold starts on simple page loads, consider moving data fetching client-side.

**Phase:** Phase 1 (Project setup). Choose the adapter strategy early -- changing from functions to edge later requires testing everything.

---

### Pitfall 9: Multi-User Setlist Editing Without Conflict Resolution

**What goes wrong:** Two band members open the same setlist. Both reorder songs. The last save wins, silently overwriting the other person's changes. Even worse: one person adds a song while another reorders, and the add is lost because the reorder overwrote the entire song list.

**Why it happens:** Without real-time sync or optimistic concurrency control, the app uses "last write wins" by default. Supabase Realtime can broadcast changes, but developers often add it as an afterthought rather than designing for it from the start.

**Consequences:** Lost edits, user frustration, distrust of the tool ("I added that song, where did it go?").

**Prevention:**
- For v1, use an `updated_at` timestamp on setlists. Before saving, check if `updated_at` has changed since the user loaded the page. If it has, show a "this setlist was modified by someone else -- reload?" prompt. This is optimistic concurrency control and prevents silent data loss.
- Design mutations as atomic operations (add song, remove song, move song) rather than "save entire setlist state." This makes conflicts granular -- two users can add different songs without conflicting.
- In v2+, add Supabase Realtime subscriptions to push changes to all open clients. But this is complex -- start with conflict detection first.

**Detection:** Open the same setlist in two browsers. Edit in both. If one person's changes silently disappear, you have a last-write-wins problem.

**Phase:** Phase 2 (basic conflict detection with `updated_at`), Phase 4+ (real-time sync as enhancement).

---

### Pitfall 10: Forgetting to Handle the "No Band" State

**What goes wrong:** The app assumes users belong to at least one band. But after signup, a user has no bands. The first thing they see should guide them to create or join a band. Developers build the happy path (user has bands, bands have setlists) and the empty states crash or show blank screens.

**Why it happens:** Development always happens with seeded data. Nobody tests the fresh-signup flow end-to-end.

**Consequences:** New users see a blank page or errors, think the app is broken, and leave.

**Prevention:**
- Define the "empty state" UI for every level: no bands, no setlists, no songs in a setlist.
- Make "create a band" the first action after signup, with a clear onboarding flow.
- Seed dev data, but also have a "fresh user" test account that has no data.
- Protect routes: if a page requires a band context (e.g., `/bands/[id]/setlists`), handle the case where `[id]` doesn't exist or the user isn't a member.

**Detection:** Create a new account and go through the entire flow without clicking "create band." Every screen should be usable and helpful.

**Phase:** Phase 1 (Auth + onboarding). Design the empty states alongside the data-full states.

---

## Minor Pitfalls

---

### Pitfall 11: Tailwind v4 Migration Syntax Changes

**What goes wrong:** Tailwind v4 changed configuration significantly -- no more `tailwind.config.js` (uses CSS-based config), different plugin syntax, some utility class renames. Tutorials and Stack Overflow answers for Tailwind v3 lead developers to patterns that don't work.

**Prevention:** Only reference Tailwind v4 docs. The project already has Tailwind v4 set up via `@tailwindcss/vite`, so stick with CSS-based `@theme` configuration in the main CSS file, not a JS config file.

**Phase:** Throughout (ongoing awareness).

---

### Pitfall 12: Supabase Migrations vs Dashboard Schema Drift

**What goes wrong:** Developers make schema changes in the Supabase dashboard (adding columns, modifying RLS) during development, then forget to capture these as migration files. The production database diverges from what's in source control.

**Prevention:**
- Use `supabase db diff` to capture dashboard changes as migrations.
- Better: never touch the dashboard for schema changes. Write migrations in SQL files and apply with `supabase db push` or `supabase migration up`.
- Store all migrations in `supabase/migrations/` in the repo.

**Detection:** Run `supabase db diff` -- if it produces output, the database has drifted from migrations.

**Phase:** Phase 1 (Project setup). Establish the migration workflow before any schema is created.

---

### Pitfall 13: Not Typing Supabase Client with Generated Types

**What goes wrong:** Supabase queries return `any` types by default. Without generated types, you lose TypeScript safety on all database operations -- wrong column names, missing fields, and type mismatches only surface at runtime.

**Prevention:**
- Run `supabase gen types typescript --project-id <id> > src/lib/types/database.types.ts` and regenerate after every migration.
- Create the Supabase client with `createClient<Database>(url, key)` where `Database` is the generated type.
- Add type generation to the CI/CD pipeline or a pre-commit hook.

**Detection:** If you can write `supabase.from('nonexistent_table')` without a TypeScript error, types aren't configured.

**Phase:** Phase 1 (Project setup). Set up type generation alongside the first migration.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Auth + Data Model (Phase 1) | RLS policies incomplete or wrong (Pitfalls 1, 2) | Test with unauthorized users from day one |
| Auth + Data Model (Phase 1) | OAuth redirects broken in dev/preview (Pitfall 7) | Configure all redirect URLs before first PR |
| Auth + Data Model (Phase 1) | Schema changes not captured in migrations (Pitfall 12) | Establish migration-first workflow immediately |
| Song Library (Phase 2) | Duration parsing/display bugs (Pitfall 5) | Build and unit-test duration utilities first |
| Setlist Builder (Phase 2) | Drag-and-drop reactivity issues in Svelte 5 (Pitfall 6) | Prototype DnD before committing to a library |
| Setlist Builder (Phase 2) | Position ordering corruption (Pitfall 3) | Use fractional indexing, not integer positions |
| Setlist Builder (Phase 2) | Multi-user edit conflicts (Pitfall 9) | Add `updated_at` conflict detection from the start |
| Performance (Phase 3) | RLS N+1 query overhead (Pitfall 4) | Index `band_members(user_id, band_id)`, monitor query plans |
| Deployment (Phase 3+) | Netlify cold starts and function limits (Pitfall 8) | Prefer client-side data fetching where SSR not needed |
| Polish (Phase 4+) | Empty states untested (Pitfall 10) | Test fresh-user flow in every phase |

## Sources

- Supabase documentation on RLS (supabase.com/docs/guides/database/postgres/row-level-security) -- MEDIUM confidence (training data, not live-verified)
- Supabase SSR auth guide (supabase.com/docs/guides/auth/server-side) -- MEDIUM confidence
- SvelteKit adapter-netlify documentation (svelte.dev/docs/kit/adapter-netlify) -- MEDIUM confidence
- Svelte 5 runes documentation (svelte.dev/docs/svelte/$state) -- MEDIUM confidence
- General experience with drag-and-drop ordering systems, fractional indexing patterns -- MEDIUM confidence
- Tailwind v4 migration guide (tailwindcss.com/docs/v4-beta) -- LOW confidence (may have changed since training data)

**Note:** WebSearch and WebFetch tools were unavailable during this research session. All findings are based on training data and should be verified against current documentation before implementation decisions are made. Particular areas to re-verify: Svelte 5 DnD library compatibility, Supabase SSR package current API, Tailwind v4 final syntax.
