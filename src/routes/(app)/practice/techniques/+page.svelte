<script lang="ts">
	import { enhance } from '$app/forms';
	import TempoMeter from '#lib/components/practice/TempoMeter.svelte';
	import {
		field,
		fieldLabel,
		panel,
		panelFooter,
		panelRows,
		primaryButton,
		secondaryButton,
		sectionHeading
	} from '#lib/components/practice/practiceStyles.js';
	import { INSTRUMENTS } from '#lib/practice/curatedTechniques.js';

	let { data, form } = $props();

	let instrumentForm: HTMLFormElement | undefined = $state();
</script>

<svelte:head>
	<title>Techniques · Setlist</title>
</svelte:head>

{#if form?.error}
	<p role="alert" class="mb-4 text-sm text-danger-600 dark:text-danger-300">{form.error}</p>
{/if}

<div class="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start">
	<section aria-label="Your techniques" class="min-w-0">
		<!-- As tall as the Lessons header with its select, so the two panels start level -->
		<h2 class="flex min-h-11 items-center {sectionHeading}">Working on</h2>
		<div class="{panel} mt-2 overflow-hidden">
			{#if data.mine.length > 0}
				<ul class={panelRows}>
					{#each data.mine as skill (skill.id)}
						<li>
							<a
								href="/practice/techniques/{skill.id}"
								class="focus-inset block px-4 py-3 transition-[background-color] duration-150 hover:bg-surface-100 dark:hover:bg-surface-700/50"
							>
								<span class="flex items-baseline justify-between gap-3">
									<span
										class="min-w-0 truncate text-sm font-medium text-surface-900 dark:text-surface-100"
									>
										{skill.title}
									</span>
									{#if skill.bestBpm > 0}
										<span class="shrink-0 text-sm text-surface-500 dark:text-surface-300">
											<span class="font-medium text-surface-800 dark:text-surface-100"
												>{skill.bestBpm}</span
											>{skill.goalBpm ? ` / ${skill.goalBpm}` : ''} BPM
										</span>
									{:else if skill.goalBpm}
										<span class="shrink-0 text-sm text-surface-500 dark:text-surface-300">
											Goal {skill.goalBpm} BPM
										</span>
									{/if}
								</span>
								{#if skill.goalBpm}
									<span class="mt-2 block">
										<TempoMeter best={skill.bestBpm} goal={skill.goalBpm} />
									</span>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="px-4 py-4 text-sm text-surface-500 dark:text-surface-300">
					Nothing yet. Start a lesson, or name your own below and track its tempo.
				</p>
			{/if}
			<form
				method="POST"
				action="?/create"
				use:enhance
				class="{panelFooter} flex items-end gap-2 p-4"
			>
				<label class="min-w-0 flex-1">
					<span class={fieldLabel}>Something you want to work on</span>
					<input
						name="title"
						required
						maxlength="120"
						placeholder="Sweep picking"
						class="{field} mt-1"
					/>
				</label>
				<button type="submit" class={primaryButton}>Add</button>
			</form>
		</div>
	</section>

	<section aria-label="Lessons" class="min-w-0">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<h2 class={sectionHeading}>Lessons</h2>
			<form bind:this={instrumentForm} method="POST" action="?/setInstrument" use:enhance>
				<label class="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
					I play
					<select
						name="instrument"
						value={data.instrument ?? ''}
						onchange={() => instrumentForm?.requestSubmit()}
						class="focus-live min-h-11 rounded-lg border border-surface-300 bg-surface-50 px-2 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100"
					>
						<option value="">Not set</option>
						{#each INSTRUMENTS as instrument (instrument.value)}
							<option value={instrument.value}>{instrument.label}</option>
						{/each}
					</select>
				</label>
			</form>
		</div>
		{#if data.lessons.length > 0}
			<ul class="{panel} {panelRows} mt-2 overflow-hidden">
				{#each data.lessons as lesson (lesson.key)}
					<li class="flex items-center gap-3 px-4 py-3">
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium text-surface-900 dark:text-surface-100">
								{lesson.title}
							</p>
							<p class="mt-0.5 text-xs text-surface-500 dark:text-surface-300">{lesson.summary}</p>
						</div>
						<form method="POST" action="?/startLesson" use:enhance>
							<input type="hidden" name="key" value={lesson.key} />
							<button type="submit" aria-label="Start {lesson.title}" class={secondaryButton}>
								Start
							</button>
						</form>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="mt-3 text-sm text-surface-500 dark:text-surface-300">
				You've started every lesson for your instrument.
			</p>
		{/if}
	</section>
</div>
