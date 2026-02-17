# Architecture

**Analysis Date:** 2026-02-17

## Pattern Overview

**Overall:** SvelteKit full-stack framework with file-based routing and component-driven UI

**Key Characteristics:**
- Server-side routing driven by file system structure
- Component-first architecture with Svelte reactive components
- Unified frontend and backend in single codebase
- Static asset management and favicon handling
- Tailwind CSS for styling with form utilities plugin

## Layers

**Presentation (UI Components):**
- Purpose: Render HTML and handle user interactions
- Location: `src/routes/`
- Contains: Svelte components (`.svelte` files), page layouts, layout wrappers
- Depends on: Assets (`$lib/assets`), styling (`layout.css`)
- Used by: Browser renders these as the user interface

**Layout System:**
- Purpose: Provide consistent application shell and styling foundation
- Location: `src/routes/+layout.svelte`, `src/routes/layout.css`
- Contains: Root layout wrapper, global CSS imports, favicon injection
- Depends on: Tailwind CSS, Svelte runtime
- Used by: All pages inherit layout through `+layout.svelte`

**Assets & Resources:**
- Purpose: Store static assets and favicon
- Location: `src/lib/assets/`
- Contains: `favicon.svg` and other static resources
- Depends on: Vite for asset bundling
- Used by: Referenced in layout and components

**Build & Runtime:**
- Purpose: Transform source code to production output
- Location: Handled by Vite and SvelteKit
- Contains: Bundle optimization, code splitting, deployment adapter
- Depends on: SvelteKit adapter (Netlify), TypeScript compiler, Vite

## Data Flow

**Route Resolution → Component Render:**

1. User requests URL (e.g., `/`)
2. SvelteKit matches URL to file in `src/routes/` (e.g., `+page.svelte`)
3. Layout hierarchy applied: `+layout.svelte` wraps page
4. Components render with reactive state
5. CSS applied from `layout.css` (Tailwind imports)
6. HTML sent to browser

**Asset Loading:**

1. Assets referenced via `$lib/` alias (e.g., `$lib/assets/favicon.svg`)
2. Vite resolves alias to `src/lib/` directory
3. Assets bundled during build, fingerprinted for cache busting
4. favicon injected in `<head>` via `<svelte:head>` directive

**State Management:**

- Component-level reactivity: `$props()` rune for props
- No global state management library; uses Svelte stores if needed
- Server context available via SvelteKit's `locals` (currently unused)

## Key Abstractions

**Page Component:**
- Purpose: Represents a route and its content
- Examples: `src/routes/+page.svelte`
- Pattern: Default export of Svelte component, automatically routed by filename

**Layout Component:**
- Purpose: Wraps pages with shared structure and styling
- Examples: `src/routes/+layout.svelte`
- Pattern: Receives `children` via `$props()`, renders child pages via `{@render children()}`

**Asset Imports:**
- Purpose: Reference static files with type safety
- Examples: `import favicon from '$lib/assets/favicon.svg'`
- Pattern: Uses `$lib` alias configured by SvelteKit, imported as variables

**CSS Directives:**
- Purpose: Global styling and plugin integration
- Examples: `@import 'tailwindcss'`, `@plugin '@tailwindcss/forms'`
- Pattern: Tailwind v4 Vite plugin provides CSS through imports

## Entry Points

**Application Root:**
- Location: `src/app.html`
- Triggers: Browser initial page load
- Responsibilities: HTML document structure, `%sveltekit.body%` placeholder for content injection, viewport and charset meta tags

**Route Handler (Page):**
- Location: `src/routes/+page.svelte`
- Triggers: GET request to `/`
- Responsibilities: Render welcome message with documentation link

**Layout Wrapper:**
- Location: `src/routes/+layout.svelte`
- Triggers: Wraps all route handlers
- Responsibilities: Import global CSS, set favicon, render page content via `{@render children()}`

**Type Definitions:**
- Location: `src/app.d.ts`
- Triggers: TypeScript compilation
- Responsibilities: Extend App namespace for type safety (currently minimal declarations)

## Error Handling

**Strategy:** SvelteKit default error boundaries with custom error page support (not currently implemented)

**Patterns:**
- Server errors: SvelteKit catches unhandled exceptions in page load/form actions
- Client errors: Uncaught exceptions in components logged to browser console
- 404 handling: Default SvelteKit 404 page (can be customized with `+error.svelte`)

## Cross-Cutting Concerns

**Logging:** No explicit logging framework; uses browser `console` methods for client-side

**Validation:** Not yet implemented; form validation handled via HTML5 native validation or custom logic

**Authentication:** Not currently implemented; App namespace prepared for auth context via `Locals`

**Styling:** Tailwind CSS v4 with `@tailwindcss/forms` plugin for form element styling

**Type Safety:** TypeScript strict mode enabled; component props typed via `$props()` rune

---

*Architecture analysis: 2026-02-17*
