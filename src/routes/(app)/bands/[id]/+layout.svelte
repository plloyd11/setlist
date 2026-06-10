<script lang="ts">
	import BandNav from '$lib/components/bands/BandNav.svelte';

	let { data, children } = $props();
</script>

<div class="flex h-full flex-col md:flex-row">
	<!-- Band sub-navigation: left panel on desktop, header + tabs on mobile -->
	<BandNav band={data.band} />

	<!-- Tab content -->
	<div class="flex-1 overflow-y-auto">
		{@render children()}
	</div>
</div>
