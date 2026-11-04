<script lang="ts">
	import Digits from '#lib/components/ui/Digits.svelte';
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Metronome from '#lib/components/practice/Metronome.svelte';
	import TempoMeter from '#lib/components/practice/TempoMeter.svelte';
	import {
		field,
		fieldLabel,
		microLabel,
		panel,
		panelFooter,
		panelRows,
		primaryButton,
		reading,
		secondaryButton,
		sectionHeading
	} from '#lib/components/practice/practiceStyles.js';
	import PlanBar from '#lib/components/practice/PlanBar.svelte';
	import ConfirmDialog from '#lib/components/ui/ConfirmDialog.svelte';
	import { PracticeTracker } from '#lib/components/practice/practiceTracker.svelte.js';
	import { formatDuration } from '#lib/utils/duration.js';
	import { formatPracticeTime } from '#lib/utils/practiceTime.js';
	import { startPlan } from '#lib/utils/practicePlan.js';

	let { data, form } = $props();

	let tracker = $state<PracticeTracker | null>(null);
	let metronomeRunning = $state(false);
	let confirmDialog: ConfirmDialog | undefined = $state();
	let deleteForm: HTMLFormElement | undefined = $state();

	let bestBpm = $derived(Math.max(0, ...data.logs.map((log) => log.bpm)));
	let goal = $derived(data.skill.goal_bpm);
	let fromHere = $derived(`/practice/techniques/${data.skill.id}`);

	onMount(() => {
		const userId = page.data.user?.id;
		if (userId) {
			tracker = new PracticeTracker(
				userId,
				{ kind: 'skill', refId: data.skill.id, label: data.skill.title },
				() => metronomeRunning
			);
			tracker.start();
		}
		return () => tracker?.stop();
	});

	function practiceDrills() {
		const steps = data.drills.map((drill) => ({
			href: `/exercises/${drill.id}?from=${fromHere}`,
			label: drill.title
		}));
		startPlan(steps);
		goto(steps[0].href);
	}

	async function handleDelete() {
		const confirmed = await confirmDialog?.confirm(
			'Delete this technique?',
			`"${data.skill.title}" and its tempo log will be gone. Its drills stay in your exercises.`
		);
		if (confirmed) deleteForm?.requestSubmit();
	}

	const smallButton =
		'focus-live min-h-11 rounded-lg px-3 text-sm text-surface-500 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800';
</script>

<svelte:head>
	<title>{data.skill.title} · Techniques</title>
</svelte:head>

<div class="flex flex-wrap items-center justify-between gap-2">
	<a
		href="/practice/techniques"
		class="focus-live flex min-h-11 items-center text-sm font-medium text-surface-500 hover:text-surface-700 dark:text-surface-300 dark:hover:text-surface-100"
	>
		All techniques
	</a>
	<div class="flex min-w-0 items-center gap-3">
		<PlanBar />
		{#if tracker}
			<p
				data-testid="practice-clock"
				class="font-display text-lg font-bold text-accent-600 dark:text-accent-hot"
			>
				<span class="sr-only">Practiced </span><Digits
					value={formatDuration(Math.floor(tracker.seconds))}
				/>
			</p>
		{/if}
	</div>
</div>

<h2
	class="mt-1 font-display text-2xl leading-tight font-bold text-balance break-words text-surface-900 md:text-3xl dark:text-surface-100"
>
	{data.skill.title}
</h2>

{#if form?.error}
	<p role="alert" class="mt-3 text-sm text-danger-600 dark:text-danger-300">{form.error}</p>
{/if}

<div
	class="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start"
>
	<div class="min-w-0">
		{#if data.lesson}
			<section aria-label="Lesson">
				<p class="max-w-prose text-base text-surface-800 dark:text-surface-200">
					{data.lesson.summary}
				</p>
				<p class="mt-2 max-w-prose text-sm text-surface-600 dark:text-surface-300">
					{data.lesson.why}
				</p>
				<h3 class="mt-5 text-sm font-semibold text-surface-900 dark:text-surface-100">
					How to do it
				</h3>
				<ol
					class="mt-2 max-w-prose list-decimal space-y-1.5 pl-5 text-sm text-surface-700 dark:text-surface-300"
				>
					{#each data.lesson.steps as step, i (i)}
						<li>{step}</li>
					{/each}
				</ol>
				<h3 class="mt-5 text-sm font-semibold text-surface-900 dark:text-surface-100">
					Watch out for
				</h3>
				<ul
					class="mt-2 max-w-prose list-disc space-y-1.5 pl-5 text-sm text-surface-700 dark:text-surface-300"
				>
					{#each data.lesson.mistakes as mistake, i (i)}
						<li>{mistake}</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section aria-label="Drills" class={data.lesson ? 'mt-8' : ''}>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<h3 class={sectionHeading}>Drills</h3>
				{#if data.drills.length > 0}
					<button type="button" onclick={practiceDrills} class={primaryButton}>
						Practice these
					</button>
				{/if}
			</div>
			<div class="{panel} mt-2 overflow-hidden">
				{#if data.drills.length > 0}
					<ul class={panelRows}>
						{#each data.drills as drill (drill.id)}
							<li class="flex min-h-12 items-center gap-2 px-3 py-1.5">
								<a
									href="/exercises/{drill.id}?from={fromHere}"
									class="focus-live min-w-0 flex-1 truncate text-sm font-medium text-surface-900 hover:underline dark:text-surface-100 pointer-coarse:-my-3 pointer-coarse:py-3"
								>
									{drill.title}
								</a>
								<span class="shrink-0 text-sm text-surface-500 dark:text-surface-300">
									{formatPracticeTime(drill.target_seconds)}
								</span>
								{#if drill.routine_position === null}
									<form method="POST" action="?/addToWarmUp" use:enhance>
										<input type="hidden" name="id" value={drill.id} />
										<button
											type="submit"
											aria-label="Add {drill.title} to my warm-up"
											class={smallButton}
										>
											Add to warm-up
										</button>
									</form>
								{:else}
									<span class="shrink-0 px-3 text-xs text-surface-500 dark:text-surface-300">
										In warm-up
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="px-4 py-4 text-sm text-surface-500 dark:text-surface-300">
						Add a drill, then attach a chart, tab or backing track to it.
					</p>
				{/if}
				<form
					method="POST"
					action="?/addDrill"
					use:enhance
					class="{panelFooter} flex flex-wrap items-end gap-2 p-4"
				>
					<label class="min-w-32 flex-1">
						<span class={fieldLabel}>New drill</span>
						<input name="title" required maxlength="120" class="{field} mt-1" />
					</label>
					<label class="w-20">
						<span class={fieldLabel}>Minutes</span>
						<input
							name="minutes"
							type="number"
							min="0.5"
							max="240"
							step="0.5"
							value="3"
							required
							class="{field} mt-1"
						/>
					</label>
					<button type="submit" class={secondaryButton}>Add</button>
				</form>
			</div>
		</section>

		<section aria-label="Your notes" class="mt-8">
			<form method="POST" action="?/update" use:enhance class="flex flex-col gap-2">
				<label>
					<span class={fieldLabel}>Your notes</span>
					<textarea name="notes" rows="3" class="{field} mt-1 py-2" value={data.skill.notes ?? ''}
					></textarea>
				</label>
				<label class="w-32">
					<span class={fieldLabel}>Tempo goal (BPM)</span>
					<input
						name="goal_bpm"
						type="number"
						min="1"
						max="400"
						value={data.skill.goal_bpm ?? ''}
						class="{field} mt-1"
					/>
				</label>
				<div class="flex items-center justify-between gap-2">
					<button type="submit" class={secondaryButton}>Save</button>
					<button
						type="button"
						onclick={handleDelete}
						class="focus-live min-h-11 rounded-lg px-3 text-sm font-medium text-danger-600 hover:bg-surface-100 dark:text-danger-300 dark:hover:bg-surface-800"
					>
						Delete technique
					</button>
				</div>
			</form>
			<form
				bind:this={deleteForm}
				method="POST"
				action="?/delete"
				use:enhance
				class="hidden"
			></form>
		</section>
	</div>

	<div class="flex flex-col gap-4">
		<Metronome songId={data.skill.id} onrunningchange={(running) => (metronomeRunning = running)} />

		<section aria-label="Tempo progress" class="{panel} px-4 py-3.5">
			<h3 class={microLabel}>Cleanest tempo so far</h3>
			<p data-testid="best-bpm" class="mt-1.5 {reading} text-3xl">
				{bestBpm || '--'}{#if goal}<span
						class="ml-1 text-base font-medium text-surface-500 dark:text-surface-300"
						>/ {goal} BPM</span
					>{/if}
			</p>
			{#if goal}
				<div class="mt-2.5">
					<TempoMeter best={bestBpm} {goal} label="Progress to your tempo goal" />
				</div>
			{/if}
			<form method="POST" action="?/logTempo" use:enhance class="mt-3 flex items-end gap-2">
				<label class="min-w-0 flex-1">
					<span class={fieldLabel}>Played it clean at</span>
					<input
						name="bpm"
						type="number"
						min="1"
						max="400"
						required
						placeholder="BPM"
						class="{field} mt-1"
					/>
				</label>
				<button type="submit" class={secondaryButton}>Log</button>
			</form>
			{#if data.logs.length > 0}
				<ul class="mt-3 flex flex-col gap-0.5 text-sm text-surface-500 dark:text-surface-300">
					{#each data.logs.slice(0, 5) as log (log.id)}
						<li class="flex justify-between">
							<span
								>{new Date(log.logged_at).toLocaleDateString(undefined, {
									month: 'short',
									day: 'numeric'
								})}</span
							>
							<span>{log.bpm} BPM</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>
</div>

<ConfirmDialog bind:this={confirmDialog} />
