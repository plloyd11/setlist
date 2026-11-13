<script lang="ts">
	import Digits from '#lib/components/ui/Digits.svelte';
	import {
		KIND_TONES,
		panel,
		panelFooter,
		panelRows,
		rowLink,
		sectionHeading
	} from '#lib/components/practice/practiceStyles.js';
	import { formatPracticeTime } from '#lib/utils/practiceTime.js';
	import { KIND_NAMES, type LogItem, type LogKind } from '#lib/utils/practiceLog.js';

	let { items, kind = null }: { items: LogItem[]; kind?: LogKind | null } = $props();

	const SHOWN = 6;

	let all = $derived(kind ? items.filter((item) => item.kind === kind) : items);
	let expanded = $state(false);
	let shown = $derived(expanded ? all : all.slice(0, SHOWN));
	/** Bars are drawn against the top of the list, so the list is its own chart */
	let most = $derived(Math.max(1, ...all.map((item) => item.seconds)));
</script>

{#snippet row(item: LogItem)}
	<span class="h-3 w-3 shrink-0 rounded-[3px] {KIND_TONES[item.kind]}" aria-hidden="true"></span>
	<span class="min-w-0 flex-1">
		<span class="flex items-baseline justify-between gap-3">
			<span class="min-w-0 truncate text-sm font-medium text-surface-900 dark:text-surface-100">
				<span class="sr-only">{KIND_NAMES[item.kind]}:</span>
				{item.label}
			</span>
			<span class="shrink-0 text-sm font-semibold text-surface-800 dark:text-surface-100">
				<Digits value={formatPracticeTime(item.seconds)} />
			</span>
		</span>
		<span class="mt-1.5 flex items-center gap-3">
			<span class="flex h-1 min-w-0 flex-1" aria-hidden="true">
				<span
					class="min-w-1 rounded-full {KIND_TONES[item.kind]}"
					style="width: {(item.seconds / most) * 100}%"
				></span>
			</span>
			<span class="shrink-0 text-xs text-surface-500 dark:text-surface-300">
				{item.days}
				{item.days === 1 ? 'day' : 'days'}
			</span>
		</span>
	</span>
{/snippet}

{#if all.length > 0}
	<section aria-label="Most practiced">
		<h2 class={sectionHeading}>Most practiced</h2>
		<div class="{panel} mt-2 overflow-hidden">
			<ol class={panelRows}>
				{#each shown as item (item.key)}
					<li>
						{#if item.href}
							<a href={item.href} class="{rowLink} py-2.5">{@render row(item)}</a>
						{:else}
							<div class="flex min-h-12 items-center gap-3 px-4 py-2.5">{@render row(item)}</div>
						{/if}
					</li>
				{/each}
			</ol>
			{#if all.length > SHOWN}
				<div class={panelFooter}>
					<button
						type="button"
						aria-expanded={expanded}
						onclick={() => (expanded = !expanded)}
						class="focus-inset flex min-h-11 w-full items-center px-4 text-sm font-medium text-surface-700 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-700/50"
					>
						{expanded ? 'Show fewer' : `Show all ${all.length}`}
					</button>
				</div>
			{/if}
		</div>
	</section>
{/if}
