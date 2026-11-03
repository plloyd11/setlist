<script lang="ts">
	import ShedScreen from '#lib/components/practice/ShedScreen.svelte';
	import SongStatus from '#lib/components/practice/SongStatus.svelte';
	import RunTimer from '#lib/components/practice/RunTimer.svelte';

	let { data } = $props();

	// Updated locally when a timed run is applied: reloading would re-sign the audio
	// and stop the player
	// svelte-ignore state_referenced_locally
	let lengthSeconds = $state(data.song.duration_seconds);
</script>

<svelte:head>
	<title>Shed: {data.song.title}</title>
</svelte:head>

{#snippet noAudio()}
	<div
		class="rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-6 text-center dark:border-surface-700 dark:bg-surface-900/50"
	>
		<p class="font-display text-lg text-surface-700 dark:text-surface-300">
			No rehearsal audio yet
		</p>
		<p class="mt-1 text-sm text-surface-500 dark:text-surface-300">
			Upload a mix from the song panel to play along, or shed it to the metronome.
		</p>
	</div>
{/snippet}

<ShedScreen
	item={{ kind: 'song', refId: data.song.id, label: data.song.title }}
	title={data.song.title}
	{lengthSeconds}
	variants={data.variants}
	charts={data.charts}
	notes={data.song.notes}
	backHref={data.backHref}
	emptyAudio={noAudio}
	sideLabel="Progress"
>
	{#snippet side(tracker)}
		<div class="flex flex-col gap-4">
			<SongStatus status={data.practice?.status ?? null} note={data.practice?.note ?? null} />
			<RunTimer
				{lengthSeconds}
				isShared={data.isShared}
				onrun={(seconds) => tracker?.setRun(seconds, 'stopwatch')}
				onapplied={(seconds, previous) => {
					lengthSeconds = seconds;
					tracker?.setLengthApplied(previous);
				}}
			/>
		</div>
	{/snippet}
</ShedScreen>
