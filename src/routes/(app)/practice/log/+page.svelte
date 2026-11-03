<script lang="ts">
	import { formatDuration } from '#lib/utils/duration.js';
	import { formatPracticeTime, startOfWeek } from '#lib/utils/practiceTime.js';

	let { data } = $props();

	const total = (items: { practice_seconds: number }[]) =>
		items.reduce((sum, item) => sum + item.practice_seconds, 0);

	let thisWeek = $derived.by(() => {
		const start = startOfWeek(new Date()).getTime();
		return data.sessions
			.filter((s) => Date.parse(s.startedAt) >= start)
			.reduce((sum, s) => sum + total(s.items), 0);
	});

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

	const sessionDate = (iso: string) =>
		new Date(iso).toLocaleDateString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
</script>

<svelte:head>
	<title>Practice log — Setlist</title>
</svelte:head>

{#if data.sessions.length === 0 && data.todos.length === 0}
	<p class="font-display text-xl text-surface-900 dark:text-surface-100">Nothing logged yet</p>
	<p class="mt-1 max-w-prose text-sm text-surface-500 dark:text-surface-300">
		Spend a little time on a song, a warm-up or a skill and it shows up here. Only you can see this.
	</p>
{:else}
	<p class="text-sm text-surface-600 dark:text-surface-300">
		This week
		<span
			class="ml-1 font-display text-2xl font-bold text-accent-600 tabular-nums dark:text-accent-hot"
		>
			{formatPracticeTime(thisWeek)}
		</span>
	</p>

	{#if data.todos.length > 0}
		<section class="mt-8" aria-label="To work on">
			<h2 class="font-display text-lg font-semibold text-surface-900 dark:text-surface-100">
				To work on
			</h2>
			<ul
				class="mt-3 divide-y divide-surface-200 overflow-hidden rounded-xl border border-surface-200 bg-surface-50 dark:divide-surface-700 dark:border-surface-700 dark:bg-surface-800/50"
			>
				{#each data.todos as todo (todo.songId)}
					<li>
						<a
							href="/songs/{todo.songId}/practice?from=/practice/log"
							class="focus-live flex min-h-12 items-center gap-3 px-4 py-2 hover:bg-surface-100 dark:hover:bg-surface-800"
						>
							<span class="min-w-0 flex-1">
								<span
									class="block truncate text-sm font-medium text-surface-900 dark:text-surface-100"
								>
									{todo.title}
								</span>
								{#if todo.note}
									<span class="block truncate text-xs text-surface-500 dark:text-surface-300">
										{todo.note}
									</span>
								{/if}
							</span>
							<span class="shrink-0 text-xs text-surface-500 dark:text-surface-300">
								{todo.status === 'needs_work' ? 'Needs work' : 'Learning'}
							</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if data.sessions.length > 0}
		<section class="mt-8" aria-label="Sessions">
			<h2 class="font-display text-lg font-semibold text-surface-900 dark:text-surface-100">
				Sessions
			</h2>
			<ol class="mt-3 space-y-4">
				{#each data.sessions as session (session.id)}
					<li>
						<p
							class="flex justify-between text-sm font-medium text-surface-700 dark:text-surface-300"
						>
							<span>{sessionDate(session.startedAt)}</span>
							<span class="tabular-nums">{formatPracticeTime(total(session.items))}</span>
						</p>
						<ul class="mt-1">
							{#each session.items as item (item.id)}
								{@const href = hrefFor(item)}
								<li
									class="flex items-center justify-between gap-3 py-0.5 text-sm text-surface-500 dark:text-surface-300"
								>
									{#if href}
										<a {href} class="focus-live min-w-0 truncate hover:underline">
											{item.label}
										</a>
									{:else}
										<span class="min-w-0 truncate">{item.label}</span>
									{/if}
									<span class="shrink-0 tabular-nums">
										{#if item.run_seconds}
											timed {formatDuration(item.run_seconds)} ·
										{/if}
										{formatPracticeTime(item.practice_seconds)}
									</span>
								</li>
							{/each}
						</ul>
					</li>
				{/each}
			</ol>
		</section>
	{/if}
{/if}
