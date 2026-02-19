<script lang="ts">
	import { formatDuration, parseDuration } from '$lib/utils/duration';
	import ProgressBar from '$lib/components/ui/ProgressBar.svelte';

	let {
		setlistItems,
		targetSeconds = null,
		transitionSeconds = 0,
		onTargetChange,
		onTransitionChange
	}: {
		setlistItems: Array<{ duration_seconds: number }>;
		targetSeconds: number | null;
		transitionSeconds: number;
		onTargetChange: (seconds: number | null) => void;
		onTransitionChange: (seconds: number) => void;
	} = $props();

	// Target input value (mm:ss string)
	let targetInput = $state(targetSeconds ? formatDuration(targetSeconds) : '');

	// Sync target input when prop changes
	$effect(() => {
		targetInput = targetSeconds ? formatDuration(targetSeconds) : '';
	});

	// Computed values
	let totalSongSeconds = $derived(
		setlistItems.reduce((sum, song) => sum + (song.duration_seconds || 0), 0)
	);
	let totalTransitionSeconds = $derived(
		setlistItems.length > 1 ? (setlistItems.length - 1) * transitionSeconds : 0
	);
	let totalSeconds = $derived(totalSongSeconds + totalTransitionSeconds);
	let overUnderSeconds = $derived(targetSeconds ? totalSeconds - targetSeconds : 0);
	let progressPercent = $derived(
		targetSeconds ? Math.min((totalSeconds / targetSeconds) * 100, 150) : 0
	);
	let isOver = $derived(targetSeconds ? totalSeconds > targetSeconds : false);

	function handleTargetBlur() {
		if (!targetInput.trim()) {
			onTargetChange(null);
			return;
		}
		const parsed = parseDuration(targetInput);
		if (parsed !== null) {
			onTargetChange(parsed);
		} else {
			// Reset to current value
			targetInput = targetSeconds ? formatDuration(targetSeconds) : '';
		}
	}

	function handleTargetKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.target as HTMLInputElement).blur();
		}
	}

	function decrementTransition() {
		const next = Math.max(0, transitionSeconds - 5);
		onTransitionChange(next);
	}

	function incrementTransition() {
		const next = Math.min(300, transitionSeconds + 5);
		onTransitionChange(next);
	}

	let transitionLabel = $derived(
		transitionSeconds >= 60
			? formatDuration(transitionSeconds)
			: `${transitionSeconds}s`
	);

	let overUnderLabel = $derived.by(() => {
		if (!targetSeconds) return '';
		const abs = Math.abs(overUnderSeconds);
		const formatted = formatDuration(abs);
		return overUnderSeconds > 0 ? `+${formatted}` : `-${formatted}`;
	});
</script>

<div class="sticky bottom-0 z-10 border-t border-stone-200 bg-white px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] dark:border-stone-700 dark:bg-stone-900 dark:shadow-[0_-2px_8px_rgba(0,0,0,0.3)]">
	<!-- Desktop layout: single row -->
	<div class="hidden items-center gap-4 md:flex">
		<!-- Total time -->
		<div class="text-center">
			<p class="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">Total</p>
			<p class="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
				{formatDuration(totalSeconds)}
			</p>
		</div>

		<!-- Target time input -->
		<div class="text-center">
			<p class="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">Target</p>
			<input
				type="text"
				bind:value={targetInput}
				onblur={handleTargetBlur}
				onkeydown={handleTargetKeydown}
				placeholder="Set target"
				class="w-20 rounded border border-stone-300 bg-transparent px-1.5 py-0.5 text-center text-sm text-stone-700 placeholder-stone-400 focus:border-amber-500 focus:outline-none dark:border-stone-600 dark:text-stone-300 dark:placeholder-stone-500"
			/>
		</div>

		<!-- Over/under indicator -->
		{#if targetSeconds}
			<div class="text-center">
				<p class="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">Diff</p>
				<p class="text-sm font-bold {isOver ? 'text-red-500' : 'text-emerald-500'}">
					{overUnderLabel}
				</p>
			</div>
		{/if}

		<!-- Progress bar -->
		{#if targetSeconds}
			<div class="flex-1">
				<ProgressBar percent={progressPercent} {isOver} />
			</div>
		{:else}
			<div class="flex-1"></div>
		{/if}

		<!-- Transition stepper -->
		<div class="text-center">
			<p class="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">Gap</p>
			<div class="flex items-center gap-1">
				<button
					onclick={decrementTransition}
					disabled={transitionSeconds <= 0}
					class="rounded px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30 dark:text-stone-400 dark:hover:bg-stone-800"
					aria-label="Decrease transition time"
				>-</button>
				<span class="w-10 text-center text-sm font-medium text-stone-700 dark:text-stone-300">
					{transitionLabel}
				</span>
				<button
					onclick={incrementTransition}
					disabled={transitionSeconds >= 300}
					class="rounded px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100 disabled:opacity-30 dark:text-stone-400 dark:hover:bg-stone-800"
					aria-label="Increase transition time"
				>+</button>
			</div>
		</div>
	</div>

	<!-- Mobile layout: compact two rows -->
	<div class="md:hidden">
		<div class="flex items-center justify-between gap-3">
			<!-- Total -->
			<div>
				<span class="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">Total </span>
				<span class="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
					{formatDuration(totalSeconds)}
				</span>
			</div>

			<!-- Over/under -->
			{#if targetSeconds}
				<span class="text-sm font-bold {isOver ? 'text-red-500' : 'text-emerald-500'}">
					{overUnderLabel}
				</span>
			{/if}

			<!-- Target input -->
			<div class="flex items-center gap-1">
				<span class="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">Tgt </span>
				<input
					type="text"
					bind:value={targetInput}
					onblur={handleTargetBlur}
					onkeydown={handleTargetKeydown}
					placeholder="--:--"
					class="w-14 rounded border border-stone-300 bg-transparent px-1 py-0.5 text-center text-xs text-stone-700 placeholder-stone-400 focus:border-amber-500 focus:outline-none dark:border-stone-600 dark:text-stone-300 dark:placeholder-stone-500"
				/>
			</div>

			<!-- Gap stepper -->
			<div class="flex items-center gap-0.5">
				<span class="text-[10px] font-medium uppercase tracking-wider text-stone-400 dark:text-stone-500">Gap </span>
				<button
					onclick={decrementTransition}
					disabled={transitionSeconds <= 0}
					class="rounded px-1 text-xs text-stone-500 disabled:opacity-30 dark:text-stone-400"
				>-</button>
				<span class="text-xs font-medium text-stone-700 dark:text-stone-300">{transitionLabel}</span>
				<button
					onclick={incrementTransition}
					disabled={transitionSeconds >= 300}
					class="rounded px-1 text-xs text-stone-500 disabled:opacity-30 dark:text-stone-400"
				>+</button>
			</div>
		</div>

		<!-- Progress bar (mobile) -->
		{#if targetSeconds}
			<div class="mt-2">
				<ProgressBar percent={progressPercent} {isOver} />
			</div>
		{/if}
	</div>
</div>
