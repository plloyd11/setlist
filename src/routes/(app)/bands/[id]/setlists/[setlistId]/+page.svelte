<script lang="ts">
	import SetlistBuilder from '#lib/components/setlists/SetlistBuilder.svelte';

	let { data } = $props();
</script>

<SetlistBuilder {data} band />
