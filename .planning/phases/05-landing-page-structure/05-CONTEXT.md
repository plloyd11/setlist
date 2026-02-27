# Phase 5: Landing Page Structure - Context

**Gathered:** 2026-02-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Marketing landing page at `/` for logged-out visitors with hero, features, social proof, and footer sections. Logged-in users redirect to dashboard. Responsive design using existing app design system. No animations (Phase 6 handles Three.js and GSAP).

</domain>

<decisions>
## Implementation Decisions

### Hero messaging & tone
- Bold & direct voice — confident, no-nonsense (e.g., "Know your set. Own the stage.")
- Subheadline explains WHAT the app does (feature-focused, not identity-focused)
- CTA button: "Build Your First Setlist" → routes to sign-up
- Hero is large but not full viewport (~70-80vh) — hints at content below
- Dramatic typography with oversized headline

### Feature showcase
- Highlight 3 core capabilities: Setlist timing, Song library, Band collaboration
- Floating UI crop screenshots (cropped actual UI, no device frames)
- Each card has headline + 1-2 sentence description alongside screenshot
- Stacked alternating layout — full-width rows, screenshot alternates left/right on desktop

### Social proof strategy
- Aspirational credibility through tool precision — "Every second of your set, accounted for" style
- No fake testimonials or placeholder quotes — identity and capability messaging instead
- Secondary CTA button repeating "Build Your First Setlist" in or near social proof section

### Visual personality
- Dark & dramatic aesthetic throughout — dark backgrounds, high contrast, stage-lighting feel
- Use existing app design tokens (surface/accent colors, fonts, dark theme)
- Very bold typography — hero headline 5-6rem+, section headings 3-4rem
- Subtle dividers between sections (thin lines or gradient fades)
- Minimal footer — logo, few links (sign up, login), copyright

### Claude's Discretion
- Social proof visual treatment (stats-style numbers vs typographic statement)
- Exact headline/subheadline copy
- Responsive breakpoint behavior
- Section spacing and padding values
- Screenshot selection and cropping

</decisions>

<specifics>
## Specific Ideas

- Hero should feel like walking up to a stage — dramatic, high contrast, bold
- Feature sections alternate screenshot left/right for visual rhythm
- CTA appears twice: once in hero, once near social proof to catch scrollers
- Dark theme throughout (not mixed dark/light) — consistent with the performance/music vibe

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-landing-page-structure*
*Context gathered: 2026-02-26*
