<script lang="ts">
	import { enhance } from '$app/forms';
	import LogoUpload from '$lib/components/ui/LogoUpload.svelte';

	let { data } = $props();

	let bandName = $state('');
	let nameSaved = $state(false);
	let confirmDelete = $state(false);
	let deleting = $state(false);

	// Sync band name only when the SERVER value actually changes — an
	// invalidateAll elsewhere gives `data` a new reference with the same
	// values, and unconditionally syncing would wipe in-progress typing.
	let lastServerBandName: string | undefined;
	$effect(() => {
		const serverName = data.band?.name ?? '';
		if (serverName !== lastServerBandName) {
			lastServerBandName = serverName;
			bandName = serverName;
		}
	});
</script>

<div class="mx-auto max-w-2xl p-6 md:p-8">
	<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100">Band Settings</h1>

	<div class="mt-8 space-y-8">
		<!-- Band Name -->
		<section>
			<h2
				class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-500"
			>
				General
			</h2>
			<div
				class="mt-3 space-y-4 rounded-xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-900"
			>
				{#if data.isOwner}
					<form
						method="POST"
						action="?/updateBand"
						use:enhance={() => {
							return async ({ update }) => {
								await update();
								nameSaved = true;
								setTimeout(() => (nameSaved = false), 2000);
							};
						}}
					>
						<label
							class="block text-sm font-medium text-surface-700 dark:text-surface-300"
							for="band_name"
						>
							Band name
						</label>
						<div class="mt-2 flex gap-2">
							<input
								type="text"
								id="band_name"
								name="name"
								bind:value={bandName}
								placeholder="Band name"
								class="flex-1 rounded-lg border border-surface-300 bg-transparent px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:text-surface-100 dark:placeholder-surface-500"
							/>
							<button
								type="submit"
								class="rounded-lg bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 dark:bg-accent-600 dark:hover:bg-accent-500"
							>
								{nameSaved ? 'Saved!' : 'Save'}
							</button>
						</div>
					</form>
				{:else}
					<div>
						<p class="text-sm font-medium text-surface-700 dark:text-surface-300">Band name</p>
						<p class="mt-1 text-sm text-surface-900 dark:text-surface-100">{data.band?.name}</p>
					</div>
				{/if}
			</div>
		</section>

		<!-- Logo -->
		<section>
			<h2
				class="text-sm font-semibold tracking-wider text-surface-400 uppercase dark:text-surface-500"
			>
				Logo
			</h2>
			<div
				class="mt-3 rounded-xl border border-surface-200 bg-surface-50 p-4 dark:border-surface-800 dark:bg-surface-900"
			>
				{#if data.isOwner}
					<LogoUpload
						currentLogoUrl={data.band?.logo_url ?? null}
						userId={data.band?.id ?? ''}
						table="bands"
						storagePath={`bands/${data.band?.id}/logo.{ext}`}
					/>
				{:else if data.band?.logo_url}
					<div class="flex items-center justify-center p-4">
						<img src={data.band.logo_url} alt="Band logo" class="max-h-24 w-auto rounded" />
					</div>
				{:else}
					<p class="text-sm text-surface-400 dark:text-surface-500">No logo uploaded.</p>
				{/if}
			</div>
		</section>

		<!-- Danger Zone (owner only) -->
		{#if data.isOwner}
			<section>
				<h2 class="text-sm font-semibold tracking-wider text-danger-500 uppercase">Danger Zone</h2>
				<div
					class="mt-3 rounded-xl border border-danger-200 bg-surface-50 p-4 dark:border-danger-900 dark:bg-surface-900"
				>
					{#if !confirmDelete}
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-surface-700 dark:text-surface-300">
									Delete band
								</p>
								<p class="text-xs text-surface-400 dark:text-surface-500">
									Permanently delete this band and all its data.
								</p>
							</div>
							<button
								onclick={() => (confirmDelete = true)}
								class="rounded-lg border border-danger-300 px-4 py-2 text-sm font-medium text-danger-600 transition-colors hover:bg-danger-50 dark:border-danger-800 dark:text-danger-400 dark:hover:bg-danger-900/30"
							>
								Delete band
							</button>
						</div>
					{:else}
						<div class="space-y-3">
							<p class="text-sm font-medium text-danger-600 dark:text-danger-400">
								Are you sure? This will permanently delete <strong>{data.band?.name}</strong> and all
								its songs, setlists, and members. This cannot be undone.
							</p>
							<div class="flex gap-2">
								<form
									method="POST"
									action="?/deleteBand"
									use:enhance={() => {
										deleting = true;
										return async ({ update }) => {
											await update();
											deleting = false;
										};
									}}
								>
									<button
										type="submit"
										disabled={deleting}
										class="rounded-lg bg-danger-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger-700 disabled:opacity-50"
									>
										{deleting ? 'Deleting...' : 'Yes, delete band'}
									</button>
								</form>
								<button
									onclick={() => (confirmDelete = false)}
									class="rounded-lg bg-surface-200 px-4 py-2 text-sm font-medium text-surface-700 transition-colors hover:bg-surface-300 dark:bg-surface-700 dark:text-surface-300 dark:hover:bg-surface-600"
								>
									Cancel
								</button>
							</div>
						</div>
					{/if}
				</div>
			</section>
		{/if}
	</div>
</div>
