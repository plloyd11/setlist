<script lang="ts">
	import Digits from '#lib/components/ui/Digits.svelte';
	import { dndzone, TRIGGERS } from 'svelte-dnd-action';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { formatPracticeTime } from '#lib/utils/practiceTime.js';
	import { startPlan } from '#lib/utils/practicePlan.js';
	import MediaIcons from '#lib/components/practice/MediaIcons.svelte';
	import SessionStrip from '#lib/components/practice/SessionStrip.svelte';
	import {
		field,
		fieldLabel,
		heroButton,
		KIND_TONES,
		microLabel,
		panel,
		panelFooter,
		panelRows,
		primaryButton,
		reading,
		sectionHeading
	} from '#lib/components/practice/practiceStyles.js';

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
	let segments = $derived(
		routine.map((e) => ({
			key: e.id,
			label: e.title,
			seconds: e.targetSeconds,
			tone: KIND_TONES['warm-up']
		}))
	);

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

	// A solid fill, so the row stays readable while it's lifted out and dragged
	const rowClass =
		'flex min-h-12 items-center gap-2 bg-surface-50 py-1.5 pr-1.5 pl-4 md:pr-2.5 md:pl-5 dark:bg-surface-800';
	const iconButton =
		'focus-live flex h-11 w-11 items-center justify-center rounded-lg text-surface-500 transition-colors duration-150 hover:bg-surface-100 hover:text-surface-800 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100';
</script>

<svelte:head>
	<title>Warm up · Setlist</title>
</svelte:head>

{#snippet details(exercise: (typeof routine)[number])}
	<a
		href="/exercises/{exercise.id}?from=/practice/warm-up"
		class="focus-live min-w-0 flex-1 truncate text-sm font-medium text-surface-900 hover:underline dark:text-surface-100 pointer-coarse:-my-3 pointer-coarse:py-3"
	>
		{exercise.title}
	</a>
	<MediaIcons hasChart={exercise.hasChart} hasAudio={exercise.hasAudio} />
	<span class="shrink-0 text-sm text-surface-500 dark:text-surface-300">
		<Digits value={formatPracticeTime(exercise.targetSeconds)} />
	</span>
{/snippet}

<div class="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
	<div
		class="{panel} min-w-0 overflow-hidden {dragging
			? 'border-neon-600 shadow-glow-neon dark:border-neon-400'
			: ''}"
	>
		{#if routine.length > 0}
			<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4 md:p-5">
				<div>
					<p class={microLabel}>Your routine</p>
					<p class="mt-1.5 {reading} text-4xl">{formatPracticeTime(totalSeconds)}</p>
				</div>
				<!-- The hero CTA: the one always-energized button on this screen -->
				<button type="button" onclick={startRoutine} class="{heroButton} grow sm:grow-0">
					Start warm-up
				</button>
			</div>
			<div class="px-4 pb-4 md:px-5">
				<SessionStrip {segments} label="How the routine splits" />
			</div>

			<ol
				aria-label="Warm-up routine"
				class="{panelRows} border-t border-surface-200 dark:border-surface-700"
				use:dndzone={{
					items: routine,
					flipDurationMs,
					type: 'warm-up-routine',
					dropTargetStyle: {}
				}}
				onconsider={handleConsider}
				onfinalize={handleFinalize}
			>
				{#each routine as exercise, i (exercise.id)}
					<li class="{rowClass} cursor-grab active:cursor-grabbing">
						<svg
							width="10"
							height="16"
							viewBox="0 0 10 16"
							fill="currentColor"
							class="shrink-0 text-surface-400 dark:text-surface-500"
							aria-hidden="true"
						>
							<circle cx="2" cy="2" r="1.5" />
							<circle cx="8" cy="2" r="1.5" />
							<circle cx="2" cy="8" r="1.5" />
							<circle cx="8" cy="8" r="1.5" />
							<circle cx="2" cy="14" r="1.5" />
							<circle cx="8" cy="14" r="1.5" />
						</svg>
						<span
							class="w-5 shrink-0 text-center text-xs font-semibold text-surface-500 dark:text-surface-300"
							aria-hidden="true"
						>
							{i + 1}
						</span>
						{@render details(exercise)}
						<form method="POST" action="?/removeFromRoutine" use:enhance>
							<input type="hidden" name="id" value={exercise.id} />
							<button
								type="submit"
								aria-label="Take {exercise.title} out of the routine"
								title="Take out of the routine"
								class={iconButton}
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									aria-hidden="true"
								>
									<path d="M18 6 6 18M6 6l12 12" />
								</svg>
							</button>
						</form>
					</li>
				{/each}
			</ol>
			{#if saveFailed}
				<p
					role="alert"
					class="border-t border-surface-200 px-4 py-2 text-sm text-danger-600 dark:border-surface-700 dark:text-danger-300"
				>
					Couldn't save the order. Try again.
				</p>
			{/if}
		{:else}
			<div class="p-4 md:p-5">
				<p class="font-display text-xl text-surface-900 dark:text-surface-100">No warm-up yet</p>
				<p class="mt-1 max-w-prose text-sm text-surface-500 dark:text-surface-300">
					Add the exercises you warm up with, then run them in order with a timer. Each one can have
					its own chart, tab or backing track.
				</p>
			</div>
		{/if}

		<form
			method="POST"
			action="?/create"
			use:enhance
			class="{panelFooter} flex flex-wrap items-end gap-2 p-4 md:px-5 {routine.length > 0
				? ''
				: 'border-t-0 bg-transparent pt-0 dark:bg-transparent'}"
		>
			<label class="min-w-32 flex-1">
				<span class={fieldLabel}>New exercise</span>
				<input
					name="title"
					required
					maxlength="120"
					placeholder="Chromatic run"
					class="{field} mt-1"
				/>
			</label>
			<label class="w-20">
				<span class={fieldLabel}>Minutes</span>
				<input
					name="minutes"
					type="number"
					min="0.5"
					max="240"
					step="0.5"
					value="2"
					required
					class="{field} mt-1"
				/>
			</label>
			<button type="submit" class={primaryButton}>Add</button>
			{#if form?.error}
				<p role="alert" class="w-full text-sm text-danger-600 dark:text-danger-300">
					{form.error}
				</p>
			{/if}
		</form>
	</div>

	{#if data.others.length > 0}
		<section class="min-w-0" aria-label="Other exercises">
			<h2 class={sectionHeading}>Other exercises</h2>
			<ul class="{panel} {panelRows} mt-2 overflow-hidden">
				{#each data.others as exercise (exercise.id)}
					<li class="{rowClass} md:pl-4">
						{@render details(exercise)}
						<form method="POST" action="?/addToRoutine" use:enhance>
							<input type="hidden" name="id" value={exercise.id} />
							<button
								type="submit"
								aria-label="Add {exercise.title} to the routine"
								title="Add to the routine"
								class={iconButton}
							>
								<svg
									width="16"
									height="16"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									aria-hidden="true"
								>
									<path d="M12 5v14M5 12h14" />
								</svg>
							</button>
						</form>
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</div>
