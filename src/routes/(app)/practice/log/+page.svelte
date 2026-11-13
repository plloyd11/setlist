<script lang="ts">
	import { onMount } from 'svelte';
	import type { SubmitFunction } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { navigating, page } from '$app/state';
	import Digits from '#lib/components/ui/Digits.svelte';
	import { amendJournal } from '#lib/components/practice/practiceTracker.svelte.js';
	import LogBoard from '#lib/components/practice/log/LogBoard.svelte';
	import MostPracticed from '#lib/components/practice/log/MostPracticed.svelte';
	import StatusChip from '#lib/components/practice/StatusChip.svelte';
	import {
		panel,
		panelRows,
		primaryButton,
		rowLink,
		secondaryButton,
		sectionHeading
	} from '#lib/components/practice/practiceStyles.js';
	import { formatDuration } from '#lib/utils/duration.js';
	import { TIME_ZONE_COOKIE } from '#lib/utils/gigDate.js';
	import { KIND_NAMES, type LogKind } from '#lib/utils/practiceLog.js';
	import { formatPracticeTime } from '#lib/utils/practiceTime.js';

	let { data, form } = $props();

	onMount(() => {
		// Tell the server which day it is here, or an evening's practice in the US lands
		// on tomorrow's bar
		const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		if (zone && zone !== data.timeZone) {
			document.cookie = `${TIME_ZONE_COOKIE}=${encodeURIComponent(zone)};path=/;max-age=31536000;SameSite=Lax`;
			invalidateAll();
		}
	});

	// One type on its own: the board's legend sets it, and the lists below follow
	let kind = $state<LogKind | null>(null);
	let sessions = $derived(
		kind
			? data.sessions
					.map((s) => ({ ...s, items: s.items.filter((item) => item.type === kind) }))
					.filter((s) => s.items.length > 0)
			: data.sessions
	);
	// Paging to another week, month or year keeps this one on screen until it lands
	let loading = $derived(navigating.to?.url.pathname === page.url.pathname);
	let unit = $derived(data.log.period.range);

	// One session is corrected at a time: its rows turn into fields, and nothing is
	// changed or removed until Save
	let editing = $state<string | null>(null);
	let removed = $state<string[]>([]);
	let saving = $state(false);

	function edit(sessionId: string | null) {
		editing = sessionId;
		removed = [];
	}

	const saveEdit: SubmitFunction = () => {
		saving = true;
		return async ({ result, update }) => {
			const userId = page.data.user?.id;
			if (result.type === 'success' && result.data?.edited && userId) {
				// Or the clock's next save from this browser would put the old time back
				amendJournal(userId, result.data.edited);
			}
			await update({ reset: false });
			saving = false;
			if (result.type === 'success') edit(null);
		};
	};

	const smallButton =
		'focus-live rounded-md px-2 py-1 text-xs font-medium text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-700';

	const total = (items: { practice_seconds: number }[]) =>
		items.reduce((sum, item) => sum + item.practice_seconds, 0);

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

{#if !data.log.earliest && data.todos.length === 0}
	<div class="{panel} p-4 md:p-5">
		<p class="font-display text-xl text-surface-900 dark:text-surface-100">Nothing logged yet</p>
		<p class="mt-1 max-w-prose text-sm text-surface-500 dark:text-surface-300">
			Start the clock on a song, a warm-up or a technique and the time shows up here, by week, month
			and year. Only you can see this.
		</p>
		<div class="mt-4 flex flex-wrap gap-2">
			<a href="/practice/shed" class="{primaryButton} inline-flex items-center">Pick a song</a>
			<a href="/practice/warm-up" class="{secondaryButton} inline-flex items-center">
				Set up a warm-up
			</a>
		</div>
	</div>
{:else}
	<!-- On a phone: the board, what got the time, then session by session. Anywhere wider
	     the side lists sit beside both. The second row takes any spare height, so a long
	     rail never opens a gap between the board and the sessions. -->
	<div
		class="grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-[minmax(0,1fr)_20rem] md:grid-rows-[auto_1fr] md:items-start"
	>
		<div class="min-w-0 md:col-start-1 md:row-start-1">
			<LogBoard log={data.log} bind:kind {loading} />
		</div>

		<div class="flex min-w-0 flex-col gap-6 md:col-start-2 md:row-span-2 md:row-start-1">
			<MostPracticed items={data.log.items} {kind} />

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

		{#if sessions.length > 0}
			<section class="min-w-0 md:col-start-1 md:row-start-2" aria-label="Sessions">
				<h2 class={sectionHeading}>
					Sessions{#if kind}
						<span class="text-sm font-normal text-surface-500 dark:text-surface-300">
							· {KIND_NAMES[kind].toLowerCase()} only
						</span>
					{/if}
				</h2>
				<ol
					class="{panel} {panelRows} mt-2 transition-opacity duration-150 {loading
						? 'opacity-50'
						: ''}"
				>
					{#each sessions as session (session.id)}
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
								{#if editing !== session.id}
									<button
										type="button"
										onclick={() => edit(session.id)}
										aria-label="Edit time on {weekday(session.startedAt)}, {monthDay(
											session.startedAt
										)}"
										class="{smallButton} mt-1 -ml-2"
									>
										Edit
									</button>
								{/if}
							</div>
							{#if editing === session.id}
								<form method="POST" action="?/edit" use:enhance={saveEdit} class="min-w-0">
									<input type="hidden" name="session" value={session.id} />
									<ul class="flex flex-col gap-2">
										{#each session.items as item (item.id)}
											{@const gone = removed.includes(item.id)}
											<li class="flex min-h-9 items-center gap-2 text-sm">
												<span
													class="min-w-0 flex-1 truncate {gone
														? 'text-surface-500 line-through dark:text-surface-300'
														: 'text-surface-700 dark:text-surface-200'}"
												>
													{item.label}
												</span>
												{#if gone}
													<!-- Not "remove": a field's name shadows the form's own method of that
														     name, which is how Svelte takes the form off the page -->
													<input type="hidden" name="removed" value={item.id} />
													<button
														type="button"
														onclick={() => (removed = removed.filter((id) => id !== item.id))}
														aria-label="Keep {item.label}"
														class="{smallButton} shrink-0"
													>
														Undo
													</button>
												{:else}
													<label class="flex shrink-0 items-center gap-1.5">
														<span class="sr-only">Minutes on {item.label}</span>
														<input
															name="minutes-{item.id}"
															type="number"
															inputmode="numeric"
															min="0"
															max="1440"
															step="1"
															required
															value={Math.round(item.practice_seconds / 60)}
															class="focus-live h-9 w-16 rounded-lg border border-surface-300 bg-surface-50 px-2 text-right text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100"
														/>
														<span
															aria-hidden="true"
															class="text-xs text-surface-500 dark:text-surface-300"
														>
															min
														</span>
													</label>
													<button
														type="button"
														onclick={() => (removed = [...removed, item.id])}
														aria-label="Remove {item.label}"
														class="{smallButton} shrink-0"
													>
														Remove
													</button>
												{/if}
											</li>
										{/each}
									</ul>
									{#if form?.error}
										<p role="alert" class="mt-2 text-sm text-danger-600 dark:text-danger-300">
											{form.error}
										</p>
									{/if}
									<div class="mt-3 flex justify-end gap-2">
										<button type="button" onclick={() => edit(null)} class={secondaryButton}>
											Cancel
										</button>
										<button
											type="submit"
											disabled={saving}
											class="{primaryButton} disabled:opacity-50"
										>
											{saving ? 'Saving…' : 'Save'}
										</button>
									</div>
								</form>
							{:else}
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
							{/if}
						</li>
					{/each}
				</ol>
				{#if data.log.sessionCount > data.sessions.length}
					<p class="mt-2 text-sm text-surface-500 dark:text-surface-300">
						The latest {data.sessions.length} of {data.log.sessionCount} sessions this {unit}. Open
						a month for the rest.
					</p>
				{/if}
			</section>
		{/if}
	</div>
{/if}
