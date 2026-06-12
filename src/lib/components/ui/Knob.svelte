<script lang="ts">
	let {
		value,
		min = 0,
		max = 1,
		step = 0.05,
		detents = null,
		label,
		format = (v: number) => String(v),
		disabled = false,
		onchange
	}: {
		value: number;
		min?: number;
		max?: number;
		/** Keyboard/wheel increment — ignored when detents are given */
		step?: number;
		/** When set, the value snaps to these stops (must be sorted ascending) */
		detents?: number[] | null;
		label: string;
		/** Readout + aria-valuetext, e.g. v => `${Math.round(v * 100)}%` */
		format?: (v: number) => string;
		disabled?: boolean;
		onchange?: (v: number) => void;
	} = $props();

	// Classic amp pot: 270° sweep from 7 o'clock to 5 o'clock
	let angle = $derived(-135 + ((value - min) / (max - min)) * 270);

	function clamp(v: number): number {
		return Math.min(max, Math.max(min, v));
	}

	function snap(v: number): number {
		if (!detents?.length) {
			// Quantize to step so drags land on the same values keys produce
			return clamp(Math.round(v / step) * step);
		}
		let best = detents[0];
		for (const d of detents) {
			if (Math.abs(d - v) < Math.abs(best - v)) best = d;
		}
		return best;
	}

	function commit(raw: number) {
		const next = snap(clamp(raw));
		if (next !== value) onchange?.(next);
	}

	function stepBy(direction: 1 | -1, count = 1) {
		if (detents?.length) {
			const idx = detents.findIndex((d) => Math.abs(d - value) < 1e-9);
			const from = idx === -1 ? detents.indexOf(snap(value)) : idx;
			const next = detents[Math.min(detents.length - 1, Math.max(0, from + direction * count))];
			if (next !== value) onchange?.(next);
		} else {
			commit(value + direction * count * step);
		}
	}

	// Vertical drag like a fader: up = more. 150px = full sweep; Shift = fine.
	let dragging = $state(false);
	let startY = 0;
	let startValue = 0;

	function handlePointerDown(e: PointerEvent) {
		if (disabled) return;
		dragging = true;
		startY = e.clientY;
		startValue = value;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function handlePointerMove(e: PointerEvent) {
		if (!dragging) return;
		const dy = startY - e.clientY;
		commit(startValue + (dy / (e.shiftKey ? 600 : 150)) * (max - min));
	}

	function handlePointerUp() {
		dragging = false;
	}

	function handleWheel(e: WheelEvent) {
		if (disabled) return;
		e.preventDefault();
		stepBy(e.deltaY < 0 ? 1 : -1);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (disabled) return;
		switch (e.key) {
			case 'ArrowUp':
			case 'ArrowRight':
				stepBy(1);
				break;
			case 'ArrowDown':
			case 'ArrowLeft':
				stepBy(-1);
				break;
			case 'PageUp':
				stepBy(1, 5);
				break;
			case 'PageDown':
				stepBy(-1, 5);
				break;
			case 'Home':
				commit(min);
				break;
			case 'End':
				commit(max);
				break;
			default:
				return;
		}
		e.preventDefault();
	}

	// Sensible aria-valuenow precision: percentages read better than 0.85
	let ariaNow = $derived(Math.round(value * 100) / 100);
</script>

<div class="flex w-14 flex-col items-center gap-1">
	<div
		role="slider"
		tabindex={disabled ? -1 : 0}
		aria-label={label}
		aria-valuemin={min}
		aria-valuemax={max}
		aria-valuenow={ariaNow}
		aria-valuetext={format(value)}
		aria-disabled={disabled}
		onpointerdown={handlePointerDown}
		onpointermove={handlePointerMove}
		onpointerup={handlePointerUp}
		onpointercancel={handlePointerUp}
		onwheel={handleWheel}
		onkeydown={handleKeydown}
		class="focus-live relative h-12 w-12 cursor-ns-resize touch-none rounded-full border border-surface-400 bg-surface-800 shadow-sm select-none dark:border-surface-600 dark:bg-surface-900 {disabled
			? 'cursor-default opacity-50'
			: ''}"
	>
		<!-- 12 o'clock tick on the bezel -->
		<span
			class="absolute top-[-3px] left-1/2 h-1.5 w-0.5 -translate-x-1/2 rounded-full bg-surface-500"
			aria-hidden="true"
		></span>
		<!-- Pointer: copper bar from center toward the rim, rotated with the value.
		     No transition — a knob tracks the hand directly. -->
		<div class="absolute inset-0" style="transform: rotate({angle}deg)" aria-hidden="true">
			<span class="absolute top-1 left-1/2 h-4 w-0.5 -translate-x-1/2 rounded-full bg-accent-400"
			></span>
		</div>
	</div>
	<span
		class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
	>
		{label}
	</span>
	<span class="-mt-1 text-xs font-medium text-surface-700 tabular-nums dark:text-surface-300">
		{format(value)}
	</span>
</div>
