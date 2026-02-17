# Testing Patterns

**Analysis Date:** 2026-02-17

## Test Framework

**Runner:**
- Not detected - no test runner configured
- Vitest or Jest can be integrated as needed

**Assertion Library:**
- Not detected - no assertion library configured

**Run Commands:**
```bash
npm run check                # Type checking via svelte-check
npm run check:watch          # Watch mode for type checking
npm run lint                 # Prettier validation only
npm run format               # Code formatting
```

**Available Commands:**
- Type validation: `svelte-check --tsconfig ./tsconfig.json`
- Type validation watch: `svelte-check --tsconfig ./tsconfig.json --watch`

## Test File Organization

**Location:**
- No test files currently in codebase
- Recommended pattern: co-located tests next to source files

**Naming:**
- Convention for future implementation: `[name].test.ts`, `[name].spec.ts`

**Structure:**
```
src/
├── components/
│   ├── Button.svelte
│   └── Button.test.ts          # Co-located test
├── lib/
│   ├── utils.ts
│   └── utils.test.ts           # Co-located test
└── routes/
    ├── +page.svelte
    └── +page.test.ts           # Co-located test
```

## Test Structure

**Recommended Suite Organization:**
- No test files exist to reference, but follow standard patterns:

```typescript
// Example pattern to follow:
import { describe, it, expect } from 'vitest';
import Component from './Component.svelte';

describe('Component', () => {
	it('should render correctly', () => {
		// Test implementation
	});

	it('should handle user input', () => {
		// Test implementation
	});
});
```

**Patterns:**
- Setup: Use `beforeEach` for component initialization and fixture setup
- Teardown: Use `afterEach` for cleanup
- Assertion: Use `expect()` pattern (Vitest/Jest standard)

## Mocking

**Framework:**
- Not configured - recommend Vitest's built-in mocking
- Can use `vi.mock()` for module mocking

**Patterns:**
- Not established yet in codebase
- Recommended approach for Svelte components:

```typescript
// Example mocking pattern (to establish):
import { vi } from 'vitest';

// Mock module
vi.mock('$lib/utils', () => ({
	getSomething: vi.fn(() => 'mocked value')
}));

// Mock fetch in tests
global.fetch = vi.fn();
```

**What to Mock:**
- External API calls
- File system operations
- Time-dependent functions (use `vi.useFakeTimers()`)
- Environment variables

**What NOT to Mock:**
- Core Svelte functionality
- Local utility functions (test the real implementation)
- Component rendering logic (test actual DOM)

## Fixtures and Factories

**Test Data:**
- Not established yet in codebase
- Recommended pattern:

```typescript
// src/lib/test/fixtures.ts
export const mockUser = {
	id: '1',
	name: 'Test User',
	email: 'test@example.com'
};

export const createMockComponent = (props = {}) => ({
	...defaultProps,
	...props
});
```

**Location:**
- Recommended: `src/lib/test/fixtures.ts` or `src/lib/test/factories.ts`
- Keep fixtures separate from test files for reusability

## Coverage

**Requirements:** Not enforced
- No coverage configuration present
- Recommended: Set up coverage thresholds once tests are added

**View Coverage:**
```bash
# Once testing framework installed:
vitest --coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, utilities, components
- Approach: Test in isolation using mocks for dependencies
- Target files: `src/lib/utils.ts`, utility functions

**Integration Tests:**
- Scope: Component interaction, multiple components together
- Approach: Test components mounted together with their dependencies
- Target files: Layout components (`+layout.svelte`), page components (`+page.svelte`)

**E2E Tests:**
- Framework: Not configured
- Recommendation: Playwright or Cypress for future E2E testing
- Not currently implemented

## Type Checking (Current Alternative)

**Framework:** Svelte Check
- Provides TypeScript validation for Svelte components
- Catches type errors in templates and component logic
- Run via: `npm run check` or `npm run check:watch`

**TypeScript Strict Mode:**
- All strict type checking enabled in `tsconfig.json`
- Provides compile-time safety for:
  - No implicit any types
  - Strict null checks
  - Strict function types
  - Strict property initialization

## Common Patterns

**Async Testing:**
- Not yet established - recommended pattern:

```typescript
it('should load data asynchronously', async () => {
	const promise = fetchData();
	await expect(promise).resolves.toEqual(expectedData);
});
```

**Error Testing:**
- Recommended pattern:

```typescript
it('should throw on invalid input', () => {
	expect(() => {
		processData(null);
	}).toThrow(TypeError);
});
```

## Implementation Roadmap

To add testing to this project:

1. **Install Vitest:**
   ```bash
   npm install -D vitest @vitest/ui
   ```

2. **Create config:** `vitest.config.ts`
   ```typescript
   import { defineConfig } from 'vitest/config';
   import { sveltekit } from '@sveltejs/kit/vite';

   export default defineConfig({
     plugins: [sveltekit()],
     test: {
       globals: true,
       environment: 'jsdom'
     }
   });
   ```

3. **Add script to `package.json`:**
   ```json
   "test": "vitest",
   "test:ui": "vitest --ui",
   "test:coverage": "vitest --coverage"
   ```

4. **Create first test:** `src/routes/+page.test.ts`

---

*Testing analysis: 2026-02-17*
