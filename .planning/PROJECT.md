# Setlist

## What This Is

A web app where bands and musicians manage their song libraries and build timed setlists for shows. Users add songs with durations, drag them into setlists to see running totals, set target times, and share setlists with band members or via public links. Bands have shared workspaces with common song libraries and collaborative setlist building. Multi-user platform with Google OAuth and email/password auth.

## Core Value

Musicians can build a setlist from their songs and instantly see how long the set runs, so they can nail the timing for a show.

## Requirements

### Validated

- ✓ SvelteKit scaffold with Tailwind CSS v4 — existing
- ✓ Netlify deployment adapter configured — existing
- ✓ User can sign in with Google OAuth via Supabase — v1.0
- ✓ User session persists across browser refresh — v1.0
- ✓ User can log out from any page — v1.0
- ✓ User can add songs to their library (name + length) — v1.0
- ✓ User can edit and delete songs from their library — v1.0
- ✓ User can search/filter their song library by title — v1.0
- ✓ User can create a setlist — v1.0
- ✓ User can drag songs from their library into a setlist and reorder them — v1.0
- ✓ User can see a running time total as they build a setlist — v1.0
- ✓ User can set a target time and see over/under indicator — v1.0
- ✓ User can set a global transition time between songs — v1.0
- ✓ User can duplicate, delete, and rename setlists — v1.0
- ✓ User can share a setlist via a public read-only link — v1.0
- ✓ Band members with accounts can be part of a shared band/group — v1.0
- ✓ Band members can collaborate on shared setlists — v1.0
- ✓ App is fully usable on mobile devices (responsive design) — v1.0
- ✓ Playwright test infrastructure with Supabase test helpers — v1.2
- ✓ Auth flow E2E tests (redirect, session, sign-out) — v1.2
- ✓ Song library E2E tests (CRUD, search, batch entry) — v1.2
- ✓ Setlist builder E2E tests (create, DnD, timing, sharing) — v1.2
- ✓ Band workspace E2E tests (create, invite, shared library, collab setlists) — v1.2
- ✓ Multi-user and RLS data isolation test scenarios — v1.2
- ✓ Marketing landing page (hero, features, social proof, footer, auth-based routing) — v1.1
- ✓ Email/password sign-in with email confirmation and password reset/update — v1.3
- ✓ User can add timed gaps (labeled breaks) between songs in a setlist — v1.3
- ✓ Gaps and song notes appear on the shared/printed setlist sheet — v1.3
- ✓ Band members can upload work-in-progress audio tracks to a band workspace — v1.3
- ✓ Each upload is a versioned track; members can switch between versions — v1.3
- ✓ Members can leave timestamped, threaded comments on a track's waveform — v1.3
- ✓ Members can organize tracks into nestable folders (create/rename/move/delete) — v1.3

### Active

(None — next milestone not yet planned)

### Out of Scope

- Rich song metadata (key, tempo, BPM, notes) — keep it minimal, name + length only
- Set sections (Set 1, Set 2, Encore) — start flat, maybe add later
- Mobile native app — web-first, responsive PWA works well
- Spotify/Apple Music integration — not needed for core loop
- Real-time collaborative editing — share and view is enough
- Chord charts / lyrics display — entire product domain (OnSong)
- MIDI / audio *processing* (DAW-style editing, effects, mixing) — requires native app capabilities. **Note:** plain audio *sharing* (upload/playback/comment) was brought into scope in v1.3 as the band track workspace; this exclusion now covers only in-app audio editing.
- Calendar / scheduling — different product domain
- Social features / public profiles — setlist.fm owns this space
- Payment / financial tracking — unrelated domain
- Notation / sheet music rendering — enormous complexity, not relevant
- Complex permissions / roles — owner (edit) and viewer (read-only link) is sufficient
- CI pipeline for tests — local only for now, CI deferred
- Cross-browser testing — Chromium only, multi-browser adds complexity
- Visual regression testing — requires baseline screenshots, separate concern

## Context

Shipped v1.0 MVP with 7,205 LOC across 64 files (SvelteKit 2 + Svelte 5 + TypeScript).
Shipped v1.2 E2E test suite with 1,317 LOC across 15 test files (Playwright + TypeScript).
Tech stack: SvelteKit 2, Svelte 5, Tailwind CSS v4, Supabase (Postgres + Auth + RLS + Storage).
Deployed to Netlify via `@sveltejs/adapter-netlify`.

v1.1 (Marketing Landing Page) shipped — logged-out `/` is the marketing page; logged-in users redirect to the dashboard.

v1.3 (Tracks & Gaps, shipped ~2026-06-11) added the first feature that stores binary assets:
- **Band track workspace** — versioned audio uploads to a private Supabase Storage `tracks` bucket (50 MB/file, audio MIME allowlist), client-side direct upload via signed URLs, waveform player with timestamped threaded comments, and nestable folders driven by security-definer RPCs. Migrations `20260610120000` (track tables) and `20260611000000` (folders).
- **Setlist gaps** — `setlist_songs` rows are now song-or-gap; labeled timed breaks count toward the total and render on the shared sheet. Migrations `20260611132743` / `20260611134910`.
- **Auth** — email confirmation + password reset/update routes (`/auth/confirm`, `/auth/update-password`).

All 30 v1.2 requirements satisfied. Audit passed with 3 minor tech debt items (no blockers).
Test infrastructure: worker-scoped fixtures, Supabase admin client, data factories, automatic cleanup.
6 spec files covering auth, songs, setlists, bands, RLS isolation with multi-user browser contexts. (Track/gap features are not yet covered by E2E specs.)

## Constraints

- **Stack**: SvelteKit 2 + Svelte 5 + Tailwind CSS v4 — already scaffolded, build on it
- **Backend**: Supabase (Postgres + Auth + Row Level Security) — fits Netlify serverless model
- **Auth**: Google OAuth + email/password via Supabase Auth
- **Hosting**: Netlify — already configured with adapter
- **Interaction**: Drag-and-drop for setlist building — core UX requirement (svelte-dnd-action)
- **Testing**: Playwright E2E with real Supabase (no mocks) — requires `.env.test` credentials

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase for backend | Postgres + auth + RLS in one, free tier, works with Netlify serverless | ✓ Good — RLS eliminated need for API middleware |
| Google OAuth only (v1.0) | Simplest auth for v1, most users have Google accounts | ✓ Good — zero friction signup |
| Email/password form added (v1.2) | Needed for test automation — Google OAuth can't be programmatically driven | ✓ Good — dual-purpose: real auth + test enablement |
| Flat setlists (no sections) | Reduce complexity for v1, sections can be added later | ✓ Good — delivers core timing value without complexity |
| Minimal song metadata | Name + length is enough to solve the core timing problem | ✓ Good — keeps entry fast |
| @supabase/ssr with cookie handlers | SSR-compatible auth with proper session management | ✓ Good — safeGetSession pattern works reliably |
| svelte-dnd-action for drag-and-drop | Most mature Svelte DnD library, Svelte 5 compatible | ✓ Good — handles both library→setlist and reorder |
| Copy-on-drag for library panel | Songs reset in library after drag to setlist | ✓ Good — intuitive UX |
| Optimistic UI with background sync | Immediate feedback, DB sync via fetch + invalidateAll | ✓ Good — feels instant |
| Client-side filtering with $derived | Instant search/filter without server roundtrip | ✓ Good — zero-latency UX |
| Junction table for band songs | References original song row, edits sync automatically | ✓ Good — no data duplication |
| user_band_ids() security definer | Single function for all band RLS policies | ✓ Good — clean policy pattern |
| DOM-based theme (not Svelte stores) | Simpler, inline script prevents FOUC | ✓ Good — no flash on load |
| Custom DnD pointer helper (v1.2) | locator.dragTo() fails with svelte-dnd-action — need raw page.mouse API | ✓ Good — reliable DnD test automation |
| Worker-scoped test fixtures (v1.2) | One user per worker, auth via real UI login, CASCADE cleanup | ✓ Good — parallel test isolation |
| Warn-not-throw cleanup (v1.2) | Stale test data should not fail test runs | ✓ Good — resilient test infrastructure |
| Client-side direct upload to Storage (v1.3) | Netlify function body limit ~6MB can't proxy 50MB audio; signed upload URL + metadata RPC after | ✓ Works — accepted orphan risk if RPC fails post-upload |
| Private `tracks` bucket + signed playback URLs (v1.3) | Audio is band-private; RLS via user-scoped client gates access before a URL is minted (6h TTL) | ✓ Good — no public exposure |
| Immutable versioned uploads (v1.3) | Each upload is a new `track_versions` row at a fresh uuid path; no upsert | ✓ Good — comment timestamps stay anchored to a version |
| Folder mutations via security-definer RPCs (v1.3) | "Any member can organize" can't be expressed in creator-or-owner column-grant RLS; RPCs enforce depth≤5 + no cycles | ✓ Good — clean separation of authorship vs. organization |
| Song-or-gap union row (v1.3) | A `setlist_songs` row is a song xor a timed gap, enforced by a check constraint; backward compatible | ✓ Good — no separate table, existing rows unaffected |

---
*Last updated: 2026-06-11 after v1.3 (Tracks & Gaps) milestone*
