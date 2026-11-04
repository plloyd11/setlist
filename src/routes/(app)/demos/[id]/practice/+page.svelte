<script lang="ts">
	import ShedScreen from '#lib/components/practice/ShedScreen.svelte';

	let { data } = $props();

	let demoHref = $derived(`/bands/${data.track.band_id}/demos/${data.track.id}`);
</script>

<svelte:head>
	<title>{data.track.title} · Practice</title>
</svelte:head>

{#snippet noAudio()}
	<p class="text-sm text-surface-500 dark:text-surface-300">This demo's audio isn't available.</p>
{/snippet}

{#key data.track.id}
	<!-- Practice history has no link to a demo yet, so time logs under the title alone -->
	<ShedScreen
		item={{ kind: 'song', refId: null, label: data.track.title }}
		prefsKey={data.track.id}
		versioned
		title={data.track.title}
		lengthSeconds={data.variants[0].duration_seconds ?? 0}
		variants={data.variants}
		charts={[]}
		notes={data.track.description}
		backHref={data.backHref}
		emptyAudio={noAudio}
		sideLabel="Demo"
	>
		{#snippet side()}
			<a
				href={demoHref}
				class="focus-live flex min-h-11 items-center justify-center rounded-lg border border-surface-300 px-4 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800"
			>
				Comments and versions
			</a>
		{/snippet}
	</ShedScreen>
{/key}
