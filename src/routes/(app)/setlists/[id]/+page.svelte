<script lang="ts">
	import SetlistBuilder from '#lib/components/setlists/SetlistBuilder.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>{data.setlist.name} · Setlist</title>
</svelte:head>

<SetlistBuilder {data} />
