import type { Handle } from '@sveltejs/kit/hooks';
import { redirect } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$app/env/public';
import { createServerClient } from '@supabase/ssr';

export const handle: Handle = async ({ event, resolve }) => {
	// no-store headers @supabase/ssr supplies whenever it writes session cookies.
	// Applied to the final response rather than via setHeaders, which throws if
	// setAll runs twice or a route has already set cache-control.
	const authCacheHeaders: Record<string, string> = {};

	event.locals.supabase = createServerClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet, headers) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});
				Object.assign(authCacheHeaders, headers);
			}
		}
	});

	// Memoized per request: getUser() is a network round-trip to Supabase Auth,
	// and the guard, layout load, and page loads all call safeGetSession.
	let sessionPromise: ReturnType<App.Locals['safeGetSession']> | null = null;
	event.locals.safeGetSession = () => {
		sessionPromise ??= (async () => {
			const {
				data: { user },
				error
			} = await event.locals.supabase.auth.getUser();
			if (error) {
				return { session: null, user: null };
			}
			const {
				data: { session }
			} = await event.locals.supabase.auth.getSession();
			return { session, user };
		})();
		return sessionPromise;
	};

	// Auth guard: protect all routes except /auth/*, /share/*, and root /
	if (
		!event.url.pathname.startsWith('/auth') &&
		!event.url.pathname.startsWith('/share') &&
		event.url.pathname !== '/'
	) {
		const { session } = await event.locals.safeGetSession();
		if (!session) {
			const returnUrl = event.url.pathname + event.url.search;
			throw redirect(303, `/auth?redirect=${encodeURIComponent(returnUrl)}`);
		}
	}

	const response = await resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});

	// The root layout serializes the request's session and cookies into every
	// page, so anything built for a request carrying cookies must stay out of
	// shared caches, whatever the route asked for. Otherwise the share page's
	// public CDN caching would serve a viewer's tokens to the next visitor.
	const cacheControl = response.headers.get('cache-control') ?? '';
	if (event.request.headers.has('cookie') && /public|s-maxage/.test(cacheControl)) {
		response.headers.set('cache-control', 'private, no-store');
	}
	for (const [name, value] of Object.entries(authCacheHeaders)) {
		response.headers.set(name, value);
	}

	return response;
};
