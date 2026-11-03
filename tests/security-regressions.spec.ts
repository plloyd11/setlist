import { test, expect } from './fixtures';
import { createSetlist, createSong } from './helpers/factories';
import { safeDelete } from './helpers/cleanup';
import { createSecondUser } from './helpers/multi-user';

// URL parsers strip tabs/newlines and treat "\" as "/", so all of these navigate
// off-origin in a browser despite starting with a single "/". `.invalid` never
// resolves, so a regression can't actually reach anything.
const HOSTILE_PATHS = ['/\t/evil.invalid', '/\n/evil.invalid', '/\\evil.invalid', '//evil.invalid'];

test.describe('Share page caching', () => {
	test('a response built for a logged-in viewer is never publicly cacheable', async ({
		page,
		browser,
		baseURL,
		testUser
	}) => {
		const token = crypto.randomUUID();
		const setlist = await createSetlist(page, testUser.id, {
			name: 'Cache Safety Set',
			share_token: token
		});

		try {
			// The root layout serializes the session into this HTML, so a CDN copy
			// would hand the viewer's tokens to whoever requests the link next
			const owner = await page.goto(`/share/${token}`);
			const ownerCache = owner?.headers()['cache-control'] ?? '';
			expect(ownerCache).not.toContain('public');
			expect(ownerCache).not.toContain('s-maxage');

			const anonContext = await browser.newContext({
				baseURL,
				storageState: { cookies: [], origins: [] }
			});
			const anon = await anonContext.newPage();
			const anonResponse = await anon.goto(`/share/${token}`);
			expect(anonResponse?.headers()['cache-control']).toContain('s-maxage');
			expect(await anonResponse?.text()).not.toContain('access_token');
			await anonContext.close();
		} finally {
			await safeDelete('setlists', setlist.id);
		}
	});
});

test.describe('Session cookie responses', () => {
	test('a token refresh response is marked no-store', async ({ browser, playwright, baseURL }) => {
		// Dedicated user: the refresh rotates the token, which would invalidate the
		// session the worker's other tests share
		const { page, cleanup } = await createSecondUser(browser);
		const anon = await playwright.request.newContext({ baseURL });

		try {
			const chunks = (await page.context().cookies())
				.filter((c) => /-auth-token(\.\d+)?$/.test(c.name))
				.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
			const session = JSON.parse(
				Buffer.from(
					chunks
						.map((c) => c.value)
						.join('')
						.replace(/^base64-/, ''),
					'base64url'
				).toString()
			);

			// Same session, but expired: the server must refresh it mid-request
			session.expires_at = Math.floor(Date.now() / 1000) - 60;
			const expired = Buffer.from(JSON.stringify(session)).toString('base64url');
			const response = await anon.get('/dashboard', {
				headers: { cookie: `${chunks[0].name.replace(/\.\d+$/, '')}=base64-${expired}` },
				maxRedirects: 0
			});

			expect(response.status()).toBe(200);
			expect(response.headers()['set-cookie']).toContain('-auth-token');
			expect(response.headers()['cache-control']).toContain('no-store');
		} finally {
			await anon.dispose();
			await cleanup();
		}
	});
});

test.describe('Redirect targets stay on this origin', () => {
	for (const hostile of HOSTILE_PATHS) {
		const label = JSON.stringify(hostile);

		test(`OAuth callback ignores ${label}`, async ({ playwright, baseURL }) => {
			const anon = await playwright.request.newContext({ baseURL });
			const response = await anon.get('/auth/callback', {
				headers: { cookie: `auth_redirect=${encodeURIComponent(hostile)}` },
				maxRedirects: 0
			});
			expect(response.status()).toBe(303);
			expect(response.headers()['location']).toBe('/dashboard');
			await anon.dispose();
		});

		test(`practice back link ignores ${label}`, async ({ page, testUser }) => {
			const song = await createSong(page, testUser.id, { title: 'Back Link Song' });
			try {
				await page.goto(`/songs/${song.id}/practice?from=${encodeURIComponent(hostile)}`);
				const href = await page
					.getByRole('link', { name: /back/i })
					.first()
					.evaluate((a) => {
						return (a as HTMLAnchorElement).href;
					});
				expect(new URL(href).origin).toBe(new URL(page.url()).origin);
			} finally {
				await safeDelete('songs', song.id);
			}
		});
	}

	test('sign-in does not follow a hostile ?redirect=', async ({ browser, baseURL, testUser }) => {
		const context = await browser.newContext({
			baseURL,
			storageState: { cookies: [], origins: [] }
		});
		const page = await context.newPage();
		await page.goto(`/auth?redirect=${encodeURIComponent(HOSTILE_PATHS[0])}`);
		// The sign-in form relies on a client-side handler: wait for hydration
		await page.waitForLoadState('networkidle');
		await page.getByLabel('Email').fill(testUser.email);
		await page.getByLabel('Password').fill(testUser.password);
		await page.getByRole('button', { name: /sign in with email/i }).click();
		await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
		await context.close();
	});
});
