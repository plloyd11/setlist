<script lang="ts">
	import SetlistBuilder from '#lib/components/setlists/SetlistBuilder.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.setlist.name} · {data.band.name}</title>
</svelte:head>

<SetlistBuilder {data} band />
