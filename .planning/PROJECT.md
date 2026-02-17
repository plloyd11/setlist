# Setlist

## What This Is

A web app where bands and musicians manage their song libraries and build timed setlists for shows. Users add songs with durations, drag them into setlists to see running totals, and share setlists with band members or via public links. Multi-user platform — each band/musician has their own account.

## Core Value

Musicians can build a setlist from their songs and instantly see how long the set runs, so they can nail the timing for a show.

## Requirements

### Validated

- ✓ SvelteKit scaffold with Tailwind CSS v4 — existing
- ✓ Netlify deployment adapter configured — existing

### Active

- [ ] User can sign in with Google OAuth via Supabase
- [ ] User can add songs to their library (name + length)
- [ ] User can edit and delete songs from their library
- [ ] User can create a setlist
- [ ] User can drag songs from their library into a setlist and reorder them
- [ ] User can see a running time total as they build a setlist
- [ ] User can share a setlist via a public read-only link
- [ ] Band members with accounts can be part of a shared band/group
- [ ] Band members can collaborate on shared setlists

### Out of Scope

- Rich song metadata (key, tempo, BPM, notes) — keep it minimal for v1, name + length only
- Set sections (Set 1, Set 2, Encore) — start flat, maybe add later
- Mobile native app — web-first
- Spotify/Apple Music integration — not needed for core loop
- Real-time collaborative editing — share and view is enough for v1

## Context

- Existing codebase is a fresh SvelteKit 2 scaffold (Svelte 5, Tailwind v4, TypeScript)
- Deploying to Netlify via `@sveltejs/adapter-netlify`
- No backend or database yet — adding Supabase for Postgres, auth, and API
- Target is "core loop works" — add songs, build setlist, see time, share link
- Band collaboration is v1 but secondary to the core solo setlist-building flow

## Constraints

- **Stack**: SvelteKit 2 + Svelte 5 + Tailwind CSS v4 — already scaffolded, build on it
- **Backend**: Supabase (Postgres + Auth + Row Level Security) — fits Netlify serverless model
- **Auth**: Google OAuth via Supabase Auth
- **Hosting**: Netlify — already configured with adapter
- **Interaction**: Drag-and-drop for setlist building — core UX requirement

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase for backend | Postgres + auth + RLS in one, free tier, works with Netlify serverless | — Pending |
| Google OAuth only | Simplest auth for v1, most users have Google accounts | — Pending |
| Flat setlists (no sections) | Reduce complexity for v1, sections can be added later | — Pending |
| Minimal song metadata | Name + length is enough to solve the core timing problem | — Pending |

---
*Last updated: 2026-02-17 after initialization*
