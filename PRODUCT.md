# Product

## Register

product

## Users

Working musicians and bands. They manage a shared song library, build timed setlists against a target set length, and share them — with bandmates through band workspaces, or publicly via read-only share links. Context of use is split: planning at a desk (rehearsal prep, browsing the library, drag-and-drop building) and consulting on a phone in rehearsal rooms and dark venues. The core job: "get the right songs in the right order, fitting the time we've got, and make sure everyone has it."

## Product Purpose

Setlist removes the spreadsheet/paper-scrap workflow from set planning. Songs are name + duration; setlists show running totals against a target time as you drag songs in. Success looks like: a band keeps its library here, builds every gig's set here, and the share link is what ends up on stage. Out of scope by decision: song metadata beyond name + length, set sections, real-time collaboration.

## Brand Personality

Stage-ready and confident. Gig-night energy: dark, punchy, with deliberate glow — a tool that feels like backstage gear, not office software. The existing identity carries this: dark navy surfaces, chartreuse neon highlights, copper warmth, Cartridge display type with character. Voice is direct and musician-to-musician, never corporate. Three words: confident, electric, roadworthy.

## Anti-references

- **Generic SaaS dashboard** — no stat-card heroes, gradient accents, or identical icon-heading-text card grids. This is not a Linear/Notion clone.
- **Spotify/streaming clone** — a music tool is not a streaming UI. No album-art grids, no media-player chrome aesthetics as default scaffolding.
- **Corporate/enterprise software** — nothing sterile, beige, or compliance-flavored. The audience is working musicians.

## Design Principles

1. **The set time is the hero.** Running total vs. target time is the product's reason to exist — it should always be glanceable, never buried.
2. **Built for the gig, not the office.** Dark mode is the spiritual home; legibility in low light and on phones matters more than desktop density.
3. **Drag is the language.** Reordering and building are physical acts; motion and feedback should make manipulation feel immediate and certain (optimistic UI, no spinners between drops).
4. **Loud where it counts, quiet everywhere else.** Chartreuse neon and glow are for the moments that matter (the total, the active drop target, the share action) — the rest stays restrained navy.
5. **Band-first, not user-first.** Sharing, band workspaces, and "everyone sees the same set" flows deserve first-class treatment, not settings-page afterthoughts.

## Accessibility & Inclusion

WCAG AA. Body text ≥4.5:1 against its background in both themes (watch chartreuse-on-navy for small text — reserve neon for large/bold elements or verify contrast). Visible focus states throughout. Every animation gets a `prefers-reduced-motion` alternative. Drag-and-drop flows need keyboard-operable equivalents (svelte-dnd-action's keyboard support, or explicit move controls). Touch targets ≥44px on mobile surfaces.
