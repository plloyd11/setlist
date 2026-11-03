<script lang="ts">
	import { enhance } from '$app/forms';
	import { INSTRUMENTS } from '#lib/practice/curatedTechniques.js';

	let { data, form } = $props();

	let instrumentForm: HTMLFormElement | undefined = $state();

	const listClass =
		'mt-3 divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-surface-50 dark:divide-surface-700 dark:border-surface-700 dark:bg-surface-800/50';
	const headingClass = 'font-display text-lg font-semibold text-surface-900 dark:text-surface-100';
</script>

<svelte:head>
	<title>Techniques — Setlist</title>
</svelte:head>

{#if form?.error}
	<p role="alert" class="mb-4 text-sm text-danger-600 dark:text-danger-400">{form.error}</p>
{/if}

{#if data.mine.length > 0}
	<section aria-label="Your techniques" class="mb-8">
		<h2 class={headingClass}>Working on</h2>
		<ul class={listClass}>
			{#each data.mine as skill (skill.id)}
				<li>
					<a
						href="/practice/techniques/{skill.id}"
						class="focus-live flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-800"
					>
						<span
							class="min-w-0 flex-1 truncate text-sm font-medium text-surface-900 dark:text-surface-100"
						>
							{skill.title}
						</span>
						{#if skill.bestBpm > 0}
							<span class="shrink-0 text-sm text-surface-500 tabular-nums dark:text-surface-300">
								{skill.bestBpm}{skill.goalBpm ? ` / ${skill.goalBpm}` : ''} BPM
							</span>
						{:else if skill.goalBpm}
							<span class="shrink-0 text-sm text-surface-500 tabular-nums dark:text-surface-300">
								Goal {skill.goalBpm} BPM
							</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<form method="POST" action="?/create" use:enhance class="mb-8 flex items-end gap-2">
	<label class="min-w-0 flex-1">
		<span
			class="text-[10px] font-medium tracking-wider text-surface-500 uppercase dark:text-surface-300"
		>
			Something you want to work on
		</span>
		<input
			name="title"
			required
			maxlength="120"
			placeholder="Sweep picking"
			class="focus-live mt-1 block min-h-11 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 text-sm text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
		/>
	</label>
	<button
		type="submit"
		class="focus-live min-h-11 rounded-lg bg-accent-500 px-4 font-semibold text-white shadow-sm hover:bg-accent-600"
	>
		Add
	</button>
</form>

<section aria-label="Lessons">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2 class={headingClass}>Lessons</h2>
		<form bind:this={instrumentForm} method="POST" action="?/setInstrument" use:enhance>
			<label class="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-300">
				I play
				<select
					name="instrument"
					value={data.instrument ?? ''}
					onchange={() => instrumentForm?.requestSubmit()}
					class="focus-live min-h-11 rounded-lg border border-surface-300 bg-surface-50 px-2 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100"
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
		<ul class={listClass}>
			{#each data.lessons as lesson (lesson.key)}
				<li class="flex items-center gap-3 px-4 py-2">
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-surface-900 dark:text-surface-100">{lesson.title}</p>
						<p class="text-xs text-surface-500 dark:text-surface-300">{lesson.summary}</p>
					</div>
					<form method="POST" action="?/startLesson" use:enhance>
						<input type="hidden" name="key" value={lesson.key} />
						<button
							type="submit"
							aria-label="Start {lesson.title}"
							class="focus-live min-h-11 rounded-lg border border-surface-300 px-3 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:border-surface-600 dark:text-surface-300 dark:hover:bg-surface-800"
						>
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
