# Coding Conventions

**Analysis Date:** 2026-02-17

## Naming Patterns

**Files:**
- Route files: `+page.svelte`, `+layout.svelte` (SvelteKit convention)
- Configuration files: `svelte.config.js`, `vite.config.ts`
- Type definition files: `.d.ts` (e.g., `app.d.ts`)
- CSS files: `layout.css` (kebab-case for CSS)
- Library exports: `index.ts`

**Functions:**
- camelCase for all function and method names
- Example from `vite.config.ts`: `defineConfig()`

**Variables:**
- camelCase for variables and constants
- Example from `+layout.svelte`: `let { children } = $props();`
- Svelte reactive declarations use destructuring with `$props()` and `$state()`

**Types:**
- PascalCase for types, interfaces, and generics (TypeScript convention)
- Type definitions in `.d.ts` files use standard interface notation
- Example from `app.d.ts`: `namespace App` declarations

## Code Style

**Formatting:**
- Tool: Prettier 3.8.1
- Tabs: enabled (`useTabs: true`)
- Line width: 100 characters (`printWidth: 100`)
- Quotes: single quotes (`singleQuote: true`)
- Trailing commas: none (`trailingComma: "none"`)
- Svelte files: use `svelte` parser
- Tailwind CSS: automatic class ordering via `prettier-plugin-tailwindcss`

**Linting:**
- No ESLint configuration present
- Svelte Check: TypeScript validation for Svelte files via `svelte-check`
- Stricter TypeScript: `strict: true` in `tsconfig.json` enables all strict type checking options

**TypeScript Configuration:**
- Strict mode enabled with `strict: true`
- Module resolution: `bundler` (modern approach)
- Rewrite relative import extensions: enabled
- Allow JavaScript files: enabled (`allowJs: true`)
- Check JavaScript: enabled (`checkJs: true`)
- Force consistent casing: enabled

## Import Organization

**Order:**
1. Framework imports (e.g., `import` from 'svelte', '@sveltejs/kit')
2. Asset imports (e.g., `import favicon from '$lib/assets/favicon.svg'`)
3. Relative imports from same directory/project

**Path Aliases:**
- `$lib`: points to `src/lib` (automatic via SvelteKit)
- Relative imports can use `$lib` for shared utilities
- Example from `+layout.svelte`: `import favicon from '$lib/assets/favicon.svg'`

## Error Handling

**Patterns:**
- No explicit error handling patterns observed in current codebase
- TypeScript strict mode provides compile-time safety
- Svelte Check validates component logic before runtime
- Type guards via TypeScript for runtime safety

## Logging

**Framework:** Not implemented
- Use `console` if needed (not explicitly configured)
- No structured logging currently in use

## Comments

**When to Comment:**
- Comments provided in template files point to relevant documentation
- Example from `app.d.ts`: `// See https://svelte.dev/docs/kit/types#app.d.ts`
- JSDoc comments discouraged in favor of clear code and TypeScript types

**JSDoc/TSDoc:**
- Not actively used in this project
- TypeScript types serve as inline documentation

## Function Design

**Size:**
- Keep functions small and focused
- Example in `vite.config.ts`: exported function spans 1 line
- Component lifecycle logic embedded in Svelte files with lifecycle functions

**Parameters:**
- Use destructuring for object parameters
- Example from `+layout.svelte`: `let { children } = $props();`
- Named parameters preferred over positional arguments

**Return Values:**
- Explicit return types via TypeScript annotations
- Void functions omit return types
- Example from `vite.config.ts`: returns explicit config object

## Module Design

**Exports:**
- Named exports preferred for clarity
- Default exports for config files and main entry points
- Example from `vite.config.ts`: `export default defineConfig(...)`
- Example from `svelte.config.js`: `export default config`

**Barrel Files:**
- `src/lib/index.ts` exists as a barrel file for library exports
- Used as a central export point for shared utilities and components

## Svelte Specific Patterns

**Reactive Declarations:**
- Use `$props()` for component props in Svelte 5+
- Use `$state()` for reactive state
- Example: `let { children } = $props();`

**Imports in Svelte:**
- Style imports: `import './layout.css'`
- Asset imports: `import favicon from '$lib/assets/favicon.svg'`
- Script block: `<script lang="ts">` for TypeScript support

**Naming Routes:**
- Use `+page.svelte` for page components
- Use `+layout.svelte` for layout wrappers
- Use `+server.ts` for API endpoints (if applicable)

---

*Convention analysis: 2026-02-17*
