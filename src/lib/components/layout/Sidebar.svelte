<script lang="ts">
	import { page } from '$app/stores';
	import ThemeToggle from './ThemeToggle.svelte';

	interface Props {
		user: { email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null;
	}

	let { user }: Props = $props();

	const navItems = [
		{
			href: '/',
			label: 'Home',
			icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
		},
		{
			href: '/songs',
			label: 'Songs',
			icon: 'M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z'
		},
		{
			href: '/setlists',
			label: 'Setlists',
			icon: 'M4 6h16M4 10h16M4 14h10M4 18h10'
		},
		{
			href: '/settings',
			label: 'Settings',
			icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
		}
	];

	function isActive(pathname: string, href: string): boolean {
		if (href === '/') return pathname === '/';
		return pathname.startsWith(href);
	}
</script>

<aside class="hidden md:flex md:w-56 md:flex-col border-r border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
	<!-- App branding -->
	<div class="flex h-16 items-center px-6">
		<a href="/" class="font-display text-2xl text-amber-500">Setlist</a>
	</div>

	<!-- Navigation -->
	<nav class="flex-1 space-y-1 px-3 py-2">
		{#each navItems as item}
			<a
				href={item.href}
				class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
					{isActive($page.url.pathname, item.href)
						? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
						: 'text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800'}"
			>
				<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d={item.icon} />
				</svg>
				{item.label}
			</a>
		{/each}
	</nav>

	<!-- Bottom section: user info + theme toggle -->
	<div class="border-t border-stone-200 px-3 py-3 dark:border-stone-800">
		{#if user}
			<div class="mb-2 flex items-center gap-2 px-3 py-1">
				{#if user.user_metadata?.avatar_url}
					<img src={user.user_metadata.avatar_url} alt="" class="h-6 w-6 rounded-full" />
				{/if}
				<span class="truncate text-xs text-stone-500 dark:text-stone-400">
					{user.user_metadata?.full_name || user.email}
				</span>
			</div>
		{/if}
		<ThemeToggle />
	</div>
</aside>
