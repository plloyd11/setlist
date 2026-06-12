# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Setlist — a web app where bands and musicians manage song libraries and build timed setlists. Users add songs (name + duration), drag them into setlists to see running totals against a target time, and share setlists via public links or band workspaces. Setlists can also include timed **gaps** (labeled breaks between songs) that count toward the total. Bands additionally get a **Demos workspace** for work-in-progress recordings: members upload versioned audio, organize it into nestable folders, and leave timestamped comments on a waveform player.

**Naming note:** the feature is "Demos" everywhere users see it (nav, page copy, `/bands/[id]/demos` routes), but the DB tables (`tracks`, `track_versions`, `track_comments`, `track_folders`), RPCs, the `tracks` storage bucket, `src/lib/components/tracks/`, `src/lib/server/tracks.ts`, and type names intentionally keep the original `tracks` vocabulary — renaming them would churn RLS policies, RPCs, and storage paths for zero user value. Don't "fix" this inconsistency. Old `/bands/[id]/tracks` URLs 301-redirect to `/demos`.

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
- **Setlist gaps:** a `setlist_songs` row is either a song reference (`song_id` set, `gap_seconds`/`gap_label` null) or a timed break (`song_id` null, `gap_seconds` > 0, optional `gap_label`) — enforced by the `setlist_songs_song_or_gap` check constraint. Reordering goes through the `save_setlist_order(setlist_id, items)` security-definer RPC, which serializes concurrent saves and re-validates song visibility.
- **Demos** (band WIP-audio workspace; DB vocabulary is `tracks` — see naming note above): audio uploads go **client-side direct to the private `tracks` Storage bucket** via a signed upload URL (Netlify's ~6 MB function body limit rules out proxying), then the atomic `create_track_version()` RPC records the metadata row. Each upload is an immutable `track_versions` row (path `bands/{band_id}/tracks/{uuid}.{ext}`); comments attach to a specific version. Playback uses a server-minted **signed URL** (6h TTL) through the user-scoped client, so RLS gates access before a URL exists. Bucket: 50 MB/file limit, audio MIME allowlist. Server-side metadata validation in `src/lib/server/tracks.ts`.
- **Client-side audio compression** (demos + song audio variants, via `AudioUploadZone`): lossless picks (WAV/AIFF/FLAC) and lossy files over the 50 MB bucket cap are re-encoded to 192 kbps MP3 in the browser before the storage PUT — lamejs in a Web Worker (`src/lib/utils/audioCompress.ts` + `mp3Encoder.worker.ts`), reusing the AudioBuffer already decoded for waveform peaks. This is why FLAC/AIFF are accepted as input despite being absent from the bucket MIME allowlists (raw lossless never reaches storage), and why the pick cap (250 MB, `MAX_SOURCE_FILE_SIZE`) is larger than the bucket limit. There is deliberately no server-side transcode path — Netlify's body limit rules it out.
- **Song attachments:** songs carry **rehearsal audio variants** (`song_audio`, private `song-audio` bucket — e.g. "Full mix", "No guitar") and **charts/tabs** (`song_files`, private `song-files` bucket — PDF, Word, Guitar Pro). Both follow the same model: owner uploads/manages, anyone who can see the song (owner + band members via `band_songs`) can read; storage paths are CHECK-constrained to `songs/{song_id}/%`; only `label` is mutable (column grant). Uploads are client-side direct to storage (same Netlify limit rationale as demos); server validation in `src/lib/server/songAudio.ts` / `songFiles.ts`. **Guitar Pro files have no registered MIME type**, so the `song-files` bucket allowlist includes `application/octet-stream` and the real gate is the extension allowlist (`chartUpload.ts` client-side, `songFiles.ts` server-side) — don't "tighten" the bucket list without checking that.
- **Rehearse & practice:** `/setlists/[id]/rehearse` plays a whole set (state machine in `src/lib/components/rehearse/rehearseState.svelte.ts`); `/songs/[id]/practice` plays one song's audio variants with its charts (`?from=` carries the back link, validated as an internal path). Both sign URLs server-side through the user-scoped client and share the remembered per-song variant choice via `src/lib/utils/variantChoice.ts` (localStorage).
- **DAW practice controls** (practice page only): `WaveformPlayer.svelte` (wavesurfer.js v7) takes an opt-in `practice` prop — demos and rehearse consumers are unaffected — which registers the wavesurfer Regions plugin for a single drag-to-create A/B loop region. The loop engine lives in the `timeupdate` handler and triggers only on a **natural crossing of the B point** (`lastTick` delta check), so user seeks past B play through and re-trap on the next pass; the plugin's `region-out` event is deliberately not used (it also fires on backward seeks and on the engine's own jump). **Pre-roll (2 s)** rewinds before the loop's A point on the wrap, on arming from outside the region, and on every transport start inside the armed region (DAW semantics — pressing play includes the lead-in; clamped at 0:00). Speed is always pitch-preserved (`setPlaybackRate(rate, true)`). The page owns durable state and re-applies it via the player's `onready` on every variant remount; persistence is per song in `src/lib/utils/practicePrefs.ts` (volume, speed, loop, pre-roll, named sections — `loopEnabled` is deliberately **not** persisted so a reload never restores an armed loop trap). Keyboard map on the page: Space, `L` (arm loop), `[`/`]` (pin loop points at the playhead), arrows (±5 s), with the form-control/`[role="slider"]` focus guard and a modifier bail. The rotary control is `src/lib/components/ui/Knob.svelte`; the control strip is `src/lib/components/songs/PracticeControls.svelte`. Loop region colors: chartreuse wash only while armed (live signal), surface wash when parked — matching the Limelight rule.
- **Demo folders** (`track_folders`): nestable band-shared organization (max depth 5, no cycles). Because "any member can organize" can't be expressed in the creator-or-owner column-grant RLS, structural mutations (create/rename/move/delete, reparent-on-delete) go through security-definer RPCs in `20260611000000_create_track_folders.sql`.

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
- **Audio playback is never asserted** — with one exception: `practice-loop-playback.spec.ts` plays real audio to exercise the loop engine. Two Chromium-under-Playwright quirks it works around (and that any future playback test must respect): media requests **abort if routed through `page.route` interception**, and a seek issued before first play stalls the element at `readyState 1` — so the spec rewrites `HTMLMediaElement.src` in-page to a local range-capable HTTP server, creates the loop region by dragging (no pre-play seek), and starts playback from 0.

## Planning docs

`.planning/` holds milestone planning (GSD workflow). `PROJECT.md` (requirements, key decisions table), `STATE.md` (current position), and `ROADMAP.md` (phases) are current. **`.planning/codebase/*.md` is stale** — written 2026-02-17 against the bare scaffold, before the app was built; don't trust it over the code. Out-of-scope decisions (no song metadata beyond name+length, no set sections, no real-time collab) are documented in PROJECT.md.

## Design Context

Design work is governed by two root files (consumed by `/impeccable` and useful to any agent touching UI):

- **`PRODUCT.md`** — strategic context: register (`product`), users, brand personality ("stage-ready and confident"), anti-references (no generic SaaS dashboard, no Spotify clone, no corporate/enterprise), design principles, WCAG AA target.
- **`DESIGN.md`** — visual spec: "The Backline" north star, color roles (Backstage Navy surfaces, Tube Glow copper for actions, Limelight chartreuse strictly for live signals like focus/drop targets), Cartridge display + Klima body typography, glow-as-signal elevation, component doctrine. Tokens themselves live in `src/routes/layout.css`; DESIGN.md explains how to apply them.
