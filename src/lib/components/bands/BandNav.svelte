<script lang="ts">
	import { page } from '$app/stores';
	import BandLogo from './BandLogo.svelte';

	interface Props {
		band: { id: string; name: string; logo_url: string | null; logo_dark_url: string | null };
	}

	let { band }: Props = $props();

	const tabs = $derived([
		{ href: `/bands/${band.id}`, label: 'Dashboard', exact: true },
		{ href: `/bands/${band.id}/songs`, label: 'Songs', exact: false },
		{ href: `/bands/${band.id}/setlists`, label: 'Setlists', exact: false },
		{ href: `/bands/${band.id}/demos`, label: 'Demos', exact: false },
		{ href: `/bands/${band.id}/members`, label: 'Members', exact: false },
		{ href: `/bands/${band.id}/settings`, label: 'Settings', exact: false }
	]);

	function isActive(pathname: string, href: string, exact: boolean): boolean {
		if (exact) return pathname === href;
		return pathname.startsWith(href);
	}
</script>

<!-- Desktop: secondary sidebar to the right of the icon rail -->
<aside
	class="hidden w-56 shrink-0 flex-col border-r border-surface-200 bg-surface-50 md:flex dark:border-surface-800 dark:bg-surface-900"
>
	<div
		class="flex h-16 shrink-0 items-center gap-3 border-b border-surface-200 px-4 dark:border-surface-800"
	>
		{#if band.logo_url || band.logo_dark_url}
			<BandLogo logoUrl={band.logo_url} logoDarkUrl={band.logo_dark_url} name={band.name} />
		{/if}
		<h1 class="truncate font-display text-lg text-surface-900 dark:text-surface-100">
			{band.name}
		</h1>
	</div>

	<nav class="flex-1 space-y-1 overflow-y-auto px-3 py-3">
		{#each tabs as tab}
			<a
				href={tab.href}
				class="focus-live flex items-center rounded-lg px-3 py-2 text-sm transition-colors
					{isActive($page.url.pathname, tab.href, tab.exact)
					? 'bg-surface-200/70 font-semibold text-surface-950 dark:bg-surface-800 dark:text-surface-50'
					: 'font-medium text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800'}"
			>
				{tab.label}
			</a>
		{/each}
	</nav>
</aside>

<!-- Mobile: band header + horizontal tabs -->
<div class="md:hidden">
	<div
		class="flex items-center gap-3 border-b border-surface-200 px-6 py-4 dark:border-surface-700"
	>
		{#if band.logo_url || band.logo_dark_url}
			<BandLogo logoUrl={band.logo_url} logoDarkUrl={band.logo_dark_url} name={band.name} />
		{/if}
		<h1 class="font-display text-2xl text-surface-900 dark:text-surface-100">
			{band.name}
		</h1>
	</div>
	<nav class="flex overflow-x-auto border-b border-surface-200 px-6 dark:border-surface-700">
		{#each tabs as tab}
			<a
				href={tab.href}
				class="border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors
					{isActive($page.url.pathname, tab.href, tab.exact)
					? 'border-accent-500 text-accent-600 dark:text-accent-400'
					: 'border-transparent text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-200'}"
			>
				{tab.label}
			</a>
		{/each}
	</nav>
</div>
