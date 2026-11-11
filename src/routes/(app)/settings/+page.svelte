<script lang="ts">
	import { invalidate, goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import ThemeToggle from '#lib/components/layout/ThemeToggle.svelte';
	import LogoUpload from '#lib/components/ui/LogoUpload.svelte';
	import { secondaryButton } from '#lib/components/practice/practiceStyles.js';
	import { startTour } from '#lib/stores/tour.svelte.js';

	let { data } = $props();
	let signingOut = $state(false);
	let displayName = $state('');
	let profileSaved = $state(false);

	// Sync display name only when the SERVER value actually changes — an
	// refreshAll elsewhere gives `data` a new reference with the same
	// values, and unconditionally syncing would wipe in-progress typing.
	let lastServerDisplayName: string | undefined;
	$effect(() => {
		const serverName = data.profile?.display_name ?? '';
		if (serverName !== lastServerDisplayName) {
			lastServerDisplayName = serverName;
			displayName = serverName;
		}
	});

	async function handleSignOut() {
		signingOut = true;
		await data.supabase.auth.signOut();
		await invalidate('supabase:auth');
		goto('/auth');
	}
</script>

<svelte:head>
	<title>Settings · Setlist</title>
</svelte:head>

<div class="page-frame">
	<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100">Settings</h1>

	<div class="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-2 lg:items-start">
		<!-- Profile section -->
		<section>
			<h2 class="font-display text-lg text-surface-900 dark:text-surface-100">Profile</h2>
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
					<p class="mt-0.5 text-xs text-surface-500 dark:text-surface-300">
						How your band sees you, and the name on your shared setlists
					</p>
					<div class="mt-2 flex gap-2">
						<input
							type="text"
							id="display_name"
							name="display_name"
							bind:value={displayName}
							placeholder="Your name or band name"
							class="focus-live flex-1 rounded-lg border border-surface-300 bg-transparent px-3 py-2 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:text-surface-100 dark:placeholder-surface-300"
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

		<div class="min-w-0 space-y-8">
			<!-- Theme section -->
			<section>
				<h2 class="font-display text-lg text-surface-900 dark:text-surface-100">Appearance</h2>
				<div
					class="mt-3 flex items-center justify-between rounded-xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-900"
				>
					<span class="text-sm font-medium text-surface-700 dark:text-surface-300">Dark mode</span>
					<ThemeToggle variant="switch" />
				</div>
			</section>

			<!-- Account section -->
			<section>
				<h2 class="font-display text-lg text-surface-900 dark:text-surface-100">Account</h2>
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
									<p class="text-sm text-surface-500 dark:text-surface-300">
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

	<div class="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
		<p class="text-sm text-surface-500 dark:text-surface-300">
			New here or need a refresher? Read the
			<a
				href="/help"
				class="focus-live rounded font-medium text-accent-600 hover:underline dark:text-accent-300"
				>getting started guide</a
			>, or walk through the app again.
		</p>
		<button type="button" class={secondaryButton} onclick={startTour}>Take the tour</button>
	</div>
</div>
