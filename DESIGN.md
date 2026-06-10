---
name: Setlist
description: Build, time, and share setlists with your band — dark, stage-ready gig gear.
colors:
  backstage-navy: '#131b28'
  night-stage: '#0f1720'
  night-case: '#162030'
  pit-black: '#080c13'
  day-haze: '#e8eff5'
  steel-border: '#a8bdd1'
  night-border: '#1e2a3d'
  tube-glow: '#a78265'
  tube-glow-action: '#8a6a4f'
  tube-glow-deep: '#6e533d'
  tube-hot: '#d78951'
  limelight: '#d1e14a'
  limelight-signal: '#bbc92a'
  limelight-deep: '#676f22'
  overtime-red: '#a63e2b'
  on-time-olive: '#769a38'
typography:
  display:
    fontFamily: "'Cartridge', sans-serif"
    fontSize: 'clamp(1.5rem, 4vw, 3rem)'
    fontWeight: 700
    lineHeight: 1.1
  title:
    fontFamily: "'Cartridge', sans-serif"
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "'Klima', sans-serif"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Klima', sans-serif"
    fontSize: '0.625rem'
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: '0.05em'
rounded:
  sm: '0.125rem'
  md: '0.375rem'
  lg: '0.5rem'
  xl: '0.75rem'
  full: '9999px'
spacing:
  xs: '0.25rem'
  sm: '0.5rem'
  md: '1rem'
  lg: '1.5rem'
  xl: '2rem'
components:
  button-primary:
    backgroundColor: '{colors.tube-glow-action}'
    textColor: '#ffffff'
    rounded: '{rounded.lg}'
    padding: '0.5rem 1rem'
  button-primary-hover:
    backgroundColor: '{colors.tube-glow-deep}'
  button-cta:
    backgroundColor: '{colors.tube-hot}'
    textColor: '{colors.pit-black}'
    rounded: '{rounded.lg}'
    padding: '1rem 2rem'
  input:
    backgroundColor: '{colors.day-haze}'
    textColor: '{colors.night-stage}'
    rounded: '{rounded.lg}'
    padding: '0.5rem 0.75rem'
  chip:
    backgroundColor: '#ede0d5'
    textColor: '#533e2e'
    rounded: '{rounded.full}'
    padding: '0.125rem 0.5rem'
---

# Design System: Setlist

## 1. Overview

**Creative North Star: "The Backline"**

Setlist looks like the band's own gear stack behind the stage: dark, dependable hardware with powered-on indicator glow. The room is Backstage Navy; the signals are Limelight chartreuse and Tube Glow copper — the colors of a lit pilot lamp and a warm valve amp. Nothing here is office software. The interface should feel like equipment you'd trust on tour: every control obviously operable, every reading glanceable from a few feet away, nothing decorative that doesn't earn its current draw.

This system explicitly rejects the generic SaaS dashboard (stat-card heroes, gradient accents, identical card grids), the Spotify/streaming clone (album-art grids, media-player chrome), and anything corporate or enterprise-flavored. Dark mode is the spiritual home — the app must read perfectly in a dim venue on a phone — and light mode is the daylight rehearsal counterpart, never the design driver.

**Key Characteristics:**

- Dark-first: navy surfaces with tonal layering, designed for low-light legibility
- Two-voice accent system: copper for actions, chartreuse for live signals (focus, active states)
- Cartridge display type gives headings and big timing numbers a marquee personality
- Tactile, roadworthy controls: generous targets, definite edges, immediate press feedback
- The set total vs. target time is always the loudest reading on a setlist screen

## 2. Colors

A dark venue lit by two lamps: one neon-chartreuse, one warm copper, over a deep navy room.

### Primary

- **Tube Glow** (#a78265): The warm copper of a valve amp. Brand anchor — accent badges, tonal copper fills. On dark surfaces it carries the brand's warmth.
- **Tube Glow Action** (#8a6a4f): The working button copper. Default fill for primary action buttons with white text.
- **Tube Glow Deep** (#6e533d): Hover/pressed state of primary actions.
- **Tube Hot** (#d78951, oklch 0.70 0.12 55): The energized copper — the filament at full current. Reserved for the hero CTA fill, the set total and gig countdown in dark mode, the wordmark in dark mode, and the copper glow shadow. If everything were Tube Hot, nothing would be.

### Secondary

- **Limelight** (#d1e14a, oklch 0.87 0.17 115): The neon signal at full brightness — charged headline phrases on dark, the hot end of the lamp. It is a lamp, not a paint.
- **Limelight Signal** (#bbc92a): The working signal on dark surfaces — focus outlines, the active drop-target ring, the playhead cursor.
- **Limelight Deep** (#676f22): The same lamp indexed for light surfaces (4.67:1 against Day Haze). Signal steps are theme-indexed: 300/400 on dark, 600/700 on light — one `.focus-live` utility carries the split so components never hand-pick.

### Tertiary

- **Overtime Red** (#a63e2b): The set ran long. Over-target diffs, destructive actions, danger states. Muted warm red that sits inside the palette rather than screaming over it.
- **On-Time Olive** (#769a38): The set fits. Under-target diffs and success states; harmonizes with Limelight rather than introducing a foreign green.

### Neutral

- **Backstage Navy** (#131b28): The brand's base navy; the room everything sits in.
- **Night Stage** (#0f1720): Dark-mode page background; doubles as ink on light surfaces.
- **Night Case** (#162030): Dark-mode cards and raised panels.
- **Pit Black** (#080c13): Deepest dark — theme-color, extreme recesses.
- **Day Haze** (#e8eff5): Light-mode background and card surface; cool, never cream.
- **Steel Border** (#a8bdd1) / **Night Border** (#1e2a3d): Hairline borders in light/dark respectively. Full tonal ramps for every hue live in `src/routes/layout.css` (`--color-surface-*`, `--color-accent-*`, `--color-neon-*`).

### Named Rules

**The Limelight Rule.** Limelight is a signal, not a paint. It appears only when something is live: a focused input, an active drop target, a drag in flight, a charged headline phrase. It is never body text, never a large static fill, and never navigation — even now that the hot steps would pass contrast, rarity is what makes it read as a lamp.

**The Two Lamps Rule.** Copper acts, chartreuse signals. A control that performs an action is copper; a state that reports liveness is chartreuse. Never swap the lamps.

## 3. Typography

**Display Font:** Cartridge (sans-serif fallback)
**Body Font:** Klima (sans-serif fallback)

**Character:** Cartridge has marquee-letter personality — it makes headings and timing numbers feel like a name on a venue sign. Klima is the legible workhorse underneath: humanist, quiet, available 300–700 with italics. The pairing contrasts a characterful display against a neutral text face; never introduce a third family.

### Hierarchy

- **Display** (Cartridge 700, clamp(1.5rem, 4vw, 3rem), 1.1): Page titles, landing hero, the brand wordmark. All h1–h6 default to Cartridge via global rule.
- **Title** (Cartridge 600, 1.125rem, 1.3): Card titles, dialog headings, section heads.
- **Big Numbers** (Cartridge 700, 1.25–1.5rem): Set totals and timing readouts — display type because they're the headline of the screen.
- **Body** (Klima 400, 0.875rem, 1.5): Default UI text. Cap prose at 65–75ch.
- **Label** (Klima 500, 0.625rem, +0.05em, uppercase): Micro-labels over readings (TOTAL, TARGET, GAP) in the TimingBar. This is a deliberate instrument-panel idiom for data readouts — keep it there; do not spread eyebrow labels across marketing sections.

### Named Rules

**The Marquee Rule.** Cartridge owns headings and big timing numbers. Klima owns everything read at length. If a string is a sentence, it's Klima.

## 4. Elevation

Surfaces are near-flat with tonal layering: Night Case panels on a Night Stage background, separated by hairline borders, with subtle ambient shadows (`--shadow-sm/md/lg`, soft black at 20–30% opacity) doing quiet structural work. Depth is conveyed by tone first, shadow second.

### Shadow Vocabulary

- **Ambient small** (`0 1px 3px rgba(0,0,0,0.2)`): Buttons, inputs at rest.
- **Ambient medium** (`0 2px 8px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)`): Cards, raised panels.
- **Ambient large** (`0 4px 16px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.2)`): Dialogs, dropdowns, the topmost layer.
- **Copper glow** (`0 0 12px rgba(215,137,81,0.45), 0 0 28px rgba(215,137,81,0.18)`): Hero CTA, the share-live lamp, charged copper moments. Built from Tube Hot — glow reads as filament, not haze.
- **Neon glow** (`0 0 12px rgba(187,201,42,0.45), 0 0 28px rgba(187,201,42,0.18)`): Live Limelight states — the active drop target while a drag is in flight.

### Named Rules

**The Powered-On Rule.** Glow means live. A glow shadow appears only when something is energized — a primary CTA, an active drop target, a drag in flight. Glow on idle elements is a burnt-out bulb: prohibited.

## 5. Components

Controls are tactile and roadworthy: they should feel like hardware on a flight case — generous targets (≥44px on touch surfaces), definite edges, and immediate, physical feedback on press. Restraint in color, confidence in shape.

### Buttons

- **Shape:** Gently rounded (0.5rem radius); never pill-shaped for primary actions.
- **Primary:** Tube Glow Action copper (#8a6a4f) fill, white semibold Klima text, 0.5rem 1rem padding, ambient-small shadow.
- **Hover / Focus:** Darkens to Tube Glow Deep (#6e533d); focus is the `.focus-live` utility — a 2px Limelight outline with offset, theme-indexed (#676f22 light / #bbc92a dark).
- **Hero CTA:** Tube Hot (#d78951) fill with Pit Black Cartridge text and the copper glow shadow — the one always-energized button in the product.
- **Ghost / Tertiary:** Text-only surface-toned buttons that gain a tonal background on hover; used for cancel/secondary verbs.
- **Destructive:** Overtime Red (#a63e2b) fill, white text — same geometry as primary.

### Chips

- **Style:** Full-radius pills, tonal copper fill (#ede0d5 light / copper-900 at 30% dark) with deep copper text (#533e2e light / copper-400 dark), 0.125rem 0.5rem padding, xs medium text.
- **Filter pills:** Same geometry; selected state switches to a solid fill.

### Cards / Containers

- **Corner Style:** 0.5–0.75rem radius (lg for rows, xl for dialogs).
- **Background:** Day Haze (#e8eff5) light / Night Case (#162030) dark.
- **Shadow Strategy:** Tone + hairline border first; ambient-medium shadow only when the card floats.
- **Border:** 1px Steel Border light / Night Border dark — always full borders, never colored side-stripes.
- **Internal Padding:** 1–1.5rem.

### Inputs / Fields

- **Style:** 1px surface border, Day Haze / Night Case fill, 0.5rem radius, 0.5rem 0.75rem padding, Klima text with muted placeholder.
- **Focus:** The `.focus-live` utility — border and 2px outline switch to the theme-indexed Limelight (#676f22 light / #bbc92a dark). The field is live.
- **Error / Disabled:** Overtime Red border on error; 50% opacity, no hover response when disabled.

### Navigation

- **Desktop:** 14rem sidebar on Day Haze / Night Stage, Cartridge wordmark in Tube Glow, Klima medium nav items (0.5rem radius rows) that gain tonal background when active.
- **Mobile:** Bottom nav bar; targets ≥44px. Active item is indicated by tone and weight, not by Limelight (navigation is not a live signal).

### TimingBar (signature component)

The product's reason to exist, rendered as an instrument panel: a sticky bottom bar with uppercase micro-labels (TOTAL / TARGET / DIFF / GAP) over their readings. The total is Cartridge bold in copper (#6e533d light / Tube Hot dark) — the loudest number on screen. The diff is theme-split: Overtime Red (#832f20 light / #e07a66 dark) when over, On-Time Olive (#46611e light / #94b355 dark) when under. The progress bar speaks the same language (olive fits / red over). Inline target input and ± gap stepper keep adjustment one tap away. Never bury these readings in a settings panel.

### The Next Gig Board (dashboard hero)

The first authenticated screen extends the instrument idiom: one Night Case panel with the next gig's name and venue on the left and labeled readings on the right — COUNTDOWN in copper (the page's chromatic peak), TOTAL / TARGET / DIFF / SONGS in the TimingBar vocabulary, and the copper-glow "Sharing on" lamp when the set is live. With no upcoming gig it shows the latest set (total goes copper instead of the countdown); with no sets at all it becomes the activation moment. Recent setlists are rows, not cards; the library is one quiet pulse reading, never a stat card.

## 6. Do's and Don'ts

### Do:

- **Do** design dark-mode-first; verify every screen in dark mode on a phone-sized viewport before light mode.
- **Do** keep the set total vs. target glanceable on every setlist surface — it is the hero reading.
- **Do** use the `.focus-live` utility for all focus states — never hand-pick focus colors per element; the utility carries the theme split.
- **Do** keep touch targets ≥44px on mobile surfaces; musicians use this on phones in dark rooms.
- **Do** hold body text to ≥4.5:1 contrast in both themes (surface-900 on Day Haze; surface-100 on Night Stage).
- **Do** give every animation a `prefers-reduced-motion` alternative and keep drag feedback under glow, not bounce.

### Don't:

- **Don't** build the "generic SaaS dashboard": no stat-card heroes, no gradient accents, no identical icon-heading-text card grids.
- **Don't** imitate the "Spotify/streaming clone": no album-art grids, no media-player chrome as default scaffolding.
- **Don't** drift "corporate/enterprise": no sterile grays, no beige, no compliance-flavored UI.
- **Don't** use Limelight for small static text or large fills — it's a signal lamp (The Limelight Rule).
- **Don't** apply glow shadows to idle elements (The Powered-On Rule).
- **Don't** use colored side-stripe borders, gradient text, or glassmorphism anywhere.
- **Don't** introduce a third font family, warm/cream backgrounds, or pure-black (#000) surfaces — the dark floor is Pit Black (#080c13).
