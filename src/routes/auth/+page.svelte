<script lang="ts">
	import { page } from '$app/state';

	let error = $state(
		page.url.searchParams.get('error') === 'auth_exchange_failed'
			? 'Sign in failed. Please try again.'
			: ''
	);

	let email = $state('');
	let password = $state('');

	// Only allow same-origin relative paths — an attacker-supplied
	// ?redirect=https://evil.com must not be followed after sign-in.
	const safeRedirect = (value: string | null): string => {
		if (!value) return '/dashboard';
		const decoded = decodeURIComponent(value);
		if (decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.startsWith('/\\')) {
			return decoded;
		}
		return '/dashboard';
	};

	const signInWithEmail = async (e: Event) => {
		e.preventDefault();
		error = '';
		const { error: authError } = await page.data.supabase.auth.signInWithPassword({
			email,
			password
		});
		if (authError) {
			error = authError.message;
			return;
		}
		window.location.href = safeRedirect(page.url.searchParams.get('redirect'));
	};

	const signInWithGoogle = async () => {
		error = '';
		// Store redirect target in a cookie so it survives the OAuth round-trip
		// (query params on the callback URL can be stripped by Supabase)
		const redirectParam = page.url.searchParams.get('redirect');
		if (redirectParam) {
			document.cookie = `auth_redirect=${encodeURIComponent(redirectParam)};path=/;max-age=600;SameSite=Lax`;
		}
		const { error: authError } = await page.data.supabase.auth.signInWithOAuth({
			provider: 'google',
			options: {
				redirectTo: `${window.location.origin}/auth/callback`
			}
		});
		if (authError) {
			error = authError.message;
		}
	};
</script>

<div class="flex min-h-screen items-center justify-center bg-surface-50 dark:bg-surface-950">
	<div class="w-full max-w-sm px-6">
		<div
			class="rounded-2xl bg-surface-50 p-8 shadow-lg dark:bg-surface-900 dark:shadow-surface-900/50"
		>
			<!-- Logo / App Name -->
			<div class="mb-8 text-center">
				<h1 class="text-4xl font-bold tracking-tight text-accent-500">Setlist</h1>
				<p class="mt-2 text-sm text-surface-500 dark:text-surface-400">Build your perfect set</p>
			</div>

			<!-- Google Sign-In Button -->
			<button
				onclick={signInWithGoogle}
				class="flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg bg-accent-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-600 focus:ring-2 focus:ring-neon-400 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-surface-900"
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
					<path
						d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
						fill="#ffffff"
					/>
					<path
						d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
						fill="#ffffff"
					/>
					<path
						d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
						fill="#ffffff"
					/>
					<path
						d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
						fill="#ffffff"
					/>
				</svg>
				Sign in with Google
			</button>

			<!-- Divider -->
			<div class="mt-6 flex items-center gap-3">
				<div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
				<span class="text-xs text-surface-400 dark:text-surface-500">or</span>
				<div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
			</div>

			<!-- Email/Password form -->
			<form onsubmit={signInWithEmail} class="mt-6 space-y-3">
				<input
					type="email"
					bind:value={email}
					placeholder="Email"
					aria-label="Email"
					class="w-full rounded-lg border border-surface-300 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder-surface-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-500"
				/>
				<input
					type="password"
					bind:value={password}
					placeholder="Password"
					aria-label="Password"
					class="w-full rounded-lg border border-surface-300 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder-surface-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-500"
				/>
				<button
					type="submit"
					class="w-full cursor-pointer rounded-lg bg-surface-200 px-6 py-2.5 text-sm font-semibold text-surface-700 transition-colors hover:bg-surface-300 focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 focus:outline-none dark:bg-surface-700 dark:text-surface-200 dark:hover:bg-surface-600 dark:focus:ring-offset-surface-900"
				>
					Sign in with email
				</button>
			</form>

			<!-- Error Display -->
			{#if error}
				<p class="mt-4 text-center text-sm text-danger-500 dark:text-danger-400">
					{error}
				</p>
			{/if}
		</div>

		<!-- Footer -->
		<p class="mt-6 text-center text-xs text-surface-400 dark:text-surface-600">
			Built for musicians
		</p>
	</div>
</div>
