<script lang="ts">
	import { untrack } from 'svelte';
	import Digits from '#lib/components/ui/Digits.svelte';
	import { microLabel } from '#lib/components/practice/practiceStyles.js';
	import { meterPercent } from '#lib/utils/rigFormat.js';

	/**
	 * A level meter with a scale, for the Rig page: an LED ladder from -60 dBFS to 0, a
	 * mark that holds the last peak, and a lamp for the thing that goes wrong at this
	 * point in the chain (the input clipping, the limiter working). Lit only while the
	 * rig is live. It's a picture of the sound, so it's hidden from screen readers.
	 */
	let {
		db,
		live,
		lamp,
		lampOn = false
	}: {
		/** Peak level in dBFS, already eased by the rig */
		db: number;
		live: boolean;
		/** Names the warning lamp, e.g. "Clip" */
		lamp: string;
		lampOn?: boolean;
	} = $props();

	const TICKS = [-48, -36, -24, -12, 0];
	/** The top of the ladder is red: the last 3 dB before full scale */
	const HOT_FROM = meterPercent(-3);
	const HOLD_MS = 1500;
	/** A warning stays lit long enough to catch out of the corner of an eye */
	const LAMP_MS = 2000;

	let hold = $state(-Infinity);
	let holdAt = 0;
	let lampLit = $state(false);
	let lampAt = 0;

	// The rig posts a new level every frame while it's on, which is what drives this
	$effect(() => {
		const level = db;
		const warning = lampOn;
		const on = live;
		untrack(() => {
			const now = performance.now();
			if (!on) {
				hold = -Infinity;
				lampLit = false;
				return;
			}
			if (level >= hold) {
				hold = level;
				holdAt = now;
			} else if (now - holdAt > HOLD_MS) {
				hold = Math.max(level, hold - 0.5);
			}
			if (warning) {
				lampLit = true;
				lampAt = now;
			} else if (lampLit && now - lampAt > LAMP_MS) {
				lampLit = false;
			}
		});
	});

	let reading = $derived(Number.isFinite(hold) && hold > -99 ? String(Math.round(hold)) : '--');
</script>

<div aria-hidden="true">
	<div class="flex items-center gap-3">
		<div class="meter relative h-3 min-w-0 flex-1">
			<div class="ladder absolute inset-0 bg-surface-200 dark:bg-surface-700">
				<div
					class="absolute inset-0"
					style="clip-path: inset(0 {100 -
						meterPercent(
							db
						)}% 0 0); background: linear-gradient(to right, var(--meter-lit) 0 {HOT_FROM}%, var(--meter-hot) {HOT_FROM}% 100%)"
				></div>
			</div>
			<!-- Outside the ladder's mask, so the mark never lands in a gap and disappears -->
			{#if Number.isFinite(hold) && meterPercent(hold) > 0}
				<div
					class="absolute inset-y-0 w-0.5 {hold > -3 ? 'bg-(--meter-hot)' : 'bg-(--meter-lit)'}"
					style="left: calc({meterPercent(hold)}% - 2px)"
				></div>
			{/if}
		</div>
		<span
			class="w-13 shrink-0 text-right text-xs font-medium text-surface-700 dark:text-surface-300"
			data-testid="rig-meter-reading"
		>
			<!-- The unit sits outside the slots, which would swallow the space before it -->
			<Digits value={reading} /> dB
		</span>
		<span class="flex w-16 shrink-0 items-center gap-1.5">
			<span
				class="h-2 w-2 rounded-full {lampLit
					? 'bg-danger-500 shadow-[0_0_8px_var(--color-danger-400)] dark:bg-danger-300'
					: 'bg-surface-300 dark:bg-surface-600'}"
			></span>
			<span
				class="{microLabel} {lampLit ? 'text-danger-600 dark:text-danger-300' : ''}"
				data-lamp={lampLit ? 'on' : 'off'}
			>
				{lamp}
			</span>
		</span>
	</div>
	<!-- The scale sits under the ladder only, so its marks line up with the level -->
	<div class="flex gap-3">
		<div class="relative mt-1 h-3 min-w-0 flex-1">
			{#each TICKS as tick (tick)}
				<span
					class="absolute -translate-x-full text-label text-surface-500 dark:text-surface-300"
					style="left: {meterPercent(tick)}%"
				>
					{tick}
				</span>
			{/each}
		</div>
		<span class="w-13 shrink-0"></span>
		<span class="w-16 shrink-0"></span>
	</div>
</div>

<style>
	.meter {
		--meter-lit: var(--color-neon-600);
		--meter-hot: var(--color-danger-500);
	}
	:global(.dark) .meter {
		--meter-lit: var(--color-neon-400);
		--meter-hot: var(--color-danger-300);
	}
	.ladder {
		border-radius: 2px;
		/* LED segments: the gaps are cut out of the track and the level together */
		mask-image: repeating-linear-gradient(to right, #000 0 5px, transparent 5px 7px);
	}
</style>
