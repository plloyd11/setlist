<script lang="ts">
	import Sidebar from '#lib/components/layout/Sidebar.svelte';
	import BottomNav from '#lib/components/layout/BottomNav.svelte';
	import { page } from '$app/state';

	let { data, children } = $props();

	// A phone on a music stand needs every pixel; the shed screen has a Back link
	let immersive = $derived(
		page.route.id === '/(app)/songs/[id]/practice' ||
			page.route.id === '/(app)/demos/[id]/practice' ||
			page.route.id === '/(app)/exercises/[id]'
	);
</script>

<!-- app-shell is a print-CSS hook (see the print editor page) -->
<div class="app-shell flex h-dvh bg-surface-50 dark:bg-surface-950">
	<Sidebar user={data.user} />
	<main class="flex-1 overflow-y-auto {immersive ? '' : 'pb-16'} md:pb-0">
		{@render children()}
	</main>
	{#if !immersive}
		<BottomNav />
	{/if}
</div>
