<script lang="ts">
	import { page } from '$app/state';

	let password = $state('');
	let error = $state('');
	let submitting = $state(false);

	const updatePassword = async (e: Event) => {
		e.preventDefault();
		error = '';
		submitting = true;
		try {
			const { error: authError } = await page.data.supabase.auth.updateUser({ password });
			if (authError) {
				error = authError.message;
				return;
			}
			window.location.href = '/dashboard';
		} finally {
			submitting = false;
		}
	};
</script>

<div class="flex min-h-screen items-center justify-center bg-surface-50 dark:bg-surface-950">
	<div class="w-full max-w-sm px-6">
		<div
			class="rounded-2xl bg-surface-50 p-8 shadow-lg dark:bg-surface-900 dark:shadow-surface-900/50"
		>
			<div class="mb-8 text-center">
				<h1 class="text-4xl font-bold tracking-tight text-accent-500">Setlist</h1>
				<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">Set a new password</p>
			</div>

			{#if page.data.session}
				<form onsubmit={updatePassword} class="space-y-3">
					<input
						type="password"
						bind:value={password}
						required
						minlength={6}
						autocomplete="new-password"
						placeholder="New password"
						aria-label="New password"
						class="focus-live w-full rounded-lg border border-surface-300 bg-surface-50 px-4 py-2.5 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
					/>
					<button
						type="submit"
						disabled={submitting}
						class="focus-live w-full cursor-pointer rounded-lg bg-accent-500 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-600 disabled:cursor-default disabled:opacity-60"
					>
						Update password
					</button>
				</form>
			{:else}
				<p class="text-center text-sm text-surface-500 dark:text-surface-300">
					This password reset link is invalid or has expired.
				</p>
				<a
					href="/auth"
					class="focus-live mt-4 block text-center text-sm font-semibold text-accent-500 hover:text-accent-600"
				>
					Request a new one
				</a>
			{/if}

			{#if error}
				<p class="mt-4 text-center text-sm text-danger-500 dark:text-danger-400">
					{error}
				</p>
			{/if}
		</div>
	</div>
</div>
