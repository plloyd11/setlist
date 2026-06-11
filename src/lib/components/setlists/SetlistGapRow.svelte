<script lang="ts">
	import { formatDuration } from '$lib/utils/duration';

	let {
		gap,
		onDurationChange,
		onLabelChange,
		onRemove
	}: {
		gap: { id: string; gap_seconds: number | null; gap_label: string | null };
		onDurationChange: (id: string, seconds: number) => void;
		onLabelChange: (id: string, label: string) => void;
		onRemove: (id: string) => void;
	} = $props();

	let seconds = $derived(gap.gap_seconds ?? 30);

	// Editable label, synced from the prop (e.g. after invalidateAll)
	let labelInput = $state('');
	$effect(() => {
		labelInput = gap.gap_label ?? '';
	});

	function handleLabelBlur() {
		const trimmed = labelInput.trim().slice(0, 60);
		labelInput = trimmed;
		if (trimmed === (gap.gap_label ?? '')) return;
		onLabelChange(gap.id, trimmed);
	}

	function handleLabelKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.target as HTMLInputElement).blur();
		}
	}

	function decrement() {
		onDurationChange(gap.id, Math.max(15, seconds - 15));
	}

	function increment() {
		onDurationChange(gap.id, Math.min(1800, seconds + 15));
	}
</script>

<div
	class="flex items-center gap-2 rounded-lg border border-dashed border-surface-300 bg-surface-100/60 px-3 py-2 dark:border-surface-600 dark:bg-surface-900/60"
>
	<!-- Drag handle -->
	<span class="cursor-grab text-surface-400 dark:text-surface-300" aria-hidden="true">
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="currentColor"
		>
			<circle cx="9" cy="5" r="1.5" />
			<circle cx="15" cy="5" r="1.5" />
			<circle cx="9" cy="12" r="1.5" />
			<circle cx="15" cy="12" r="1.5" />
			<circle cx="9" cy="19" r="1.5" />
			<circle cx="15" cy="19" r="1.5" />
		</svg>
	</span>

	<!-- Gap label: editable, e.g. "Tuning break", "Noises" -->
	<input
		type="text"
		bind:value={labelInput}
		onblur={handleLabelBlur}
		onkeydown={handleLabelKeydown}
		placeholder="Gap"
		maxlength="60"
		aria-label="Gap label"
		class="focus-live min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm font-medium text-surface-600 placeholder-surface-400 hover:border-surface-300 dark:text-surface-300 dark:placeholder-surface-500 dark:hover:border-surface-600"
	/>

	<!-- Duration stepper: ±15s keeps input unambiguous -->
	<div class="flex shrink-0 items-center gap-1">
		<button
			onclick={decrement}
			disabled={seconds <= 15}
			class="rounded px-1.5 py-0.5 text-xs text-surface-500 hover:bg-surface-200 disabled:opacity-30 dark:text-surface-300 dark:hover:bg-surface-700"
			aria-label="Decrease gap duration">-</button
		>
		<span class="w-12 text-center text-sm text-surface-700 tabular-nums dark:text-surface-300">
			{formatDuration(seconds)}
		</span>
		<button
			onclick={increment}
			disabled={seconds >= 1800}
			class="rounded px-1.5 py-0.5 text-xs text-surface-500 hover:bg-surface-200 disabled:opacity-30 dark:text-surface-300 dark:hover:bg-surface-700"
			aria-label="Increase gap duration">+</button
		>
	</div>

	<!-- Remove button -->
	<button
		onclick={() => onRemove(gap.id)}
		class="shrink-0 rounded p-0.5 text-surface-400 hover:bg-surface-100 hover:text-danger-500 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-danger-400"
		aria-label="Remove gap from setlist"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M18 6 6 18M6 6l12 12" />
		</svg>
	</button>
</div>
