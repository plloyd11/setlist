<script lang="ts">
	import Digits from '#lib/components/ui/Digits.svelte';
	import StatusChip from '#lib/components/practice/StatusChip.svelte';
	import WeekStrip from '#lib/components/practice/WeekStrip.svelte';
	import {
		panel,
		panelRows,
		rowLink,
		sectionHeading
	} from '#lib/components/practice/practiceStyles.js';
	import { formatDuration } from '#lib/utils/duration.js';
	import { formatPracticeTime } from '#lib/utils/practiceTime.js';

	let { data } = $props();

	const total = (items: { practice_seconds: number }[]) =>
		items.reduce((sum, item) => sum + item.practice_seconds, 0);

	let week = $derived(
		data.sessions.map((s) => ({ startedAt: s.startedAt, seconds: total(s.items) }))
	);

	function hrefFor(item: {
		song_id: string | null;
		exercise_id: string | null;
		skill_id: string | null;
	}): string | null {
		if (item.song_id) return `/songs/${item.song_id}/practice?from=/practice/log`;
		if (item.exercise_id) return `/exercises/${item.exercise_id}?from=/practice/log`;
		if (item.skill_id) return `/practice/techniques/${item.skill_id}`;
		return null;
	}

	const weekday = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
	const monthDay = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
</script>

<svelte:head>
	<title>Practice log · Setlist</title>
</svelte:head>

{#if data.sessions.length === 0 && data.todos.length === 0}
	<div class="{panel} p-4 md:p-5">
		<p class="font-display text-xl text-surface-900 dark:text-surface-100">Nothing logged yet</p>
		<p class="mt-1 max-w-prose text-sm text-surface-500 dark:text-surface-300">
			Spend a little time on a song, a warm-up or a skill and it shows up here. Only you can see
			this.
		</p>
	</div>
{:else}
	<div
		class="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_20rem] md:items-start"
	>
		<!-- Where you are before where you've been, on a phone. Beside the log anywhere wider. -->
		<div class="flex min-w-0 flex-col gap-6 md:col-start-2 md:row-start-1">
			<WeekStrip sessions={week} />

			{#if data.todos.length > 0}
				<section aria-label="To work on">
					<h2 class={sectionHeading}>To work on</h2>
					<ul class="{panel} {panelRows} mt-2 overflow-hidden">
						{#each data.todos as todo (todo.songId)}
							<li>
								<a href="/songs/{todo.songId}/practice?from=/practice/log" class={rowLink}>
									<span class="min-w-0 flex-1">
										<span class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
											<span
												class="max-w-full truncate text-sm font-medium text-surface-900 dark:text-surface-100"
											>
												{todo.title}
											</span>
											<StatusChip status={todo.status} />
										</span>
										{#if todo.note}
											<span
												class="mt-0.5 block truncate text-xs text-surface-500 dark:text-surface-300"
											>
												{todo.note}
											</span>
										{/if}
									</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>

		{#if data.sessions.length > 0}
			<section class="min-w-0 md:col-start-1 md:row-start-1" aria-label="Sessions">
				<h2 class={sectionHeading}>Sessions</h2>
				<ol class="{panel} {panelRows} mt-2">
					{#each data.sessions as session (session.id)}
						<li class="grid grid-cols-[4rem_minmax(0,1fr)] gap-x-4 px-4 py-3.5">
							<div>
								<p
									class="font-display text-base leading-tight font-semibold text-surface-900 dark:text-surface-100"
								>
									{weekday(session.startedAt)}
								</p>
								<p class="text-xs text-surface-500 dark:text-surface-300">
									{monthDay(session.startedAt)}
								</p>
								<p class="mt-1.5 text-sm font-semibold text-surface-800 dark:text-surface-100">
									{formatPracticeTime(total(session.items))}
								</p>
							</div>
							<ul class="flex min-w-0 flex-col gap-1.5">
								{#each session.items as item (item.id)}
									{@const href = hrefFor(item)}
									<li
										class="flex items-baseline justify-between gap-3 text-sm text-surface-700 dark:text-surface-200"
									>
										{#if href}
											<a
												{href}
												class="focus-live -my-3 min-w-0 truncate py-3 hover:underline md:my-0 md:py-0"
											>
												{item.label}
											</a>
										{:else}
											<span class="min-w-0 truncate">{item.label}</span>
										{/if}
										<span class="shrink-0 text-surface-500 dark:text-surface-300">
											{#if item.run_seconds}
												<span class="text-xs">timed {formatDuration(item.run_seconds)} ·</span>
											{/if}
											<Digits value={formatPracticeTime(item.practice_seconds)} />
										</span>
									</li>
								{/each}
							</ul>
						</li>
					{/each}
				</ol>
			</section>
		{/if}
	</div>
{/if}
