/**
 * Loads every chunk of the production server build the way Netlify's function does.
 *
 * Node normally spots ES module syntax in a .js file and copes, so a package with
 * `import` statements and no "type": "module" works in dev, in preview and on this
 * machine, then crashes the deployed function on load. Run through `pnpm verify:server`,
 * which turns that leniency off. A failure here usually means the package named in the
 * error needs adding to ssr.noExternal in vite.config.ts.
 */
import { readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve('.svelte-kit/output/server');

function chunks(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) return chunks(path);
		return /\.m?js$/.test(entry.name) ? [path] : [];
	});
}

const files = chunks(root);
if (files.length === 0) {
	console.error('No server build found. Run pnpm build first.');
	process.exit(1);
}

let failures = 0;
for (const file of files) {
	try {
		await import(pathToFileURL(file).href);
	} catch (error) {
		failures++;
		console.error(`${relative(root, file)}: ${error.message}`);
	}
}

if (failures > 0) {
	console.error(`${failures} of ${files.length} server chunks would crash on Netlify.`);
	process.exit(1);
}
console.log(`All ${files.length} server chunks load.`);
