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

<div class="page-frame">
	<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100">Practice</h1>
	<!-- The divider is an inset shadow, so the tabs' underlines can sit on it from inside.
	     Overlapping a border with a negative margin overflows this scroller by 1px, and
	     overflow-x: auto turns vertical scrolling on too: a stray scrollbar. -->
	<nav
		aria-label="Practice"
		class="mt-4 flex overflow-x-auto shadow-[inset_0_-1px_0_var(--color-surface-200)] dark:shadow-[inset_0_-1px_0_var(--color-surface-700)]"
	>
		{#each tabs as tab (tab.href)}
			{@const active =
				tab.href === '/practice'
					? page.url.pathname === '/practice'
					: page.url.pathname.startsWith(tab.href)}
			<a
				href={tab.href}
				aria-current={active ? 'page' : undefined}
				class="focus-live flex min-h-11 min-w-11 shrink-0 items-center justify-center border-b-2 px-1.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 min-[360px]:px-2.5 md:px-3 {active
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
