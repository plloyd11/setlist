# Technology Stack

**Analysis Date:** 2026-02-17

## Languages

**Primary:**
- TypeScript 5.9.3 - Full codebase, strict mode enabled

**Secondary:**
- JavaScript - Configuration files (`svelte.config.js`, `.prettierrc`)
- CSS - Styling with Tailwind (via `@import 'tailwindcss'` in `src/routes/layout.css`)

## Runtime

**Environment:**
- Node.js 24.11.0 - Current runtime in use

**Package Manager:**
- pnpm - Workspace-aware package manager
- Lockfile: `pnpm-lock.yaml` (present, v9.0)

## Frameworks

**Core:**
- SvelteKit 2.52.0 - Full-stack Svelte framework, with TypeScript support
- Svelte 5.51.3 - Component framework and templating

**Styling:**
- Tailwind CSS 4.1.18 - Utility-first CSS framework
- @tailwindcss/vite 4.1.18 - Vite integration for Tailwind
- @tailwindcss/forms 0.5.11 - Form component styling plugin

**Build/Dev:**
- Vite 7.3.1 - Frontend build tool and dev server
- @sveltejs/vite-plugin-svelte 6.2.4 - Svelte integration for Vite

## Key Dependencies

**Critical:**
- @sveltejs/kit 2.52.0 - Provides routing, SSR, adapters, and SvelteKit ecosystem
- @sveltejs/adapter-netlify 5.2.4 - Deployment adapter for Netlify serverless functions

**Dev Tools:**
- Prettier 3.8.1 - Code formatter
- prettier-plugin-svelte 3.4.1 - Svelte formatting
- prettier-plugin-tailwindcss 0.7.2 - Tailwind class sorting
- svelte-check 4.4.0 - Svelte type checking and linting
- TypeScript 5.9.3 - Type checking

## Configuration

**TypeScript:**
- Config: `tsconfig.json`
- Extends: `.svelte-kit/tsconfig.json` (SvelteKit generated)
- Key options: Strict mode, source maps, ES module interop, JSON module resolution, bundler module resolution

**Build:**
- Vite config: `vite.config.ts`
- SvelteKit config: `svelte.config.js` (uses Netlify adapter)
- Prettier config: `.prettierrc` (tabs, single quotes, 100-char width, Svelte parser overrides)

**Code Quality:**
- Formatter: Prettier with Svelte and Tailwind plugins
- Linting: svelte-check for static analysis
- Type checking: TypeScript with strict mode

## Platform Requirements

**Development:**
- Node.js 18+ (explicitly configured in `.npmrc` with `engine-strict=true`)
- pnpm package manager
- Modern terminal/shell for npm scripts

**Production:**
- Netlify hosting (configured via `@sveltejs/adapter-netlify`)
- Generates serverless functions for dynamic routes
- Static file serving for assets in `static/`

## Build Targets

**Development:**
- Command: `pnpm dev` or `npm run dev`
- Dev server: Vite dev server with hot module replacement

**Production:**
- Build command: `pnpm build` or `npm run build`
- Output: `.svelte-kit/output/` with Netlify adapter-specific structure
- Preview: `pnpm preview` or `npm run preview`

## Additional Notes

- **Workspace:** pnpm workspace configured with only `esbuild` as non-module build dependency
- **Entry points:** `src/app.html` (HTML shell), `src/routes/+layout.svelte` (root layout), `src/routes/+page.svelte` (home page)
- **Assets:** `src/lib/assets/` for SVG and other static assets
- **No external APIs:** Currently no integration with Spotify, Supabase, Firebase, or other external services detected

---

*Stack analysis: 2026-02-17*
