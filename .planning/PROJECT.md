# Setlist

## What This Is

A web app where bands and musicians manage their song libraries and build timed setlists for shows. Users add songs with durations, drag them into setlists to see running totals, set target times, and share setlists with band members or via public links. Bands have shared workspaces with common song libraries and collaborative setlist building. Multi-user platform with Google OAuth.

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

### Active

<!-- v1.1 Marketing Landing Page -->
- [ ] Marketing landing page at root (/) with auth-based routing
- [ ] Hero section with Three.js particle background and bold typography
- [ ] GSAP scroll-triggered animations throughout
- [ ] Feature highlight cards with app screenshots
- [ ] Social proof section
- [ ] Footer with links and branding
- [ ] Responsive design matching app design system

### Out of Scope

- Rich song metadata (key, tempo, BPM, notes) — keep it minimal for v1, name + length only
- Set sections (Set 1, Set 2, Encore) — start flat, maybe add later
- Mobile native app — web-first, responsive PWA works well
- Spotify/Apple Music integration — not needed for core loop
- Real-time collaborative editing — share and view is enough for v1
- Chord charts / lyrics display — entire product domain (OnSong)
- MIDI / audio integration — requires native app capabilities
- Calendar / scheduling — different product domain
- Social features / public profiles — setlist.fm owns this space
- Payment / financial tracking — unrelated domain
- Notation / sheet music rendering — enormous complexity, not relevant
- Complex permissions / roles — owner (edit) and viewer (read-only link) is sufficient

## Context

Shipped v1.0 MVP with 7,205 LOC across 64 files (SvelteKit 2 + Svelte 5 + TypeScript).
Tech stack: SvelteKit 2, Svelte 5, Tailwind CSS v4, Supabase (Postgres + Auth + RLS + Storage).
Deployed to Netlify via `@sveltejs/adapter-netlify`.

All 22 v1 requirements satisfied. Audit passed with 5 minor tech debt items (no blockers).
Band workspaces fully operational with invite links, shared libraries, and collaborative setlists.

## Constraints

- **Stack**: SvelteKit 2 + Svelte 5 + Tailwind CSS v4 — already scaffolded, build on it
- **Backend**: Supabase (Postgres + Auth + Row Level Security) — fits Netlify serverless model
- **Auth**: Google OAuth via Supabase Auth
- **Hosting**: Netlify — already configured with adapter
- **Interaction**: Drag-and-drop for setlist building — core UX requirement (svelte-dnd-action)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase for backend | Postgres + auth + RLS in one, free tier, works with Netlify serverless | ✓ Good — RLS eliminated need for API middleware |
| Google OAuth only | Simplest auth for v1, most users have Google accounts | ✓ Good — zero friction signup |
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

## Current Milestone: v1.1 Marketing Landing Page

**Goal:** Build a high-impact, animated marketing landing page that converts visitors into users.

**Target features:**
- Single-page landing at `/` (logged-out → landing, logged-in → dashboard)
- Three.js abstract particle hero with stage lighting energy
- GSAP scroll-triggered animations (fade, slide, parallax)
- Feature highlight cards with real app screenshots
- Bold, dramatic typography with large headings
- Social proof section
- Footer with branding

---
*Last updated: 2026-02-26 after v1.1 milestone start*
