import adapter from '@sveltejs/adapter-netlify';
import { alphaTab } from '@coderline/alphatab-vite';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), alphaTab(), sveltekit({ adapter: adapter() })],
	optimizeDeps: {
		// The NAM engine finds its worklet and wasm beside itself (new URL(..., import.meta.url)).
		// Pre-bundling would move it away from them.
		exclude: ['neural-amp-modeler-wasm']
	},
	ssr: {
		// gsap ships ES modules without "type": "module", so left external it crashes the
		// Netlify function on load. pnpm verify:server catches this kind of package.
		noExternal: ['gsap']
	}
});
