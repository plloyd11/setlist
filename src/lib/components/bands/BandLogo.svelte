<script lang="ts">
	let {
		logoUrl = null,
		logoDarkUrl = null,
		name,
		class: className = 'h-8 w-8 rounded-full object-cover',
		loading = undefined
	}: {
		logoUrl?: string | null;
		logoDarkUrl?: string | null;
		name: string;
		class?: string;
		loading?: 'lazy' | 'eager';
	} = $props();

	// The dark variant is drawn for light backgrounds, so it wins in light
	// mode; the main logo wins in dark mode. Either falls back to the other,
	// matching the print sheet's coalesce behavior.
	let lightModeSrc = $derived(logoDarkUrl ?? logoUrl);
	let darkModeSrc = $derived(logoUrl ?? logoDarkUrl);
</script>

{#if lightModeSrc && lightModeSrc === darkModeSrc}
	<img src={lightModeSrc} alt="{name} logo" class={className} {loading} />
{:else if lightModeSrc && darkModeSrc}
	<img src={lightModeSrc} alt="{name} logo" class="{className} dark:hidden" {loading} />
	<img src={darkModeSrc} alt="{name} logo" class="{className} hidden dark:block" {loading} />
{/if}
