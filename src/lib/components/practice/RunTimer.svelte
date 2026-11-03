<script lang="ts">
	import { onDestroy } from 'svelte';
	import { deserialize } from '$app/forms';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import { formatDuration } from '#lib/utils/duration.js';

	let {
		lengthSeconds,
		isShared,
		onrun,
		onapplied
	}: {
		lengthSeconds: number;
		/** Changing this song reaches someone else's library or a band's totals */
		isShared: boolean;
		onrun?: (seconds: number) => void;
		onapplied?: (seconds: number, previous: number) => void;
	} = $props();

	let elapsed = $state(0);
	let running = $state(false);
	let measured = $state<number | null>(null);
	let error = $state('');
	let confirmDialog: ConfirmDialog;
	let startedAt = 0;
	let timer: ReturnType<typeof setInterval> | null = null;

	function clear() {
		if (timer) clearInterval(timer);
		timer = null;
	}
	onDestroy(clear);

	function toggle() {
		error = '';
		if (running) {
			clear();
			running = false;
			measured = Math.max(1, Math.round(elapsed));
			onrun?.(measured);
		} else {
			measured = null;
			elapsed = 0;
			startedAt = Date.now();
			timer = setInterval(() => (elapsed = (Date.now() - startedAt) / 1000), 250);
			running = true;
		}
	}

	async function apply() {
		if (measured === null) return;
		const seconds = measured;
		if (
			isShared &&
			!(await confirmDialog.confirm(
				'Change this song for everyone?',
				`This song is shared. Changing it to ${formatDuration(seconds)} also changes the owner's library, your bandmates' totals, and every set it's in.`,
				{ confirmLabel: 'Change it', destructive: false }
			))
		) {
			return;
		}
		const previous = lengthSeconds;
		const body = new FormData();
		body.set('seconds', String(seconds));
		body.set('expected', String(previous));
		try {
			const response = await fetch('?/applyLength', { method: 'POST', body });
			const result = deserialize(await response.text());
			if (result.type === 'success') {
				onapplied?.(seconds, previous);
				measured = null;
			} else if (response.status === 409) {
				error = 'Someone changed this song while you were playing. Reload to see the new length.';
			} else {
				error = "Couldn't update the length. Try again.";
			}
		} catch {
			error = "Couldn't update the length. Try again.";
		}
	}
</script>

<section
	aria-label="Time a run"
	class="rounded-xl border border-surface-200 bg-surface-50 px-4 py-3 dark:border-surface-700 dark:bg-surface-800"
>
	<div class="flex items-center justify-between gap-3">
		<div>
			<h2
				class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
			>
				Time a run
			</h2>
			<p
				role="timer"
				class="font-display text-2xl font-bold text-surface-900 tabular-nums dark:text-surface-100"
			>
				{formatDuration(Math.floor(elapsed))}
			</p>
		</div>
		<button
			type="button"
			onclick={toggle}
			aria-pressed={running}
			class="focus-live min-h-11 rounded-lg border border-surface-300 px-4 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-700"
		>
			{running ? 'Stop timing' : 'Start timing'}
		</button>
	</div>
	{#if measured !== null && measured !== lengthSeconds}
		<div class="mt-2 flex items-center justify-between gap-3">
			<p class="text-sm text-surface-600 dark:text-surface-300">
				Listed as {formatDuration(lengthSeconds)}
			</p>
			<button
				type="button"
				onclick={apply}
				class="focus-live min-h-11 rounded-lg bg-accent-500 px-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-600"
			>
				Use {formatDuration(measured)}
			</button>
		</div>
	{/if}
	{#if error}
		<p role="alert" class="mt-2 text-sm text-danger-600 dark:text-danger-400">{error}</p>
	{/if}
</section>

<ConfirmDialog bind:this={confirmDialog} />
