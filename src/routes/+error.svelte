<script lang="ts">
	import { page } from '$app/state';

	let notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Not found' : 'Something went wrong'} · Setlist</title>
</svelte:head>

<main
	class="flex min-h-dvh flex-col items-center justify-center bg-surface-50 px-6 text-center dark:bg-surface-950"
>
	<p class="font-display text-5xl font-bold text-accent-600 dark:text-accent-hot">
		{page.status}
	</p>
	<h1 class="mt-4 font-display text-2xl font-bold text-surface-900 dark:text-surface-100">
		{notFound ? "This one's not on the set" : 'Something went wrong'}
	</h1>
	<p class="mt-2 max-w-sm text-sm text-surface-500 dark:text-surface-300">
		{notFound
			? "Not found. This page doesn't exist, or it isn't shared with you."
			: "That's on us, not you. Try again in a moment."}
	</p>
	<div class="mt-6 flex items-center gap-2">
		{#if !notFound}
			<button
				type="button"
				onclick={() => location.reload()}
				class="focus-live min-h-11 rounded-lg bg-accent-500 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-600"
			>
				Try again
			</button>
		{/if}
		<a
			href="/"
			class="focus-live inline-flex min-h-11 items-center rounded-lg px-5 text-sm font-semibold transition-colors {notFound
				? 'bg-accent-500 text-white shadow-sm hover:bg-accent-600'
				: 'text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800'}"
		>
			Back to Setlist
		</a>
	</div>
</main>
