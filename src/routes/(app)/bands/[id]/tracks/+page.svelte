<script lang="ts">
	import { goto } from '$app/navigation';
	import TrackCard from '$lib/components/tracks/TrackCard.svelte';
	import TrackUploadForm from '$lib/components/tracks/TrackUploadForm.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';

	let { data } = $props();

	let bandId = $derived(data.band.id);
	let basePath = $derived(`/bands/${bandId}/tracks`);

	let showUploadForm = $state(false);
	let toast: Toast;

	let hasTracks = $derived(data.tracks.length > 0);
	let trackCountLabel = $derived(
		data.tracks.length === 1 ? '1 track' : `${data.tracks.length} tracks`
	);

	function handleUploaded(result: { trackId: string }) {
		showUploadForm = false;
		toast.show('Track uploaded', { variant: 'success' });
		goto(`${basePath}/${result.trackId}`);
	}
</script>

<div class="p-6 md:p-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-baseline gap-3">
			<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100">Tracks</h1>
			{#if hasTracks}
				<span class="text-sm text-surface-500 dark:text-surface-300">{trackCountLabel}</span>
			{/if}
		</div>
		<button
			onclick={() => (showUploadForm = !showUploadForm)}
			class="flex items-center justify-center rounded-lg bg-accent-500 p-2 text-white shadow-sm hover:bg-accent-600"
			aria-label="New track"
		>
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
				<path d="M12 5v14M5 12h14" />
			</svg>
		</button>
	</div>

	{#if showUploadForm}
		<div class="mt-4">
			<TrackUploadForm
				{bandId}
				supabase={data.supabase}
				onsuccess={handleUploaded}
				oncancel={() => (showUploadForm = false)}
			/>
		</div>
	{/if}

	{#if hasTracks}
		<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.tracks as track (track.id)}
				<TrackCard {track} {basePath} />
			{/each}
		</div>
	{:else if !showUploadForm}
		<!-- Empty state -->
		<div
			class="mt-8 rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-12 text-center dark:border-surface-700 dark:bg-surface-900/50"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="mx-auto text-surface-300 dark:text-surface-600"
			>
				<path
					d="M9 19V6l12-3v13M9 19c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3zm12-3c0 1.66-1.34 3-3 3s-3-1.34-3-3 1.34-3 3-3 3 1.34 3 3z"
				/>
			</svg>
			<p class="mt-4 font-display text-lg text-surface-700 dark:text-surface-300">No tracks yet</p>
			<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
				Share a demo with your band and get timestamped feedback.
			</p>
			<button
				onclick={() => (showUploadForm = true)}
				class="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-accent-600"
			>
				Upload your first track
			</button>
		</div>
	{/if}
</div>

<Toast bind:this={toast} />
