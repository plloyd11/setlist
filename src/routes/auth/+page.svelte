<script lang="ts">
	import { page } from '$app/state';

	const errorMessages: Record<string, string> = {
		auth_exchange_failed: 'Sign in failed. Please try again.',
		confirm_failed: 'Email confirmation failed. The link may have expired — try signing up again.'
	};
	let error = $state(errorMessages[page.url.searchParams.get('error') ?? ''] ?? '');

	let email = $state('');
	let password = $state('');
	let mode = $state<'signin' | 'signup' | 'reset'>('signin');
	let confirmationSentTo = $state('');
	let submitting = $state(false);

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

	const submitEmailForm = async (e: Event) => {
		e.preventDefault();
		error = '';
		submitting = true;
		try {
			const next = safeRedirect(page.url.searchParams.get('redirect'));

			if (mode === 'reset') {
				const { error: authError } = await page.data.supabase.auth.resetPasswordForEmail(email, {
					redirectTo: `${window.location.origin}/auth/update-password`
				});
				if (authError) {
					error = authError.message;
					return;
				}
				confirmationSentTo = email;
				return;
			}

			if (mode === 'signup') {
				const { data, error: authError } = await page.data.supabase.auth.signUp({
					email,
					password,
					options: {
						emailRedirectTo: `${window.location.origin}${next}`
					}
				});
				if (authError) {
					error = authError.message;
					return;
				}
				if (data.session) {
					// Email confirmation is disabled on the project — signed in immediately
					window.location.href = next;
					return;
				}
				confirmationSentTo = email;
				return;
			}

			const { error: authError } = await page.data.supabase.auth.signInWithPassword({
				email,
				password
			});
			if (authError) {
				error = authError.message;
				return;
			}
			window.location.href = next;
		} finally {
			submitting = false;
		}
	};

	const setMode = (next: typeof mode) => {
		mode = next;
		error = '';
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
				<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">Build your perfect set</p>
			</div>

			<!-- Google Sign-In Button -->
			<button
				onclick={signInWithGoogle}
				class="focus-live flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg bg-accent-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-accent-600"
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
				<span class="text-xs text-surface-500 dark:text-surface-300">or</span>
				<div class="h-px flex-1 bg-surface-200 dark:bg-surface-700"></div>
			</div>

			<!-- Email/Password form -->
			{#if confirmationSentTo}
				<div class="mt-6 text-center">
					<p class="text-sm font-semibold text-surface-700 dark:text-surface-200">
						Check your email
					</p>
					<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
						{#if mode === 'reset'}
							If an account exists for <span class="font-medium">{confirmationSentTo}</span>, we
							sent it a password reset link.
						{:else}
							We sent a confirmation link to <span class="font-medium">{confirmationSentTo}</span>.
							Click it to finish creating your account.
						{/if}
					</p>
				</div>
			{:else}
				<form onsubmit={submitEmailForm} class="mt-6 space-y-3">
					<input
						type="email"
						bind:value={email}
						required
						autocomplete="email"
						placeholder="Email"
						aria-label="Email"
						class="focus-live w-full rounded-lg border border-surface-300 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
					/>
					{#if mode !== 'reset'}
						<input
							type="password"
							bind:value={password}
							required
							minlength={mode === 'signup' ? 6 : undefined}
							autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
							placeholder="Password"
							aria-label="Password"
							class="focus-live w-full rounded-lg border border-surface-300 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
						/>
					{/if}
					<button
						type="submit"
						disabled={submitting}
						class="focus-live w-full cursor-pointer rounded-lg bg-surface-200 px-6 py-2.5 text-sm font-semibold text-surface-700 transition-colors hover:bg-surface-300 disabled:cursor-default disabled:opacity-60 dark:bg-surface-700 dark:text-surface-200 dark:hover:bg-surface-600"
					>
						{mode === 'signup'
							? 'Create account'
							: mode === 'reset'
								? 'Send reset link'
								: 'Sign in with email'}
					</button>
				</form>

				{#if mode === 'signin'}
					<p class="mt-3 text-center">
						<button
							type="button"
							onclick={() => setMode('reset')}
							class="focus-live cursor-pointer text-xs text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100"
						>
							Forgot password?
						</button>
					</p>
				{/if}

				<!-- Mode toggle -->
				<p class="mt-4 text-center text-sm text-surface-500 dark:text-surface-300">
					{#if mode === 'signin'}
						Don't have an account?
					{:else if mode === 'signup'}
						Already have an account?
					{:else}
						Remember your password?
					{/if}
					<button
						type="button"
						onclick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
						class="focus-live cursor-pointer font-semibold text-accent-500 hover:text-accent-600"
					>
						{mode === 'signin' ? 'Sign up' : 'Sign in'}
					</button>
				</p>
			{/if}

			<!-- Error Display -->
			{#if error}
				<p class="mt-4 text-center text-sm text-danger-500 dark:text-danger-400">
					{error}
				</p>
			{/if}
		</div>

		<!-- Footer -->
		<p class="mt-6 text-center text-xs text-surface-500 dark:text-surface-600">
			Built for musicians
		</p>
	</div>
</div>
