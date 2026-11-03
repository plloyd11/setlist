<script lang="ts">
	import { dndzone, TRIGGERS } from 'svelte-dnd-action';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { formatPracticeTime } from '#lib/utils/practiceTime.js';
	import { startPlan } from '#lib/utils/practicePlan.js';

	let { data, form } = $props();

	const flipDurationMs = 150;

	// svelte-ignore state_referenced_locally
	let routine = $state(data.routine);
	let saveFailed = $state(false);
	let dragging = $state(false);

	$effect(() => {
		if (!dragging) routine = data.routine;
	});

	let totalSeconds = $derived(routine.reduce((sum, e) => sum + e.targetSeconds, 0));

	function handleConsider(e: CustomEvent<{ items: typeof routine; info: { trigger: string } }>) {
		dragging = e.detail.info.trigger !== TRIGGERS.DRAG_STOPPED;
		routine = e.detail.items;
	}

	async function handleFinalize(e: CustomEvent<{ items: typeof routine }>) {
		dragging = false;
		routine = e.detail.items;
		const body = new FormData();
		body.set('ids', JSON.stringify(routine.map((item) => item.id)));
		try {
			const response = await fetch('?/reorder', { method: 'POST', body });
			saveFailed = !response.ok;
		} catch {
			saveFailed = true;
		}
	}

	function startRoutine() {
		const steps = routine.map((e) => ({
			href: `/exercises/${e.id}?from=/practice/warm-up`,
			label: e.title
		}));
		startPlan(steps);
		goto(steps[0].href);
	}

	const rowClass =
		'flex min-h-12 items-center gap-2 border-b border-surface-200 px-3 py-1.5 last:border-b-0 dark:border-surface-700';
	const smallButton =
		'focus-live min-h-11 rounded-lg px-3 text-sm text-surface-500 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800';
</script>

<svelte:head>
	<title>Warm up — Setlist</title>
</svelte:head>

{#snippet details(exercise: (typeof routine)[number])}
	<a
		href="/exercises/{exercise.id}?from=/practice/warm-up"
		class="focus-live min-w-0 flex-1 truncate text-sm font-medium text-surface-900 hover:underline dark:text-surface-100"
	>
		{exercise.title}
	</a>
	{#if exercise.hasChart}
		<span class="shrink-0 text-xs text-accent-600 dark:text-accent-400">Chart</span>
	{/if}
	{#if exercise.hasAudio}
		<span class="shrink-0 text-xs text-accent-600 dark:text-accent-400">Audio</span>
	{/if}
	<span class="shrink-0 text-sm text-surface-500 tabular-nums dark:text-surface-300">
		{formatPracticeTime(exercise.targetSeconds)}
	</span>
{/snippet}

{#if routine.length > 0}
	<div class="flex flex-wrap items-center justify-between gap-3">
		<p class="text-sm text-surface-600 dark:text-surface-300">
			Your routine ·
			<span class="font-medium tabular-nums">{formatPracticeTime(totalSeconds)}</span>
		</p>
		<!-- The hero CTA: the one always-energized button on this screen -->
		<button
			type="button"
			onclick={startRoutine}
			class="focus-live rounded-lg bg-accent-hot px-6 py-3 font-display font-bold text-surface-950 shadow-glow-accent hover:brightness-105"
		>
			Start warm-up
		</button>
	</div>

	<ol
		aria-label="Warm-up routine"
		class="mt-3 overflow-hidden rounded-xl border bg-surface-50 dark:bg-surface-800/50 {dragging
			? 'border-neon-600 shadow-glow-neon dark:border-neon-400'
			: 'border-surface-200 dark:border-surface-700'}"
		use:dndzone={{ items: routine, flipDurationMs, type: 'warm-up-routine', dropTargetStyle: {} }}
		onconsider={handleConsider}
		onfinalize={handleFinalize}
	>
		{#each routine as exercise (exercise.id)}
			<li class={rowClass}>
				{@render details(exercise)}
				<form method="POST" action="?/removeFromRoutine" use:enhance>
					<input type="hidden" name="id" value={exercise.id} />
					<button
						type="submit"
						aria-label="Take {exercise.title} out of the routine"
						class={smallButton}
					>
						Remove
					</button>
				</form>
			</li>
		{/each}
	</ol>
	<p class="mt-1 text-xs text-surface-500 dark:text-surface-300">Drag to change the order.</p>
	{#if saveFailed}
		<p role="alert" class="mt-1 text-sm text-danger-600 dark:text-danger-400">
			Couldn't save the order. Try again.
		</p>
	{/if}
{:else}
	<p class="font-display text-xl text-surface-900 dark:text-surface-100">No warm-up yet</p>
	<p class="mt-1 max-w-prose text-sm text-surface-500 dark:text-surface-300">
		Add the exercises you warm up with, then run them in order with a timer. Each one can have its
		own chart, Guitar Pro file or backing track.
	</p>
{/if}

<form
	method="POST"
	action="?/create"
	use:enhance
	class="mt-6 flex flex-wrap items-end gap-2 rounded-xl border border-surface-200 bg-surface-50 p-3 dark:border-surface-700 dark:bg-surface-800"
>
	<label class="min-w-48 flex-1">
		<span
			class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
		>
			New exercise
		</span>
		<input
			name="title"
			required
			maxlength="120"
			placeholder="Chromatic run"
			class="focus-live mt-1 block min-h-11 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100 dark:placeholder-surface-300"
		/>
	</label>
	<label class="w-24">
		<span
			class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
		>
			Minutes
		</span>
		<input
			name="minutes"
			type="number"
			min="0.5"
			max="240"
			step="0.5"
			value="2"
			required
			class="focus-live mt-1 block min-h-11 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100"
		/>
	</label>
	<button
		type="submit"
		class="focus-live min-h-11 rounded-lg bg-accent-500 px-4 font-semibold text-white shadow-sm hover:bg-accent-600"
	>
		Add
	</button>
	{#if form?.error}
		<p role="alert" class="w-full text-sm text-danger-600 dark:text-danger-400">{form.error}</p>
	{/if}
</form>

{#if data.others.length > 0}
	<section class="mt-8" aria-label="Other exercises">
		<h2 class="font-display text-lg font-semibold text-surface-900 dark:text-surface-100">
			Other exercises
		</h2>
		<ul
			class="mt-3 overflow-hidden rounded-xl border border-surface-200 bg-surface-50 dark:border-surface-700 dark:bg-surface-800/50"
		>
			{#each data.others as exercise (exercise.id)}
				<li class={rowClass}>
					{@render details(exercise)}
					<form method="POST" action="?/addToRoutine" use:enhance>
						<input type="hidden" name="id" value={exercise.id} />
						<button
							type="submit"
							aria-label="Add {exercise.title} to the routine"
							class={smallButton}
						>
							Add
						</button>
					</form>
				</li>
			{/each}
		</ul>
	</section>
{/if}
