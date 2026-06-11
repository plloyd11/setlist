<script lang="ts">
	import { formatDuration, parseDurationLenient } from '$lib/utils/duration';
	import ProgressBar from '$lib/components/ui/ProgressBar.svelte';

	let {
		setlistItems,
		targetSeconds = null,
		transitionSeconds = 0,
		onTargetChange,
		onTransitionChange
	}: {
		setlistItems: Array<{ duration_seconds: number; gap_seconds?: number | null }>;
		targetSeconds: number | null;
		transitionSeconds: number;
		onTargetChange: (seconds: number | null) => void;
		onTransitionChange: (seconds: number) => void;
	} = $props();

	// Target input value (mm:ss string, synced from prop via $effect below)
	let targetInput = $state('');

	// Invalid-input flash: brief danger ring so a rejected value doesn't just vanish
	let targetInvalid = $state(false);
	let invalidTimer: ReturnType<typeof setTimeout> | undefined;

	// Sync target input when prop changes
	$effect(() => {
		targetInput = targetSeconds ? formatDuration(targetSeconds) : '';
	});

	// Computed values
	let totalSongSeconds = $derived(
		setlistItems.reduce((sum, song) => sum + (song.duration_seconds || 0), 0)
	);
	// Transitions apply between consecutive songs; an explicit gap IS the break,
	// so pairs touching a gap don't get extra transition time
	let totalTransitionSeconds = $derived.by(() => {
		let pairs = 0;
		for (let i = 0; i < setlistItems.length - 1; i++) {
			if (setlistItems[i].gap_seconds == null && setlistItems[i + 1].gap_seconds == null) pairs++;
		}
		return pairs * transitionSeconds;
	});
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
		const parsed = parseDurationLenient(targetInput);
		if (parsed !== null) {
			targetInput = formatDuration(parsed);
			onTargetChange(parsed);
		} else {
			// Reset to current value and flash so the rejection is visible
			targetInput = targetSeconds ? formatDuration(targetSeconds) : '';
			targetInvalid = true;
			clearTimeout(invalidTimer);
			invalidTimer = setTimeout(() => (targetInvalid = false), 1500);
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
		transitionSeconds >= 60 ? formatDuration(transitionSeconds) : `${transitionSeconds}s`
	);

	let overUnderLabel = $derived.by(() => {
		if (!targetSeconds) return '';
		const abs = Math.abs(overUnderSeconds);
		const formatted = formatDuration(abs);
		return overUnderSeconds > 0 ? `+${formatted}` : `-${formatted}`;
	});
</script>

<div
	class="sticky bottom-0 z-10 border-t border-surface-200 bg-surface-50 px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] dark:border-surface-700 dark:bg-surface-900 dark:shadow-[0_-2px_8px_rgba(0,0,0,0.3)]"
>
	<!-- Desktop layout: single row -->
	<div class="hidden items-center gap-4 md:flex">
		<!-- Total time -->
		<div class="text-center">
			<p
				class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
			>
				Total
			</p>
			<p class="font-display text-xl font-bold text-accent-600 dark:text-accent-hot">
				{formatDuration(totalSeconds)}
			</p>
		</div>

		<!-- Target time input -->
		<div class="text-center">
			<p
				class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
			>
				Target
			</p>
			<input
				type="text"
				bind:value={targetInput}
				onblur={handleTargetBlur}
				onkeydown={handleTargetKeydown}
				placeholder="45:00"
				title="Set length in minutes (45) or mm:ss (45:00)"
				aria-label="Target set duration, minutes or mm:ss"
				class="focus-live w-20 rounded border bg-transparent px-1.5 py-0.5 text-center text-sm text-surface-700 placeholder-surface-500 dark:text-surface-300 dark:placeholder-surface-300 {targetInvalid
					? 'border-danger-500 ring-1 ring-danger-500'
					: 'border-surface-300 dark:border-surface-600'}"
			/>
		</div>

		<!-- Over/under indicator -->
		{#if targetSeconds}
			<div class="text-center">
				<p
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
				>
					Diff
				</p>
				<p
					class="text-sm font-bold {isOver
						? 'text-danger-600 dark:text-danger-300'
						: 'text-success-600 dark:text-success-300'}"
				>
					{overUnderLabel}
				</p>
			</div>
		{/if}

		<!-- Progress bar -->
		{#if targetSeconds}
			<div class="flex-1">
				<ProgressBar percent={progressPercent} {isOver} ariaLabel="Setlist duration progress" />
			</div>
		{:else}
			<div class="flex-1"></div>
		{/if}

		<!-- Transition stepper -->
		<div class="text-center">
			<p
				class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
			>
				Gap
			</p>
			<div class="flex items-center gap-1">
				<button
					onclick={decrementTransition}
					disabled={transitionSeconds <= 0}
					class="rounded px-1.5 py-0.5 text-xs text-surface-500 hover:bg-surface-100 disabled:opacity-30 dark:text-surface-300 dark:hover:bg-surface-800"
					aria-label="Decrease transition time">-</button
				>
				<span class="w-10 text-center text-sm font-medium text-surface-700 dark:text-surface-300">
					{transitionLabel}
				</span>
				<button
					onclick={incrementTransition}
					disabled={transitionSeconds >= 300}
					class="rounded px-1.5 py-0.5 text-xs text-surface-500 hover:bg-surface-100 disabled:opacity-30 dark:text-surface-300 dark:hover:bg-surface-800"
					aria-label="Increase transition time">+</button
				>
			</div>
		</div>
	</div>

	<!-- Mobile layout: compact two rows -->
	<div class="md:hidden">
		<div class="flex items-center justify-between gap-3">
			<!-- Total -->
			<div>
				<span
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
					>Total
				</span>
				<span class="font-display text-lg font-bold text-accent-600 dark:text-accent-hot">
					{formatDuration(totalSeconds)}
				</span>
			</div>

			<!-- Over/under -->
			{#if targetSeconds}
				<span
					class="text-sm font-bold {isOver
						? 'text-danger-600 dark:text-danger-300'
						: 'text-success-600 dark:text-success-300'}"
				>
					{overUnderLabel}
				</span>
			{/if}

			<!-- Target input -->
			<div class="flex items-center gap-1">
				<span
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
					>Tgt
				</span>
				<input
					type="text"
					bind:value={targetInput}
					onblur={handleTargetBlur}
					onkeydown={handleTargetKeydown}
					placeholder="45:00"
					title="Set length in minutes (45) or mm:ss (45:00)"
					aria-label="Target set duration, minutes or mm:ss"
					class="focus-live w-14 rounded border bg-transparent px-1 py-0.5 text-center text-xs text-surface-700 placeholder-surface-500 dark:text-surface-300 dark:placeholder-surface-300 {targetInvalid
						? 'border-danger-500 ring-1 ring-danger-500'
						: 'border-surface-300 dark:border-surface-600'}"
				/>
			</div>

			<!-- Gap stepper -->
			<div class="flex items-center gap-0.5">
				<span
					class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
					>Gap
				</span>
				<button
					onclick={decrementTransition}
					disabled={transitionSeconds <= 0}
					class="rounded px-1 text-xs text-surface-500 disabled:opacity-30 dark:text-surface-300"
					aria-label="Decrease transition time">-</button
				>
				<span class="text-xs font-medium text-surface-700 dark:text-surface-300"
					>{transitionLabel}</span
				>
				<button
					onclick={incrementTransition}
					disabled={transitionSeconds >= 300}
					class="rounded px-1 text-xs text-surface-500 disabled:opacity-30 dark:text-surface-300"
					aria-label="Increase transition time">+</button
				>
			</div>
		</div>

		<!-- Progress bar (mobile) -->
		{#if targetSeconds}
			<div class="mt-2">
				<ProgressBar percent={progressPercent} {isOver} ariaLabel="Setlist duration progress" />
			</div>
		{/if}
	</div>
</div>
