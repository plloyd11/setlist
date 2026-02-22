<script lang="ts">
	import { invalidate, goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte';
	import LogoUpload from '$lib/components/ui/LogoUpload.svelte';

	let { data } = $props();
	let signingOut = $state(false);
	let displayName = $state(data.profile?.display_name ?? '');
	let profileSaved = $state(false);

	// Sync display name when data changes
	$effect(() => {
		displayName = data.profile?.display_name ?? '';
	});

	async function handleSignOut() {
		signingOut = true;
		await data.supabase.auth.signOut();
		await invalidate('supabase:auth');
		goto('/auth');
	}
</script>

<div class="mx-auto max-w-2xl p-6 md:p-8">
	<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100">Settings</h1>

	<div class="mt-8 space-y-8">
		<!-- Profile section -->
		<section>
			<h2 class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-500">
				Profile
			</h2>
			<div
				class="mt-3 space-y-4 rounded-xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-900"
			>
				<!-- Display name -->
				<form
					method="POST"
					action="?/updateProfile"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
							profileSaved = true;
							setTimeout(() => (profileSaved = false), 2000);
						};
					}}
				>
					<label
						class="block text-sm font-medium text-surface-700 dark:text-surface-300"
						for="display_name"
					>
						Display name
					</label>
					<p class="mt-0.5 text-xs text-surface-400 dark:text-surface-500">
						Shown on shared setlists (e.g. your band name)
					</p>
					<div class="mt-2 flex gap-2">
						<input
							type="text"
							id="display_name"
							name="display_name"
							bind:value={displayName}
							placeholder="Your name or band name"
							class="flex-1 rounded-lg border border-surface-300 bg-transparent px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:text-surface-100 dark:placeholder-surface-500"
						/>
						<button
							type="submit"
							class="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 dark:bg-accent-600 dark:hover:bg-accent-500"
						>
							{profileSaved ? 'Saved!' : 'Save'}
						</button>
					</div>
				</form>

				<!-- Logo upload -->
				<div class="border-t border-surface-200 pt-4 dark:border-surface-700">
					<LogoUpload
						currentLogoUrl={data.profile?.logo_url ?? null}
						userId={data.user?.id ?? ''}
					/>
				</div>
			</div>
		</section>

		<!-- Theme section -->
		<section>
			<h2 class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-500">
				Appearance
			</h2>
			<div
				class="mt-3 flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-900"
			>
				<span class="text-sm font-medium text-surface-700 dark:text-surface-300">Dark mode</span>
				<ThemeToggle />
			</div>
		</section>

		<!-- Account section -->
		<section>
			<h2 class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-500">
				Account
			</h2>
			<div class="mt-3 space-y-3">
				{#if data.user}
					<div
						class="rounded-xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-900"
					>
						<div class="flex items-center gap-3">
							{#if data.user.user_metadata?.avatar_url}
								<img
									src={data.user.user_metadata.avatar_url}
									alt=""
									class="h-10 w-10 rounded-full"
								/>
							{/if}
							<div>
								{#if data.user.user_metadata?.full_name}
									<p class="text-sm font-medium text-surface-900 dark:text-surface-100">
										{data.user.user_metadata.full_name}
									</p>
								{/if}
								<p class="text-sm text-surface-500 dark:text-surface-400">
									{data.user.email}
								</p>
							</div>
						</div>
					</div>
				{/if}

				<button
					onclick={handleSignOut}
					disabled={signingOut}
					class="w-full rounded-xl bg-surface-200 px-4 py-3 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-300 disabled:opacity-50 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
				>
					{signingOut ? 'Signing out...' : 'Sign out'}
				</button>
			</div>
		</section>
	</div>
</div>
