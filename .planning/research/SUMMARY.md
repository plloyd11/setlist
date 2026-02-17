# Project Research Summary

**Project:** Setlist
**Domain:** Setlist management web app for bands and musicians
**Researched:** 2026-02-17
**Confidence:** MEDIUM

## Executive Summary

Setlist is a web-first setlist planning tool for musicians and bands. The core value proposition is timing: let bands see exactly how long their set runs so they can nail gig timing. Research shows the competitive landscape is bifurcated between heavyweight native apps (BandHelper, OnSong) that bundle too many features and lightweight tools that lack real-time timing and collaboration. The right approach is a focused web app that does one thing exceptionally well — build a setlist, see the clock, share it with the band — without the bloat of chord charts, MIDI control, or band scheduling.

The recommended implementation uses the pre-selected SvelteKit 2 + Svelte 5 + Supabase stack with a thin set of additions: `@supabase/ssr` for cookie-based SSR auth, `sveltekit-superforms` + `zod` for typed form handling, `svelte-dnd-action` (with a SortableJS fallback if Svelte 5 compat is unconfirmed), and `nanoid` for short share link codes. No ORM is needed — the Supabase JS client is the query layer. Duration math is a 10-line utility, not a library. The architecture is a standard SvelteKit SSR + form actions pattern with Supabase Postgres as the backend, RLS as the authorization layer, and Netlify as the deployment target.

The critical risks are all in Phase 1: Supabase RLS policies are easy to write incorrectly in a multi-tenant model and silently expose data; SSR auth token handling has specific setup steps that cause intermittent failures if done wrong; and schema migrations must be established as the workflow from day one or the database will drift. Phase 2's core risk is the drag-and-drop ordering strategy — using integer positions without transactions causes data corruption. The architecture research recommends fractional indexing or atomic RPC updates. All major risks have clear prevention strategies and the tech stack is well-understood. The primary uncertainty is svelte-dnd-action's Svelte 5 compatibility, which must be verified before committing to it.

## Key Findings

### Recommended Stack

The locked-in stack (SvelteKit 2, Svelte 5, Tailwind v4, adapter-netlify, TypeScript) is appropriate for this domain. The recommended additions are minimal and purposeful. Supabase handles auth, database, and real-time in one platform — no separate WebSocket layer or ORM is needed. `sveltekit-superforms` + `zod` handles the multiple mutation forms (add song, create setlist, share settings) with type safety and progressive enhancement built in. Duration math is a custom utility — no date library.

**Core technologies:**
- `@supabase/supabase-js` + `@supabase/ssr`: database, auth, and cookie-based SSR session management — the official, non-deprecated approach for SvelteKit
- `sveltekit-superforms` + `zod`: type-safe form handling with server/client validation — pays for itself immediately in a multi-form app
- `svelte-dnd-action`: drag-and-drop reordering — most mature Svelte DnD library, but Svelte 5 compat must be verified; SortableJS wrapper is the fallback
- `nanoid`: short URL-safe share codes — UUIDs are too long for share links
- `lucide-svelte`: icon components — tree-shakable, Svelte-native
- `svelte-sonner`: toast notifications — handles queueing, dismiss, and accessibility correctly
- Custom `formatDuration(seconds)` utility: not a library — 10 lines of math

**What to NOT add:** Drizzle/Prisma (ORM conflicts with Supabase client), date-fns/dayjs (overkill for duration arithmetic), socket.io (Supabase realtime is built in), next-auth/lucia (conflicts with Supabase Auth).

See `.planning/research/STACK.md` for full rationale and version verification checklist.

### Expected Features

The market gap is clear: a web-first, no-install, no-subscription setlist builder focused on timing. The MVP must cover the full planning loop (library → setlist → timing → share) before any collaborative or advanced features are added.

**Must have (table stakes):**
- Song library with title, artist, duration — the fundamental data unit
- Create and edit setlists from the song library with drag-and-drop reorder
- Live running time calculation — the core value prop; must update as songs are added/removed/reordered
- Multi-set support (Set 1, Set 2, Encore) — models how real gigs work
- User accounts with Google OAuth
- Share setlist via read-only link — minimum viable collaboration
- Duplicate a setlist — "copy last week's set and tweak it" is the primary workflow
- Search/filter song library — essential once library exceeds ~50 songs
- Mobile-responsive layout — musicians use phones at gigs

**Should have (differentiators that are low-complexity, high-value):**
- Target time with over/under indicator — "We have a 90-minute slot" → shows +5:00 or -3:00 in red/green
- Transition/changeover time per song or as a global default — accounts for tuning and audience banter; most tools ignore this
- Song notes per setlist entry — "capo 3", "skip bridge" — note is per-gig, not per-song globally
- Key and tempo metadata on songs
- Drag-and-drop between sets (not just within a set)

**Defer (v2+):**
- Band workspaces — high complexity multi-tenancy; get single-user right first
- Real-time collaborative editing — share links cover 80% of the need
- Offline/PWA — validate the product works online first
- Spotify import — manual entry is fine for libraries under 100 songs
- Print/export PDF — browser print suffices initially
- Energy arc visualization — differentiator but not core

**Anti-features (do not build):** chord charts, MIDI/audio integration, band scheduling/calendar, social features/public profiles, notation rendering. Each of these is either a separate product category or competes with mature specialized tools.

See `.planning/research/FEATURES.md` for full competitive analysis and dependency graph.

### Architecture Approach

The architecture is a SvelteKit SSR hybrid with two Supabase client instances (server per-request in hooks, browser singleton for realtime/auth state) and Postgres RLS as the authorization layer. All data mutations go through SvelteKit form actions, not API routes or direct client-side Supabase writes. Drag-and-drop is optimistic (local `$state` updates immediately on drag) with debounced persistence (300-500ms after last drag) and revert on failure.

**Major components:**
1. **Auth Layer** (`hooks.server.ts`) — validates session on every request using `getUser()` (not `getSession()`), refreshes tokens, injects into `event.locals`
2. **Song Library** (routes + components) — CRUD songs via server form actions; personal songs nullable `band_id`
3. **Setlist Builder** (routes + components) — core interaction: DnD reorder, `$derived` time calculation, optimistic persistence; `setlist_songs` join table with integer positions bulk-updated via transaction
4. **Public Share** (`(public)/s/[share_id]`) — read-only, no auth, RLS allows `SELECT` where `is_public = true`
5. **Supabase Client Library** (`$lib/supabase/`) — typed clients, generated database types, shared utilities

**Key patterns:**
- `(app)/` route group for all authenticated routes — single auth guard layout, no per-page auth checks
- `(public)/` route group for login and share views — no guard
- `$derived` for all time calculations — never stored, always computed from song list
- Server form actions for all writes — never direct Supabase client mutations in components
- Integer positions, bulk-updated in a single transaction on reorder (or fractional indexing if concurrent editing is needed earlier than planned)

See `.planning/research/ARCHITECTURE.md` for data model DDL, full file structure, and code examples.

### Critical Pitfalls

1. **RLS policies that leak data through band membership** — Policies must traverse `band_members` join table; `band_members` itself needs RLS to prevent self-insertion into any band. Test by calling Supabase REST API directly as an unauthorized user. Fix in Phase 1 before any features are built.

2. **Supabase SSR auth token mismatch** — Use `@supabase/ssr`, create server client in `hooks.server.ts` per-request, use `getUser()` not `getSession()` for server-side verification, pass session from `+layout.server.ts` to client. Symptom: logged-out flash on page refresh. Fix in Phase 1.

3. **Drag-and-drop position ordering corruption** — Integer positions across multiple rows require an atomic transaction on reorder. Without it, rapid drags produce duplicate positions and corrupt sort order. Use a Postgres RPC function that wraps the bulk UPDATE in a transaction. Consider fractional indexing from the start if band collaboration (concurrent edits) is planned for Phase 2.

4. **Duration calculation display bugs** — Store as integer seconds only. Parse user input strictly (`mm:ss` and `h:mm:ss`). Single canonical `formatDuration()` utility used everywhere. Unit-test edge cases: 0 seconds, exactly 60 seconds, over 1 hour, single-digit seconds (3:05 not 3:5). Build and test the utility in Phase 2 before any duration UI.

5. **Google OAuth redirect misconfiguration on Netlify** — Add `localhost:5173` to both Supabase and Google Cloud Console redirect URIs. Add Supabase wildcard `https://*.netlify.app/**` for preview deploys. Configure all redirect URLs before any team member tries to test auth in a PR.

**Moderate pitfalls to watch:**
- Svelte 5 reactivity with DnD libraries (Pitfall 6) — prototype DnD before committing to a library
- Schema changes made in Supabase dashboard not captured as migration files (Pitfall 12) — establish migration-first workflow immediately
- Untyped Supabase client queries (Pitfall 13) — run `supabase gen types` alongside first migration

## Implications for Roadmap

Based on combined research, the architecture implies a clear dependency chain. Auth must exist before any data features. Songs must exist before setlists can be built. The setlist builder is the core product experience and deserves its own phase. Collaboration and advanced features come after the core loop is solid.

### Phase 1: Foundation — Auth, Data Model, and Project Setup

**Rationale:** Everything depends on a working database, auth session, and correct RLS policies. Getting these wrong means security holes or rewrites later. The migration workflow and type generation pipeline must also be established here.

**Delivers:** Working Google OAuth login, Postgres schema with RLS, Supabase type generation pipeline, SvelteKit project structure with `(app)/` and `(public)/` route groups, correct two-client Supabase pattern, Netlify adapter configuration.

**Addresses:** User accounts (table stakes feature)

**Avoids:**
- Pitfall 1: RLS policy data leaks — test with unauthorized user from day one
- Pitfall 2: SSR auth token mismatch — implement `hooks.server.ts` pattern correctly
- Pitfall 7: OAuth redirect misconfiguration — configure all URLs before first PR
- Pitfall 12: Schema drift — migration-first workflow established here
- Pitfall 13: Untyped queries — type generation alongside first migration

**Research flag:** Standard patterns — `@supabase/ssr` + SvelteKit hooks is well-documented. No additional research phase needed, but verify current `@supabase/ssr` API against live Supabase docs before implementing.

### Phase 2: Song Library

**Rationale:** Songs are the atomic unit. Setlists are built from songs. Song CRUD must exist and be solid before the setlist builder can be built or even prototyped.

**Delivers:** Song CRUD (create, edit, delete, list), duration input with `mm:ss` parser, `formatDuration()` utility (unit-tested), search/filter by title, mobile-responsive song library page.

**Addresses:**
- Song library with title, artist, duration (table stakes)
- Search/filter song library (table stakes)

**Avoids:**
- Pitfall 5: Duration parsing bugs — build and unit-test the utility here, not inline later

**Research flag:** Standard patterns — no additional research needed.

### Phase 3: Setlist Builder (Core Product Loop)

**Rationale:** This is the product. The setlist builder with live timing is the core value prop. It depends on songs (Phase 2) and auth (Phase 1) being solid. Drag-and-drop complexity warrants its own phase.

**Delivers:** Setlist CRUD, drag-and-drop reorder within a set, `$derived` live running time calculation, multi-set support (Set 1, Set 2, Encore), target time with over/under indicator, transition time (global default), duplicate setlist, share via read-only link.

**Addresses:**
- Create/edit setlists with drag-and-drop (table stakes)
- Live running time calculation (table stakes, core value prop)
- Multi-set support (table stakes)
- Target time indicator (differentiator)
- Transition time (differentiator)
- Share via link (table stakes)
- Duplicate setlist (table stakes)

**Avoids:**
- Pitfall 3: Position ordering corruption — use atomic RPC for bulk position update; prototype DnD in Svelte 5 before committing to a library
- Pitfall 6: Svelte 5 DnD reactivity — prototype and validate `svelte-dnd-action` Svelte 5 compat early in this phase
- Pitfall 9: Multi-user edit conflicts — add `updated_at` conflict detection on setlist saves

**Research flag:** Needs research on drag-and-drop. Specifically: (a) confirm `svelte-dnd-action` Svelte 5 compatibility before implementation, (b) confirm `sveltekit-superforms` Svelte 5 / SvelteKit 2 compat. If DnD library is unconfirmed, plan to prototype the SortableJS fallback approach.

### Phase 4: Polish and Secondary Features

**Rationale:** Once the core loop works — song library → setlist → timing → share — add the features that improve the experience without expanding scope.

**Delivers:** Song notes per setlist entry (per-gig annotations), key and tempo metadata on songs, drag-and-drop between sets, print/export via print CSS, onboarding empty states for fresh users.

**Addresses:**
- Song notes/annotations (differentiator)
- Key and tempo metadata (differentiator)
- Drag-and-drop between sets (differentiator)
- Print/export (differentiator)

**Avoids:**
- Pitfall 10: Fresh user empty states — design and test onboarding in this phase, no later
- Pitfall 4: RLS N+1 query overhead — add `CREATE INDEX idx_band_members_user_band ON band_members(user_id, band_id)` if not already done; monitor Supabase query dashboard

**Research flag:** Standard patterns — no additional research needed.

### Phase 5+: Collaboration (Band Workspaces)

**Rationale:** Band workspaces require multi-tenancy data model changes and significantly more complex RLS. Deferring this until the single-user product is stable is the right call. Real-time collaborative editing is a further increment after basic band membership is working.

**Delivers:** Band creation, member invites, shared song library per band, shared setlists per band.

**Addresses:**
- Band workspaces (differentiator, Phase 3+ from FEATURES.md)
- Shared song library (differentiator)

**Avoids:**
- Pitfall 1: RLS complexity increases significantly with band membership — requires careful policy review
- Pitfall 9: Multi-user edit conflicts become a real problem here — consider Supabase Realtime subscriptions at this point

**Research flag:** Needs research on Supabase Realtime patterns for collaborative editing if real-time sync is planned. Band invite flows (email-based? link-based?) need product definition before implementation.

### Phase Ordering Rationale

- Auth and data model must come first — every other feature depends on both
- Songs before setlists — setlists contain songs; you cannot build the setlist builder without songs to put in it
- Core setlist builder is one large phase — the DnD, time calculation, multi-set, and share features are deeply interrelated and should ship together rather than incrementally
- Polish comes before collaboration — validate the single-user experience works before adding the complexity of shared ownership and RLS band policies
- Band workspaces deferred to Phase 5+ — this is the right call; the data model already supports it (nullable `band_id` on songs and setlists), so it's a non-breaking addition

### Research Flags

**Needs research before planning:**
- **Phase 3 (Setlist Builder):** Verify `svelte-dnd-action` Svelte 5 compatibility. Check npm/GitHub before the phase planning session. If unconfirmed, plan the SortableJS fallback.
- **Phase 3 (Setlist Builder):** Verify `sveltekit-superforms` ^2.x Svelte 5 / SvelteKit 2 compatibility.
- **Phase 5 (Collaboration):** Research Supabase Realtime API patterns for collaborative state if real-time sync is in scope. Also define the band invite UX (link-based or email-based) before planning the data model.

**Standard patterns (no research phase needed):**
- **Phase 1 (Foundation):** `@supabase/ssr` + SvelteKit hooks is well-documented; verify current API against live Supabase docs while implementing
- **Phase 2 (Song Library):** CRUD forms with superforms + zod are well-established
- **Phase 4 (Polish):** All features in this phase use patterns already established in earlier phases

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Core stack (SvelteKit 2, Svelte 5, Supabase, Tailwind v4) is locked in and appropriate. Recommended additions are well-chosen. Specific package versions could not be live-verified against npm — run `pnpm info [package] version` before installing. Svelte 5 DnD compat is the key unknown. |
| Features | MEDIUM | Competitor analysis based on training data. Feature prioritization is grounded in the stated value prop (timing) and is well-reasoned. The "MVP first, band workspaces later" call is strongly supported by the architecture research. Cannot verify current competitor feature sets. |
| Architecture | MEDIUM | SvelteKit file-based routing, form actions, and hooks patterns are well-established and HIGH confidence. Supabase SSR (`@supabase/ssr`) pattern is documented but should be verified against current Supabase docs before implementation — the package was relatively new at training cutoff. RLS patterns are well-understood. |
| Pitfalls | MEDIUM | All pitfalls identified are real and well-documented failure modes for this stack combination. Prevention strategies are sound. The fractional indexing recommendation for DnD ordering may be more conservative than needed for a single-user app with 40 songs max — integer positions with a transaction may be sufficient. |

**Overall confidence:** MEDIUM

### Gaps to Address

- **svelte-dnd-action Svelte 5 compat:** Must verify on npm/GitHub before Phase 3 planning. This is the single highest-uncertainty item in the stack.
- **`@supabase/ssr` current API:** The package API may have changed since training cutoff. Verify `createServerClient` and `createBrowserClient` signatures against current Supabase docs before Phase 1 implementation.
- **`sveltekit-superforms` ^2.x:** Verify Svelte 5 compatibility before Phase 2/3 planning.
- **DnD ordering strategy:** The architecture recommends fractional indexing but the pitfalls doc notes that integer positions with a transaction may be sufficient for a setlist (max ~40 songs, single writer). Resolve this during Phase 3 planning based on whether concurrent editing is in scope for v1.
- **Netlify edge functions for SSR:** The pitfalls doc mentions `adapter: netlifyAdapter({ edge: true })` as a way to reduce cold start latency, but notes Supabase SSR compat needs verification. Flag this for Phase 1 setup decisions.

## Sources

### Primary (HIGH confidence)
- SvelteKit documentation — file-based routing, form actions, hooks, layouts, route groups
- Svelte 5 runes documentation — `$state`, `$derived`, `$effect`
- Supabase documentation — RLS policy patterns, multi-tenant models, Google OAuth setup

### Secondary (MEDIUM confidence)
- Training data knowledge of BandHelper, OnSong, SetlistHelper, Setlist.fm feature sets — competitive landscape
- Supabase SSR documentation (`@supabase/ssr` package) — server client + browser client patterns
- Common drag-and-drop ordering patterns — fractional indexing, optimistic updates, debounced persistence
- SvelteKit adapter-netlify documentation — function vs edge function tradeoffs
- svelte-dnd-action library documentation and GitHub

### Tertiary (LOW confidence / needs live verification)
- Specific npm package versions for all recommended libraries — verify with `pnpm info [package] version`
- Tailwind v4 syntax changes — project already has Tailwind v4 configured; reference only v4 docs
- svelte-dnd-action Svelte 5 compatibility — check GitHub releases and issues

---
*Research completed: 2026-02-17*
*Ready for roadmap: yes*
