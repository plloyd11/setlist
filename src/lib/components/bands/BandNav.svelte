<script lang="ts">
	import { page } from '$app/stores';

	interface Props {
		bandId: string;
	}

	let { bandId }: Props = $props();

	const tabs = $derived([
		{ href: `/bands/${bandId}`, label: 'Dashboard', exact: true },
		{ href: `/bands/${bandId}/songs`, label: 'Songs', exact: false },
		{ href: `/bands/${bandId}/setlists`, label: 'Setlists', exact: false },
		{ href: `/bands/${bandId}/members`, label: 'Members', exact: false }
	]);

	function isActive(pathname: string, href: string, exact: boolean): boolean {
		if (exact) return pathname === href;
		return pathname.startsWith(href);
	}
</script>

<nav class="flex border-b border-stone-200 px-6 dark:border-stone-700">
	{#each tabs as tab}
		<a
			href={tab.href}
			class="border-b-2 px-4 py-2.5 text-sm font-medium transition-colors
				{isActive($page.url.pathname, tab.href, tab.exact)
				? 'border-amber-500 text-amber-600 dark:text-amber-400'
				: 'border-transparent text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200'}"
		>
			{tab.label}
		</a>
	{/each}
</nav>
