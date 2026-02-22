<script lang="ts">
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import BottomNav from '$lib/components/layout/BottomNav.svelte';

	let { data, children } = $props();
</script>

<div class="flex h-screen bg-surface-50 dark:bg-surface-950">
	<Sidebar user={data.user} />
	<main class="flex-1 overflow-y-auto pb-16 md:pb-0">
		{@render children()}
	</main>
	<BottomNav />
</div>
