<script lang="ts">
	import { page } from '$app/state';
	import StageCard from '#lib/components/landing/StageCard.svelte';

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

<svelte:head>
	<title>Update password · Setlist</title>
</svelte:head>

<StageCard title="Set a new password">
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
				class="focus-live w-full rounded-lg border border-surface-600 bg-surface-800 px-4 py-2.5 text-sm text-surface-100 placeholder-surface-300"
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
		<p class="text-sm text-surface-300">This password reset link is invalid or has expired.</p>
		<a
			href="/auth"
			class="focus-live mt-4 inline-block rounded-md text-sm font-semibold text-accent-300 hover:text-accent-200"
		>
			Request a new one
		</a>
	{/if}

	{#if error}
		<p class="mt-4 text-center text-sm text-danger-300">
			{error}
		</p>
	{/if}
</StageCard>
