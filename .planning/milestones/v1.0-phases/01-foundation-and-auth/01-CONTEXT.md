# Phase 1: Foundation and Auth - Context

**Gathered:** 2026-02-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Supabase setup, Google OAuth, database schema, project structure, and protected app shell. Users can sign in with Google, access a protected dashboard, persist sessions, and log out. Unauthenticated users are redirected to login.

</domain>

<decisions>
## Implementation Decisions

### Visual Identity
- Warm and musical aesthetic — rich colors, textured feel, analog/vinyl vibes
- Primary/accent color: amber/gold — like tube amp glow
- Dark and light mode with user toggle (both themes from day one)
- Typography: slightly retro feel — slab or rounded fonts that nod to gig posters
- Overall direction: warm, inviting, musical — not sterile or corporate

### App Shell & Navigation
- Left sidebar navigation on desktop (like Linear or Spotify)
- Bottom tab bar on mobile (thumb-friendly, replaces sidebar on small screens)
- Sidebar sections: Home, Songs, Setlists, Settings
- Bands section added to sidebar in Phase 4
- After sign-in, user lands on a dashboard/home page with recent setlists and quick stats

### Login Experience
- Google OAuth sign-in page — clean, branded with the warm/amber aesthetic
- After successful auth, redirect to dashboard

### Claude's Discretion
- Exact font choices (within the "slightly retro" direction — slab serif or rounded sans)
- Dark/light mode color scales (built around amber/gold accent)
- Dashboard home page layout and content (recent setlists, quick actions)
- Error states for auth failures
- Session expiry handling
- Loading states and transitions

</decisions>

<specifics>
## Specific Ideas

- Amber/gold accent should feel like the warm glow of a tube amplifier
- Sidebar should feel like Spotify or Linear — compact, icon + label, collapsible on desktop
- Mobile bottom tabs should have the core 4: Home, Songs, Setlists, Settings

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-and-auth*
*Context gathered: 2026-02-17*
