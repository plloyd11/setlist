<script lang="ts">
	import BandCard from '$lib/components/bands/BandCard.svelte';
	import { enhance } from '$app/forms';

	let { data } = $props();

	let showCreateForm = $state(false);
	let newName = $state('');

	let hasBands = $derived(data.bands.length > 0);
	let bandCountLabel = $derived(data.bands.length === 1 ? '1 band' : `${data.bands.length} bands`);

	function toggleCreate() {
		showCreateForm = !showCreateForm;
		if (showCreateForm) {
			newName = '';
		}
	}
</script>

<div class="p-6 md:p-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-baseline gap-3">
			<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100">Bands</h1>
			{#if hasBands}
				<span class="text-sm text-surface-500 dark:text-surface-400">{bandCountLabel}</span>
			{/if}
		</div>
		<button
			onclick={toggleCreate}
			class="flex items-center justify-center rounded-lg bg-accent-500 p-2 text-white shadow-sm hover:bg-accent-600"
			aria-label="Create band"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="20"
				height="20"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M12 5v14M5 12h14" />
			</svg>
		</button>
	</div>

	<!-- Inline create form -->
	{#if showCreateForm}
		<form method="POST" action="?/create" class="mt-4 flex items-center gap-2" use:enhance>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				name="name"
				bind:value={newName}
				placeholder="Band name..."
				autofocus
				required
				class="flex-1 rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-surface-900 placeholder-surface-400 focus:border-neon-400 focus:ring-1 focus:ring-neon-400 focus:outline-none dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-500"
			/>
			<button
				type="submit"
				disabled={!newName.trim()}
				class="rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600 disabled:opacity-50 disabled:hover:bg-accent-500"
			>
				Create
			</button>
			<button
				type="button"
				onclick={toggleCreate}
				class="rounded-lg px-3 py-2 text-sm text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-300"
			>
				Cancel
			</button>
		</form>
	{/if}

	{#if hasBands}
		<!-- Card grid -->
		<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.bands as band (band.id)}
				<BandCard {band} />
			{/each}
		</div>
	{:else if !showCreateForm}
		<!-- Empty state -->
		<div
			class="mt-8 rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-12 text-center dark:border-surface-700 dark:bg-surface-900/50"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="mx-auto text-surface-300 dark:text-surface-600"
			>
				<path
					d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
				/>
			</svg>
			<p class="mt-4 font-display text-lg text-surface-700 dark:text-surface-300">No bands yet</p>
			<p class="mt-2 text-sm text-surface-500 dark:text-surface-400">
				Create your first band to collaborate with other musicians.
			</p>
			<button
				onclick={toggleCreate}
				class="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
			>
				Create your first band
			</button>
		</div>
	{/if}
</div>
