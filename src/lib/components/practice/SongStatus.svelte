<script lang="ts">
	import { deserialize } from '$app/forms';
	import type { SongPracticeStatus } from '#lib/types/database.js';

	let {
		status: initialStatus,
		note: initialNote
	}: { status: SongPracticeStatus | null; note: string | null } = $props();

	const OPTIONS: { value: SongPracticeStatus; label: string }[] = [
		{ value: 'learning', label: 'Learning' },
		{ value: 'needs_work', label: 'Needs work' },
		{ value: 'solid', label: 'Solid' }
	];

	// svelte-ignore state_referenced_locally
	let status = $state(initialStatus);
	// svelte-ignore state_referenced_locally
	let note = $state(initialNote ?? '');
	let saveFailed = $state(false);

	// One save at a time: tapping a status and quickly typing a note sends two, and if
	// the first landed last it would wipe the note
	let queue: Promise<void> = Promise.resolve();

	// No page reload after saving: it would re-sign the audio and stop the player
	function save(next: SongPracticeStatus | null) {
		const previous = status;
		status = next;
		const body = new FormData();
		body.set('status', next ?? '');
		body.set('note', note);
		queue = queue.then(async () => {
			try {
				const response = await fetch('?/setStatus', { method: 'POST', body });
				saveFailed = deserialize(await response.text()).type !== 'success';
			} catch {
				saveFailed = true;
			}
			if (saveFailed) status = previous;
		});
	}
</script>

<section aria-label="Song status">
	<p
		class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
	>
		Where it's at
	</p>
	<div class="mt-1 flex gap-1">
		{#each OPTIONS as option (option.value)}
			<button
				type="button"
				aria-pressed={status === option.value}
				onclick={() => save(status === option.value ? null : option.value)}
				class="focus-live min-h-11 flex-1 rounded-lg border px-2 text-sm font-medium {status ===
				option.value
					? 'border-accent-500 bg-accent-500 text-white'
					: 'border-surface-300 text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800'}"
			>
				{option.label}
			</button>
		{/each}
	</div>
	{#if status}
		<label class="mt-2 block">
			<span class="sr-only">Note to self</span>
			<input
				type="text"
				bind:value={note}
				maxlength="500"
				placeholder="What to work on next time"
				onblur={() => save(status)}
				class="focus-live min-h-11 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
			/>
		</label>
	{/if}
	{#if saveFailed}
		<p role="alert" class="mt-1 text-sm text-danger-600 dark:text-danger-400">
			Couldn't save that. Try again.
		</p>
	{/if}
</section>
