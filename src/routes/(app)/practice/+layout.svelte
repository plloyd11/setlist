<script lang="ts">
	import { page } from '$app/state';

	let { children } = $props();

	const tabs = [
		{ href: '/practice', label: 'Today' },
		{ href: '/practice/warm-up', label: 'Warm up' },
		{ href: '/practice/shed', label: 'Shed' },
		{ href: '/practice/techniques', label: 'Techniques' },
		{ href: '/practice/log', label: 'Log' }
	];
</script>

<div class="mx-auto w-full max-w-4xl p-4 md:p-8">
	<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100">Practice</h1>
	<nav
		aria-label="Practice"
		class="mt-4 flex gap-1 overflow-x-auto border-b border-surface-200 dark:border-surface-700"
	>
		{#each tabs as tab (tab.href)}
			{@const active =
				tab.href === '/practice'
					? page.url.pathname === '/practice'
					: page.url.pathname.startsWith(tab.href)}
			<a
				href={tab.href}
				aria-current={active ? 'page' : undefined}
				class="focus-live -mb-px flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap {active
					? 'border-accent-500 text-accent-700 dark:border-accent-400 dark:text-accent-300'
					: 'border-transparent text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100'}"
			>
				{tab.label}
			</a>
		{/each}
	</nav>
	<div class="mt-6">
		{@render children()}
	</div>
</div>
