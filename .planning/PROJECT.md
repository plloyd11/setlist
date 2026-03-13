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

### Active

(None — next milestone not yet planned)

### Out of Scope

- Rich song metadata (key, tempo, BPM, notes) — keep it minimal, name + length only
- Set sections (Set 1, Set 2, Encore) — start flat, maybe add later
- Mobile native app — web-first, responsive PWA works well
- Spotify/Apple Music integration — not needed for core loop
- Real-time collaborative editing — share and view is enough
- Chord charts / lyrics display — entire product domain (OnSong)
- MIDI / audio integration — requires native app capabilities
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

v1.1 (Marketing Landing Page) is in progress — Phase 5 (landing page structure) complete, Phase 6 (Three.js animations) not yet started. FEAT-02 (real screenshots) has a gap closure plan pending.

All 30 v1.2 requirements satisfied. Audit passed with 3 minor tech debt items (no blockers).
Test infrastructure: worker-scoped fixtures, Supabase admin client, data factories, automatic cleanup.
6 spec files covering auth, songs, setlists, bands, RLS isolation with multi-user browser contexts.

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

---
*Last updated: 2026-03-13 after v1.2 milestone*
