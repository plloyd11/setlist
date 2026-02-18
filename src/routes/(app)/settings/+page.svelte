<script lang="ts">
	import { invalidate, goto } from '$app/navigation';
	import ThemeToggle from '$lib/components/layout/ThemeToggle.svelte';

	let { data } = $props();
	let signingOut = $state(false);

	async function handleSignOut() {
		signingOut = true;
		await data.supabase.auth.signOut();
		await invalidate('supabase:auth');
		goto('/auth');
	}
</script>

<div class="p-6 md:p-8">
	<h1 class="font-display text-3xl text-stone-900 dark:text-stone-100">Settings</h1>

	<div class="mt-8 space-y-8">
		<!-- Theme section -->
		<section>
			<h2 class="text-sm font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
				Appearance
			</h2>
			<div class="mt-3 flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
				<span class="text-sm font-medium text-stone-700 dark:text-stone-300">Dark mode</span>
				<ThemeToggle />
			</div>
		</section>

		<!-- Account section -->
		<section>
			<h2 class="text-sm font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
				Account
			</h2>
			<div class="mt-3 space-y-3">
				{#if data.user}
					<div class="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
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
									<p class="text-sm font-medium text-stone-900 dark:text-stone-100">
										{data.user.user_metadata.full_name}
									</p>
								{/if}
								<p class="text-sm text-stone-500 dark:text-stone-400">
									{data.user.email}
								</p>
							</div>
						</div>
					</div>
				{/if}

				<button
					onclick={handleSignOut}
					disabled={signingOut}
					class="w-full rounded-xl bg-stone-200 px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-300 disabled:opacity-50 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
				>
					{signingOut ? 'Signing out...' : 'Sign out'}
				</button>
			</div>
		</section>
	</div>
</div>
