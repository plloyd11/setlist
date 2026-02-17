# Feature Landscape

**Domain:** Setlist management web app for bands/musicians
**Researched:** 2026-02-17
**Confidence:** MEDIUM (based on training data knowledge of competitors; web verification was unavailable)

## Competitive Landscape

Competitors fall into three tiers:

1. **Heavy-duty band management** (BandHelper, OnSong) -- native mobile apps, $10-20/month, deep feature sets including chord charts, lyrics, MIDI control, audio playback, calendar scheduling. Overkill for "I just need to plan my set timing."
2. **Community/archival** (Setlist.fm) -- crowd-sourced concert setlist database. Not a planning tool at all; users record what was played, not plan what will be played.
3. **Lightweight planning** (SetlistHelper, various spreadsheet templates) -- closer to our space but typically single-user, no real-time collaboration, limited sharing.

**Our gap:** A modern, collaborative, web-first setlist builder focused on timing. No native app install. No $15/month subscription for features you don't need. Share a link, see the clock, nail the set.

## Table Stakes

Features users expect. Missing any of these and the app feels broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Song library (name, artist, duration) | Every competitor has this. It's the fundamental data unit. | Low | Minimum viable fields: title, duration. Artist and key are near-table-stakes. |
| Create/edit setlists from song library | Core product loop. Drag songs into a setlist. | Medium | Needs drag-and-drop reordering. |
| Running time calculation | This is literally the core value prop. Users need to see "Set 1: 47 min" updating live as they add/remove/reorder. | Low | Sum of durations + optional break/transition times. |
| Multiple setlists | Bands play multiple gigs. One setlist per account is useless. | Low | Basic CRUD. |
| Multi-set support (Set 1, Set 2, etc.) | Most gigs have 2-3 sets with breaks. A single flat list doesn't model reality. | Medium | Sets within a setlist, each with its own running time + a total. |
| User accounts with authentication | Multi-user platform requirement. | Medium | Google OAuth via Supabase is already planned. |
| Share setlist via link | Band leaders share setlists with members. This is the minimum collaboration. | Low | Read-only public/unlisted link. |
| Mobile-responsive design | Musicians use phones at gigs and rehearsals. Desktop-only is a dealbreaker. | Medium | Not a native app, but must be fully usable on phone screens. |
| Search/filter song library | Once a library hits 50+ songs, browsing is painful. | Low | Search by title at minimum. Filter by key/genre is nice-to-have. |
| Duplicate a setlist | "Copy last week's setlist and tweak it" is the #1 workflow. | Low | Clone operation. |

## Differentiators

Features that set the product apart. Not expected, but create "oh nice" moments.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Real-time collaborative editing | Multiple band members edit the same setlist simultaneously. BandHelper supports sync but not real-time co-editing. Web-native advantage. | High | Supabase Realtime or similar. Big lift but huge differentiator. |
| Transition/changeover time between songs | Account for tuning, talking to audience, instrument swaps. Most tools only sum song durations, ignoring the 1-2 min between songs that adds up fast. | Low | Per-song or global default transition time. Adds to running total. |
| Target time with over/under indicator | "We have a 90-minute slot." Show +5:00 or -3:00 vs target. Visual red/green. BandHelper has this; most lightweight tools do not. | Low | Simple math but high UX value. Turns the app from "calculator" to "planning tool." |
| Band/group workspaces | Shared song library and setlists within a band. A musician in multiple bands sees each band's library separately. | High | Multi-tenancy model. Core to the collaboration story. |
| Setlist templates | Save a setlist structure (e.g., "opener, 3 uptempo, ballad, closer") without specific songs. Fill in songs later. | Medium | Template system with slot types. |
| Gig association | Attach a setlist to a date/venue. See history: "What did we play at The Blue Note on Jan 15?" | Medium | Lightweight event model. Useful for avoiding repeats at the same venue. |
| Song notes/annotations | Per-song notes visible in the setlist: "capo 3", "start quiet", "skip bridge." | Low | Text field per setlist-song entry (not per song globally -- notes change per gig). |
| Print/export view | Clean printable PDF or shareable image of the setlist. Musicians tape setlists to monitors. | Medium | Server-side PDF generation or print-optimized CSS. |
| Drag-and-drop between sets | Move a song from Set 1 to Set 2 with drag-and-drop, seeing both timings update live. | Medium | Cross-container DnD. Most competitors only support reorder within a single list. |
| Key and tempo metadata | Store key (e.g., "Am") and BPM per song. Filter library by key to avoid three songs in a row in the same key. | Low | Additional song fields. Useful for set flow planning. |
| Song energy/mood tagging | Tag songs as "high energy", "ballad", "mid-tempo." Visualize the energy arc of a setlist. | Medium | Tagging system + visual arc display. Helps plan set dynamics. |
| Offline support (PWA) | Musicians are in basements and bars with bad wifi. PWA with service worker caching. | High | Service worker, IndexedDB sync. Significant complexity but real-world necessity for gig use. |
| Import songs from Spotify/Apple Music | Auto-populate song library with title, duration, key, tempo from streaming metadata. | Medium | API integration. Spotify Web API has duration_ms and audio features (key, tempo). Saves manual entry. |
| Setlist history/versioning | See previous versions of a setlist. Undo "who deleted that song?" | Medium | Version snapshots or event log. |

## Anti-Features

Features to explicitly NOT build. These are scope traps or misaligned with the product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Chord charts / lyrics display | This is OnSong's entire product. Building it means competing with a mature, well-funded tool on their home turf. It also bloats scope massively (transposition, formatting, ChordPro parsing). | Link out to external chord/lyric sources. Maybe store a URL per song. |
| MIDI/audio integration | BandHelper does MIDI program changes, backing track playback, click tracks. This is pro-audio territory requiring native app capabilities. | Stay web-focused. A web app cannot reliably send MIDI or sync audio playback. |
| Calendar/scheduling | Band scheduling (rehearsals, gigs, availability) is a different product. BandHelper bundles it, but it's a whole separate domain. | Gig association (date + venue on a setlist) is enough. For scheduling, users have Google Calendar. |
| Social features / public profiles | Setlist.fm is the social setlist network. Building community features dilutes focus and requires moderation infrastructure. | Share-via-link is sufficient. No need for followers, comments, or public discovery. |
| Payment/financial tracking | Some band tools track gig payments, splits, expenses. Totally different domain. | Out of scope. Bands use Splitwise or spreadsheets. |
| Notation/sheet music rendering | Rendering musical notation is an enormous technical challenge (LilyPond, VexFlow). Not relevant to setlist planning. | Store key and tempo as simple text fields. |
| Native mobile app | SvelteKit web app with good responsive design covers mobile use. Native apps mean maintaining iOS + Android codebases, app store approvals, and update cycles. | PWA for offline support if needed. Responsive web-first. |
| Complex permissions/roles | "Admin can edit, member can view, guest can comment" -- role-based access is enterprise complexity. | Two levels only: owner (edit) and viewer (read-only via share link). Add band-member editing later as a single permission level. |

## Feature Dependencies

```
User accounts (auth) --> Song library --> Setlist creation --> Running time calc
                                      --> Multi-set support --> Drag between sets
                                      --> Share via link
                     --> Band workspaces --> Shared song library
                                         --> Collaborative editing

Song library --> Search/filter
            --> Import from Spotify

Setlist creation --> Duplicate setlist
                --> Setlist templates
                --> Gig association --> Setlist history
                --> Target time indicator
                --> Transition times
                --> Print/export

Song metadata (key, tempo, energy) --> Energy arc visualization
                                   --> Filter by key
```

## MVP Recommendation

Build these first (Phase 1-2):

1. **User accounts with Google OAuth** -- gate everything behind auth
2. **Song library CRUD** -- title, artist, duration, key (optional)
3. **Setlist creation with drag-and-drop reorder** -- the core interaction
4. **Running time calculation** -- the core value prop, must be live-updating
5. **Multi-set support** (Set 1, Set 2 with break) -- models real gigs
6. **Target time with over/under indicator** -- low complexity, high value
7. **Transition time (global default)** -- low complexity, fixes a real pain point
8. **Share setlist via read-only link** -- minimum viable collaboration
9. **Duplicate setlist** -- essential workflow shortcut
10. **Mobile-responsive layout** -- not optional for musician users

Defer to Phase 3+:

- **Band workspaces** -- High complexity, requires multi-tenancy data model. Get single-user right first.
- **Real-time collaborative editing** -- High complexity. Share links cover 80% of the need.
- **Offline/PWA** -- High complexity. Validate the product works online first.
- **Spotify import** -- Nice-to-have. Manual entry is fine for libraries under 100 songs.
- **Energy arc visualization** -- Cool differentiator but not core.
- **Print/export** -- Medium complexity, can use browser print in the meantime.

## Sources

- Competitor analysis based on training data knowledge of BandHelper, OnSong, SetlistHelper, and Setlist.fm feature sets (MEDIUM confidence -- unable to verify against live sites during this research session)
- Feature prioritization based on the stated core value prop: "see how long the set runs so they can nail timing for a show"
