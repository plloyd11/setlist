# Codebase Structure

**Analysis Date:** 2026-02-17

## Directory Layout

```
setlist/
├── src/                          # Source code directory
│   ├── app.d.ts                  # App namespace type definitions
│   ├── app.html                  # Root HTML document
│   ├── lib/                      # Shared library code and assets
│   │   ├── assets/               # Static assets (favicon, images)
│   │   └── index.ts              # Library barrel export (empty)
│   └── routes/                   # Page and layout components (file-based routing)
│       ├── +layout.svelte        # Root layout wrapper
│       ├── +page.svelte          # Home page component
│       └── layout.css            # Global styles with Tailwind
├── static/                       # Public static files (copied as-is to build)
├── .svelte-kit/                  # SvelteKit generated types and output (do not commit meaningful code)
├── .vscode/                      # VS Code workspace settings
├── .planning/                    # Planning and documentation
│   └── codebase/                 # Architecture and analysis documents
├── package.json                  # Project dependencies and scripts
├── pnpm-lock.yaml                # Lock file for pnpm
├── pnpm-workspace.yaml           # Workspace configuration
├── svelte.config.js              # SvelteKit configuration
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite build configuration
├── .prettierrc                   # Prettier code formatter config
├── .prettierignore               # Files to skip during formatting
├── README.md                     # Project documentation
├── .gitignore                    # Git exclusions
└── .npmrc                        # npm/pnpm configuration
```

## Directory Purposes

**src/:**
- Purpose: All application source code
- Contains: Components, pages, layouts, styles, type definitions
- Key files: Entry points are `src/app.html` (HTML root) and `src/routes/` (pages)

**src/lib/:**
- Purpose: Shared code and utilities directory
- Contains: Reusable components, utilities, assets, constants
- Key files: `index.ts` is barrel export for `$lib` alias imports

**src/lib/assets/:**
- Purpose: Static assets referenced from components
- Contains: `favicon.svg` and other site graphics/icons
- Key files: `favicon.svg` - favicon included in `<head>`

**src/routes/:**
- Purpose: File-based routing - file structure maps to URL paths
- Contains: Page components (`+page.svelte`), layout wrappers (`+layout.svelte`), styling
- Key files: `+layout.svelte` (root wrapper), `+page.svelte` (home page), `layout.css` (global styles)

**static/:**
- Purpose: Public assets served as-is without processing
- Contains: Files copied directly to build output
- Key files: None currently populated

**.svelte-kit/:**
- Purpose: Generated build artifacts and type information
- Contains: Compiled code, generated types, build output
- Generated: Yes
- Committed: No - in `.gitignore`

## Key File Locations

**Entry Points:**
- `src/app.html`: HTML document shell, SvelteKit injects content into `%sveltekit.body%`
- `src/routes/+page.svelte`: Home page component, rendered at URL `/`
- `src/routes/+layout.svelte`: Root layout wrapper applied to all pages

**Configuration:**
- `svelte.config.js`: SvelteKit adapter and config
- `vite.config.ts`: Vite build tool and plugin setup
- `tsconfig.json`: TypeScript compiler options
- `.prettierrc`: Code formatter settings
- `tailwindcss` settings: Configured via `.prettierrc` stylesheet path

**Core Logic:**
- `src/routes/layout.css`: Tailwind CSS imports and form plugin
- `src/app.d.ts`: App namespace for type augmentation

**Assets:**
- `src/lib/assets/favicon.svg`: Site favicon

## Naming Conventions

**Files:**
- Page components: `+page.svelte` (required name for routes)
- Layout components: `+layout.svelte` (required name for layouts)
- TypeScript files: `.ts` extension
- Svelte components: `.svelte` extension
- Styles: `.css` extension with Tailwind directives
- Type definitions: `.d.ts` extension
- Config files: Named by tool (e.g., `svelte.config.js`, `tsconfig.json`)

**Directories:**
- `routes/`: Contains `src/routes/` for URL mapping
- `lib/`: Shared code accessed via `$lib` alias
- `assets/`: Static files within `lib/`
- `static/`: Public files served directly

**Routing Convention:**
- `+page.svelte` = renders at this path
- `+layout.svelte` = wrapper for this path and children
- Directory name = URL segment (e.g., `src/routes/posts/+page.svelte` → `/posts`)

## Where to Add New Code

**New Page/Route:**
- Create: `src/routes/[path]/+page.svelte`
- Example: `src/routes/about/+page.svelte` renders at `/about`
- Auto-routed: Yes, no registration needed

**New Shared Component:**
- Create: `src/lib/components/ComponentName.svelte`
- Import: `import ComponentName from '$lib/components/ComponentName.svelte'`
- Usage: Can be used in any route

**New Utility Function:**
- Create: `src/lib/utils/utilName.ts`
- Import: `import { utilName } from '$lib/utils/utilName'` or from `$lib` if re-exported in `src/lib/index.ts`
- Pattern: Export functions as named exports

**New Assets:**
- Add to: `src/lib/assets/` for site-wide assets
- Import: `import asset from '$lib/assets/assetName.ext'`
- Use: Reference as variable in templates

**Global Styles:**
- Edit: `src/routes/layout.css` for site-wide styles
- Pattern: Tailwind directives (`@import`, `@plugin`, `@layer`)

**Type Definitions:**
- Extend: `src/app.d.ts` for App namespace augmentation
- Pattern: Declare interfaces within `declare global { namespace App { } }`

## Special Directories

**node_modules/:**
- Purpose: Installed npm dependencies
- Generated: Yes
- Committed: No - in `.gitignore`

**.svelte-kit/:**
- Purpose: SvelteKit build artifacts and type generation
- Generated: Yes (run `svelte-kit sync` to regenerate)
- Committed: No - in `.gitignore`

**.git/:**
- Purpose: Git repository metadata
- Committed: No - special git directory
- Note: Not a source directory

**.planning/codebase/:**
- Purpose: Architecture and analysis documentation
- Contains: `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md`
- Committed: Yes - part of project documentation

**.vscode/:**
- Purpose: VS Code workspace settings
- Generated: No - manually configured
- Committed: Optional - workspace-specific

---

*Structure analysis: 2026-02-17*
