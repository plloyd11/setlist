---
target: colors (branding vibrancy)
total_score: 24
p0_count: 2
p1_count: 2
timestamp: 2026-06-10T19-35-58Z
slug: src-routes-layout-css
---

# Critique: Color System (`src/routes/layout.css` + app-wide usage)

User goal: update the branding to be more true to the brand and more vibrant/exciting.

## Design Health Score

| #         | Heuristic                       | Score     | Key Issue                                                                                                                       |
| --------- | ------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1         | Visibility of System Status     | 3         | TimingBar always sticky, but the diff (the status) fails contrast in dark mode; drag-in-flight has no live signal               |
| 2         | Match System / Real World       | 3         | mm:ss, TOTAL/TARGET/GAP instrument idiom is on-register; "Tgt" abbreviation wobbles                                             |
| 3         | User Control and Freedom        | 3         | Escape/blur cancels, ConfirmDialog; no undo after delete                                                                        |
| 4         | Consistency and Standards       | 2         | Code violates its own DESIGN.md: neon for nav-active (prohibited), focus ring downgraded from spec, diff colors not theme-split |
| 5         | Error Prevention                | 3         | Parse-or-revert durations, bounded steppers, confirm-before-delete                                                              |
| 6         | Recognition Rather Than Recall  | 3         | Labeled readings, persistent nav                                                                                                |
| 7         | Flexibility and Efficiency      | 2         | Drag + tap-to-add dual path; no keyboard reorder, no shortcuts                                                                  |
| 8         | Aesthetic and Minimalist Design | 2         | Clean but generic interior; dashboard is the named anti-reference                                                               |
| 9         | Error Recovery                  | 2         | Generic "Failed to save changes" in tiny danger-500 that fails contrast on dark                                                 |
| 10        | Help and Documentation          | 1         | Placeholders and title attributes only                                                                                          |
| **Total** |                                 | **24/40** | **Acceptable — significant improvements needed**                                                                                |

## Anti-Patterns Verdict

**LLM assessment:** Coasting on the "dark dashboard + neon accent" lane, and in one place falling below it. The spec transcends the lane (copper/chartreuse two-lamp pairing, Cartridge, "The Backline") but the execution doesn't cash the check: the dashboard (`src/routes/(app)/dashboard/+page.svelte`) is literally PRODUCT.md's named anti-reference — identical icon-stat-card grid; the app interior is theme-flipped gray SaaS; `--shadow-glow-neon` is defined and used zero times; the brand only performs on the marketing landing.

**Deterministic scan:** Clean — 0 findings, exit 0, verified as a true negative (canary test + grep corroboration). No purple gradients, no gradient text, no stock-Tailwind palette tells; only 6 stray `gray-*` classes (incl. a hardcoded `#9ca3af` in WaveformPlayer.svelte:76). Caveat: the static engine pattern-matches stock Tailwind names; the custom `surface/accent/neon` tokens are invisible to it, and the `low-contrast` rule is browser-only — so the clean scan says nothing about contrast. The manual contrast math (Assessment A) fills that gap and found 11 failing pairings.

**Visual overlays:** Skipped — no browser automation available this session (dev server was running; only browser control was missing).

## Overall Impression

The spec promises a venue; the tokens deliver a tasteful living room. Tube Glow copper is OKLCH C 0.062 and Limelight chartreuse C 0.088 — the _status_ colors (danger C 0.141, success C 0.133) are 1.6–2.3× more chromatic than the brand itself, so the most vibrant color event in the app is going over time. Meanwhile the failures cluster exactly where the brand says it lives: dark mode and the light-mode neon signals. The user's instinct (not vibrant, not brand-true) is confirmed by math, not just taste. The single biggest opportunity: hotter signal-step pigments + actually lighting the three "loud" moments (set total, active drop target, share-live).

## What's Working

1. **The copper action ramp is correctly engineered.** White on #8a6a4f = 4.94:1, hover = 7.08:1, hero CTA dark-on-#a78265 = 5.62:1 (`layout.css:143–153`) — a real AA ladder.
2. **Danger/success are palette-native.** Overtime Red #a63e2b / On-Time Olive #769a38 harmonize with the brand hues instead of importing stock red/green.
3. **The landing page proves the system can perform.** `src/routes/+page.svelte`: neon reserved for charged phrases, glow on the energized CTA, navy doing the room — the Limelight and Powered-On rules followed to the letter.

## Priority Issues

**[P0] The hero reading fails contrast in both themes (one state each).**

- What: `TimingBar.svelte:127,185` — `text-danger-500`/`text-success-400` with no `dark:` split. Over-target dark = 2.87:1; under-target light = 2.81:1.
- Why: This is the number the product exists for, read on a dimmed phone in a dark venue.
- Fix: `{isOver ? 'text-danger-600 dark:text-danger-300' : 'text-success-600 dark:text-success-300'}` → all four pairings pass.
- Suggested command: /impeccable polish

**[P0] Light-mode focus and nav-active are invisible (1.59:1).**

- What: `BottomNav.svelte:46` active `text-neon-400` with no light variant; every `focus:border-neon-400` (~25 files) in light mode. neon-400 on #e8eff5 = 1.59:1.
- Why: Keyboard users can't track focus in light theme; mobile users can't see the current tab outdoors. WCAG 1.4.11 fails.
- Fix: theme-split signal steps (neon-600 in light / neon-400 in dark), centralize one focus utility (2px ring + offset per DESIGN.md spec) instead of 25 hand-copies; BottomNav active adds weight/tone cue.
- Suggested command: /impeccable polish

**[P1] The brand accents aren't vibrant enough to support the rebrand goal.**

- What: copper C 0.062, chartreuse C 0.088 — below the status colors. The pigment is the ceiling; redistribution can't fix it.
- Why: "Gig-night energy: dark, punchy, deliberate glow" — dark delivered, punchy and glow not.
- Fix: add hot signal steps — chartreuse toward OKLCH(0.87 0.17 115) ≈ #d8e95f territory for glows/rings/charged text on dark; a hot copper step ≈ OKLCH(0.70 0.12 55) for the hero CTA, set total, glow shadows. Keep muted steps as tonal fills. Update `--shadow-glow-*` to hotter values, raise alpha 0.3→0.45.
- Suggested command: /impeccable colorize (token work) or /impeccable bolder

**[P1] The three "loud" moments have no color.**

- What: set total is gray (`TimingBar.svelte:96`); active drop target unstyled (`setlists/[id]` dndzones); share-active is a tonal chip. `--shadow-glow-neon` used zero times.
- Why: PRODUCT.md principle #4 names exactly these three moments; none receives accent. The brand's signature interaction has no light.
- Fix: copper Cartridge total (`text-accent-500 dark:text-accent-300`); `shadow-glow-neon` + neon ring on dndzone consider state; `shadow-glow-accent` on share-when-live.
- Suggested command: /impeccable colorize

**[P2] The dashboard is the named anti-reference.**

- What: `dashboard/+page.svelte` — icon-stat-card grid + dashed empty state, zero brand color above the CTA.
- Why: First authenticated screen; the brand handshake breaks at the moment the user commits (landing promised a venue, app opens an office).
- Fix: replace stat cards with a "next gig" board (Cartridge numbers, copper total, days-out countdown); kill the `bg-accent-500/10` icon-chip pattern.
- Suggested command: /impeccable bolder (or shape, if restructuring)

**[P3] Toast carries no semantics.**

- What: `Toast.svelte:22` — same gray pill for success and failure.
- Why: The feedback channel is colorblind by design.
- Fix: success/error variants using palette-native colors.
- Suggested command: /impeccable polish

## Persona Red Flags

**Sam (accessibility):** Light-mode focus at 1.59:1 = keyboard navigation untrackable in light theme (SongRow, TimingBar, SetlistHeader inputs). Dark placeholders 2.03:1. Diff 2.81–2.87:1. Fails WCAG AA on the core flow in both themes.

**Casey (mobile):** BottomNav active tab 1.59:1 in light = can't tell which tab is selected on a sunny sidewalk; mobile TimingBar 10px labels at 2.24:1 dark are the worst-contrast text on the smallest screen.

**The working musician in a dark venue (project persona):** dims phone to 30% on stage, glances at the diff — `text-danger-500` at 2.87:1 on #0f1720 is exactly the reading that disappears first. The user the brand is named for is the one the contrast math fails.

## Minor Observations

- `WaveformPlayer.svelte:76` hardcodes `#9ca3af` (Tailwind gray-400) — a foreign neutral in a navy-tempered palette.
- Focus spec (2px ring + offset) was downgraded to `ring-1` no-offset at implementation.
- Landing section dividers use `bg-gradient-to-r` — DESIGN.md prohibits gradient accents; hairlines are borderline, needs a ruling.
- The neon ramp is indexed by aesthetics, not role (300 for headlines, 400 for 10px nav text).
- Light mode is the real design driver in code (`dark:` as modifier), inverting the dark-first doctrine — likely why every dark pairing drifted.
- TimingBar micro-labels `dark:text-surface-500` = 2.24:1; landing footer `text-surface-600` on surface-950 = 1.70:1.

## Questions to Consider

1. If the error state is the most vibrant color in the product, what is the brand rewarding? What if _fitting the set_ were the chromatic peak?
2. Would anyone recognize a screenshot of the dashboard with the wordmark cropped? The landing yes, the app no. Is the rebrand a token change, or the decision to let the interior perform the brand?
3. Is "Limelight" allowed to be a lamp if it's never switched on? `--shadow-glow-neon` has never rendered once; the active drop target is the cheapest, most on-spec place to light it.
