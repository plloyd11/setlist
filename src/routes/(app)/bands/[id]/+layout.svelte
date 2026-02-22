<script lang="ts">
	import BandNav from '$lib/components/bands/BandNav.svelte';

	let { data, children } = $props();

	let bandId = $derived(data.band.id);
</script>

<div class="flex h-full flex-col">
	<!-- Band header -->
	<div class="border-b border-stone-200 px-6 py-4 dark:border-stone-700">
		<div class="flex items-center gap-3">
			{#if data.band.logo_url}
				<img
					src={data.band.logo_url}
					alt="{data.band.name} logo"
					class="h-8 w-8 rounded-full object-cover"
				/>
			{/if}
			<h1 class="font-display text-2xl text-stone-900 dark:text-stone-100">
				{data.band.name}
			</h1>
		</div>
	</div>

	<!-- Sub-navigation tabs -->
	<BandNav {bandId} />

	<!-- Tab content -->
	<div class="flex-1 overflow-y-auto">
		{@render children()}
	</div>
</div>
