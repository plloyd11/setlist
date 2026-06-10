---
target: tracks
total_score: 24
p0_count: 0
p1_count: 3
timestamp: 2026-06-10T19-34-28Z
slug: src-routes-app-bands-id-tracks
---

# Critique: Tracks feature (`src/routes/(app)/bands/[id]/tracks` + `src/lib/components/tracks`)

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                                                                                                                                         |
| --------- | ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 3         | Upload phases narrated and toasts confirm; but resolve/delete/version-switch show no pending state, and swallowed query errors render as a false "No tracks yet" (`tracks/+page.server.ts:12-20`) |
| 2         | Match System / Real World       | 3         | Musician-true language ("Pin at 1:23", v-numbers, mm:ss); "Reopen"/"Resolve" is borrowed code-review vocabulary                                                                                   |
| 3         | User Control and Freedom        | 2         | No way to cancel an in-flight upload; no version delete; comments can't be edited                                                                                                                 |
| 4         | Consistency and Standards       | 3         | Reuses songs-page grammar faithfully; ghost-danger Delete diverges from DESIGN.md's filled destructive spec                                                                                       |
| 5         | Error Prevention                | 2         | Good file validation; but pin defaults ON at 0:00 before playback, no `beforeunload` guard mid-upload                                                                                             |
| 6         | Recognition Rather Than Recall  | 2         | Comments are version-scoped with no cross-version view — switching versions makes prior feedback vanish                                                                                           |
| 7         | Flexibility and Efficiency      | 1         | No keyboard shortcuts at all (no Space play/pause, no arrow seek); single-file upload silently discards extra dropped files                                                                       |
| 8         | Aesthetic and Minimalist Design | 3         | Quiet, dark-first, on-palette; player is generic stock-wavesurfer rather than "Backline hardware"                                                                                                 |
| 9         | Error Recovery                  | 2         | Orphan cleanup on failed metadata save is excellent; but generic messages, restart-from-0%, and a player-error reload loop (`[trackId]/+page.svelte:101-104`)                                     |
| 10        | Help and Documentation          | 3         | Both empty states teach the model; waveform markers unexplained beyond `title` attribute                                                                                                          |
| **Total** |                                 | **24/40** | **Acceptable — significant improvements needed before users are happy**                                                                                                                           |

## Anti-Patterns Verdict

**Does this look AI-generated? No.** Deterministic detector: **0 findings, exit 0** across all 11 files — no side-stripes, gradient text, glassmorphism, eyebrows, hero metrics, or identical card grids. LLM review agrees on banned patterns but found brand-system violations the detector can't see: **the Two Lamps are swapped** in the comment system (chartreuse on seek _actions_, copper on the _live_ playhead highlight, solid neon paint on idle markers), one spinner-instead-of-skeleton in WaveformPlayer, and zero `prefers-reduced-motion` coverage. Browser visualization skipped: no browser automation available and the surface is auth-gated with no local test credentials.

## Overall Impression

Competent, restrained, trustworthy product UI with genuinely strong engineering-as-UX (precomputed waveform peaks, direct-to-storage upload with real progress, orphan cleanup). The losses concentrate in three places: the timestamp-pinning interaction is wrong-by-default (the feature's core gesture), the player is keyboard/screen-reader-dead, and the brand's signature component — the waveform — is the most generic thing in the app. Single biggest opportunity: make pinned feedback trustworthy.

## What's Working

1. **The upload pipeline is honest, high-stakes design** — XHR progress percentage, three narrated phases, MIME fallback by extension, client+server validation, orphan cleanup on failed metadata save (`TrackUploadForm.svelte:100-115, 295-301`).
2. **Performance as UX** — peaks computed once at upload (`audio.ts`), excluded from list queries, instant waveform render, 6h signed URLs with expiry recovery.
3. **Version-context honesty** — "You're listening to an older version" banner and descriptive dropdown labels prevent commenting on the wrong file (`[trackId]/+page.svelte:166-173`).

## Priority Issues

1. **[P1] Timestamp pinning is wrong-by-default and drifts while you type.** Pin defaults checked at 0:00 (`CommentForm.svelte:21`), and `effectiveTimestamp` is live-derived from the playhead (`:26`) — the comment lands wherever the song is at _submit_, not at the moment that prompted it. Breaks the feature's reason to exist. **Fix:** freeze the timestamp when the textarea focuses (frozen "Pin at 1:23 ✕" chip); default pin off until playback starts. **Command:** /impeccable polish
2. **[P1] No way to cancel or safely abandon an upload.** Cancel disabled while busy (`TrackUploadForm.svelte:264`), xhr never stored/aborted, no `beforeunload` guard. **Fix:** keep the xhr ref, wire Cancel to `xhr.abort()` + storage cleanup, guard tab close while uploading. **Command:** /impeccable harden
3. **[P1] Waveform is keyboard- and screen-reader-dead; markers are 10px targets.** No keyboard seek; marker dots `h-2.5 w-2.5` (`WaveformPlayer.svelte:136-149`) vs the 44px touch minimum; upload ProgressBar announces itself as "Setlist duration progress." **Fix:** `role="slider"` seek with arrow keys, ≥44px marker hit areas, Space play/pause, `aria-live` on upload phases, ProgressBar `ariaLabel` prop. **Command:** /impeccable harden
4. **[P2] The Two Lamps are swapped in the comment system.** Seek chips chartreuse (`CommentItem.svelte:68`), live playhead highlight copper (`:40`), idle markers solid neon (`WaveformPlayer.svelte:147`). DESIGN.md: "copper acts, chartreuse signals. Never swap the lamps." **Fix:** chips → tonal copper, playhead highlight → neon, markers neutral at rest. **Command:** /impeccable polish
5. **[P2] Swallowed query errors masquerade as empty states; player errors loop.** Tracks and comments queries discard errors → fake "No tracks yet"; `handlePlayerError` → `invalidateAll()` → same broken audio → infinite toast loop. **Fix:** `throw error(500)` on query failures; one-retry flag before showing the static error panel. **Command:** /impeccable harden

## Persona Red Flags

**Alex (power user):** zero keyboard shortcuts; dropping 5 files silently keeps only the first (`TrackUploadForm.svelte:96`); no hide-resolved in long comment threads; version switch is a full navigation with no pending indicator.

**Sam (screen reader / keyboard-only):** cannot seek audio at all except via existing comment chips; upload progress visual-only with a wrong accessible name; error `<p>`s lack `role="alert"`; pin checkbox's accessible name mutates 4×/second during playback.

**Gigging musician (phone, dark van, one thumb):** 10px markers, ~32px header buttons, bare `text-xs` comment action links — all below the 44px the design system promises; `dark:text-surface-500` meta text ≈2.2:1 contrast is unreadable in low light; failed-peaks path silently downloads the whole file on 4G; half-typed comments die on any navigation; mid-upload connection drop restarts from 0%.

## Minor Observations

- `dark:text-surface-500` meta text fails AA badly (~2.2:1) — inherited app-wide pattern, fix at the vocabulary level (floor at `dark:text-surface-300`).
- Zero `prefers-reduced-motion` coverage anywhere in `src/` despite PRODUCT.md requiring it.
- No `<svelte:head><title>` on either page (app-wide gap).
- Marker tooltips use `title` — invisible on touch, where this product lives.
- Resolved comments sit at `opacity-60` forever; no collapse at 50+ comments.
- Optimistic-UI doctrine abandoned here: every comment/resolve/delete waits on full `invalidateAll`.
- Tracks render as the app's first card grid where songs/setlists are row lists — defensible, worth a deliberate decision.

## Questions to Consider

1. **Is feedback a property of the version, or of the song?** Uploading a fix deletes the band's collective memory exactly when they need to check the notes were addressed.
2. **Why is this feature an island?** A track version has a title and a duration — the two fields that define a Song — yet there's no "add to song library" affordance.
3. **Where's the Backline?** The waveform player is the one place the "powered-on hardware" thesis could sing, and it's currently the most generic component in the app.
