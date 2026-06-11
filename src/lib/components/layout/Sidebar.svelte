<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import gsap from 'gsap';
	import ThemeToggle from './ThemeToggle.svelte';
	import {
		sidebar,
		initSidebar,
		setSidebarMode,
		type SidebarMode
	} from '$lib/stores/sidebar.svelte';

	interface Props {
		user: { email?: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null;
	}

	let { user }: Props = $props();

	const navItems = [
		{
			href: '/dashboard',
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
			href: '/bands',
			label: 'Bands',
			icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
		},
		{
			href: '/settings',
			label: 'Settings',
			icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
		}
	];

	function isActive(pathname: string, href: string): boolean {
		if (href === '/dashboard') return pathname === '/dashboard';
		return pathname.startsWith(href);
	}

	// Rail geometry: collapsed matches the w-14 spacer; expanded matches the 14rem nav spec
	const RAIL_WIDTH = 56;
	const EXPANDED_WIDTH = 224;

	let panel: HTMLElement;
	let tl: gsap.core.Timeline | null = null;
	let labels: NodeListOf<Element>;

	onMount(() => {
		initSidebar();
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		labels = panel.querySelectorAll('.nav-label');

		gsap.set(labels, { opacity: 0, x: -6 });

		tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out', overwrite: 'auto' } });
		tl.fromTo(
			panel,
			{ width: RAIL_WIDTH, boxShadow: '0 0 0 rgba(0,0,0,0)' },
			{
				width: EXPANDED_WIDTH,
				boxShadow: '0 4px 16px rgba(0,0,0,0.3), 0 2px 6px rgba(0,0,0,0.2)',
				duration: reduced ? 0 : 0.25
			},
			0
		).to(
			labels,
			{ opacity: 1, x: 0, duration: reduced ? 0 : 0.15, stagger: reduced ? 0 : 0.02 },
			reduced ? 0 : 0.06
		);

		return () => {
			tl?.kill();
			tl = null;
		};
	});

	// Pinned modes bypass the hover timeline and set the resting state directly
	$effect(() => {
		const mode = sidebar.mode;
		if (!panel || !tl) return;
		tl.pause(0);
		if (mode === 'expanded') {
			gsap.set(panel, { width: EXPANDED_WIDTH, boxShadow: '0 0 0 rgba(0,0,0,0)' });
			gsap.set(labels, { opacity: 1, x: 0 });
		} else {
			gsap.set(panel, { width: RAIL_WIDTH, boxShadow: '0 0 0 rgba(0,0,0,0)' });
			gsap.set(labels, { opacity: 0, x: -6 });
		}
	});

	function expand() {
		if (sidebar.mode !== 'hover') return;
		tl?.play();
	}

	function collapse() {
		if (sidebar.mode !== 'hover' || menuOpen) return;
		tl?.reverse();
	}

	function handleFocusOut(event: FocusEvent) {
		if (!panel.contains(event.relatedTarget as Node | null)) collapse();
	}

	// --- Sidebar control menu ---
	let menuOpen = $state(false);
	let menuEl = $state<HTMLElement | null>(null);
	let triggerEl: HTMLElement;

	const modeOptions: { value: SidebarMode; label: string }[] = [
		{ value: 'expanded', label: 'Expanded' },
		{ value: 'collapsed', label: 'Collapsed' },
		{ value: 'hover', label: 'Expand on hover' }
	];

	function selectMode(mode: SidebarMode) {
		setSidebarMode(mode);
		menuOpen = false;
	}

	function closeMenu() {
		if (!menuOpen) return;
		menuOpen = false;
		// In hover mode, retract unless the pointer is still over the panel
		if (sidebar.mode === 'hover' && !panel.matches(':hover')) tl?.reverse();
	}

	function handleWindowClick(event: MouseEvent) {
		if (!menuOpen) return;
		const target = event.target as Node;
		if (menuEl?.contains(target) || triggerEl.contains(target)) return;
		closeMenu();
	}
</script>

<svelte:window onclick={handleWindowClick} onkeydown={(e) => e.key === 'Escape' && closeMenu()} />

<!-- Spacer keeps the rail's footprint in the flex layout; the panel overlays whatever sits to its
right when hover-expanded. In pinned-expanded mode the spacer widens so content is pushed instead. -->
<aside class="relative hidden shrink-0 md:block {sidebar.mode === 'expanded' ? 'w-56' : 'w-14'}">
	<div
		bind:this={panel}
		role="navigation"
		aria-label="Main"
		class="absolute inset-y-0 left-0 z-40 flex w-14 flex-col overflow-hidden border-r border-surface-200 bg-surface-50 dark:border-surface-800 dark:bg-surface-900"
		onmouseenter={expand}
		onmouseleave={collapse}
		onfocusin={expand}
		onfocusout={handleFocusOut}
	>
		<!-- App branding -->
		<div class="flex h-16 shrink-0 items-center px-2">
			<a
				href="/dashboard"
				class="focus-live flex items-center rounded-lg text-accent-500 dark:text-accent-hot"
			>
				<span class="flex h-10 w-10 shrink-0 items-center justify-center">
					<!-- list-music glyph: the setlist mark -->
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="22"
						height="22"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M21 15V6" />
						<path d="M18.5 18a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
						<path d="M12 12H3" />
						<path d="M16 6H3" />
						<path d="M12 18H3" />
					</svg>
				</span>
				<span class="nav-label font-display text-2xl whitespace-nowrap">Setlist</span>
			</a>
		</div>

		<!-- Navigation -->
		<nav class="flex flex-1 flex-col gap-1 px-2 py-2">
			{#each navItems as item}
				<a
					href={item.href}
					title={item.label}
					class="focus-live flex h-10 items-center rounded-lg text-sm transition-colors
						{isActive($page.url.pathname, item.href)
						? 'bg-surface-200/70 font-semibold text-surface-950 dark:bg-surface-800 dark:text-surface-50'
						: 'font-medium text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800'}"
				>
					<span class="flex h-10 w-10 shrink-0 items-center justify-center">
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
							<path d={item.icon} />
						</svg>
					</span>
					<span class="nav-label whitespace-nowrap">{item.label}</span>
				</a>
			{/each}
		</nav>

		<!-- Bottom section: user info + theme toggle -->
		<div class="shrink-0 border-t border-surface-200 px-2 py-2 dark:border-surface-800">
			{#if user}
				<div class="flex h-10 items-center">
					<span class="flex h-10 w-10 shrink-0 items-center justify-center">
						{#if user.user_metadata?.avatar_url}
							<img src={user.user_metadata.avatar_url} alt="" class="h-6 w-6 rounded-full" />
						{:else}
							<span
								class="flex h-6 w-6 items-center justify-center rounded-full bg-surface-200 text-xs font-semibold text-surface-600 dark:bg-surface-800 dark:text-surface-300"
							>
								{(user.user_metadata?.full_name || user.email || '?').charAt(0).toUpperCase()}
							</span>
						{/if}
					</span>
					<span
						class="nav-label min-w-0 flex-1 truncate text-xs text-surface-500 dark:text-surface-300"
					>
						{user.user_metadata?.full_name || user.email}
					</span>
				</div>
			{/if}
			<ThemeToggle showLabel />
			<button
				bind:this={triggerEl}
				onclick={() => (menuOpen = !menuOpen)}
				aria-haspopup="menu"
				aria-expanded={menuOpen}
				title="Sidebar control"
				class="focus-live flex h-10 w-full items-center rounded-lg text-sm font-medium text-surface-600 transition-colors hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
			>
				<span class="flex h-10 w-10 shrink-0 items-center justify-center">
					<!-- panel-left glyph -->
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
						<rect width="18" height="18" x="3" y="3" rx="2" />
						<path d="M9 3v18" />
					</svg>
				</span>
				<span class="nav-label whitespace-nowrap">Sidebar control</span>
			</button>
		</div>
	</div>

	<!-- Sidebar control popup: lives outside the overflow-hidden panel so it can
	overhang the collapsed rail -->
	{#if menuOpen}
		<div
			bind:this={menuEl}
			role="menu"
			aria-label="Sidebar control"
			class="absolute bottom-12 left-2 z-50 w-48 rounded-xl border border-surface-200 bg-surface-50 py-1.5 shadow-lg dark:border-surface-700 dark:bg-surface-800"
		>
			<p class="px-3 py-1.5 text-xs font-medium text-surface-500 dark:text-surface-300">
				Sidebar control
			</p>
			<div class="my-1 border-t border-surface-200 dark:border-surface-700"></div>
			{#each modeOptions as opt (opt.value)}
				<button
					role="menuitemradio"
					aria-checked={sidebar.mode === opt.value}
					onclick={() => selectMode(opt.value)}
					class="focus-live flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-100 dark:hover:bg-surface-700
						{sidebar.mode === opt.value
						? 'font-medium text-surface-900 dark:text-surface-100'
						: 'text-surface-600 dark:text-surface-300'}"
				>
					<span class="flex h-4 w-4 shrink-0 items-center justify-center">
						{#if sidebar.mode === opt.value}
							<span class="h-1.5 w-1.5 rounded-full bg-current"></span>
						{/if}
					</span>
					{opt.label}
				</button>
			{/each}
		</div>
	{/if}
</aside>
