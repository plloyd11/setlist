<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { clearPlan, planFor, type Plan } from '#lib/utils/practicePlan.js';

	let plan = $state<Plan | null>(null);

	onMount(() => {
		plan = planFor(page.url.pathname);
	});

	let next = $derived(plan ? (plan.steps[plan.index + 1] ?? null) : null);
</script>

{#if plan}
	<nav
		aria-label="Practice session"
		class="flex min-w-0 items-center gap-2 text-sm text-surface-600 dark:text-surface-300"
	>
		<span class="shrink-0">{plan.index + 1} of {plan.steps.length}</span>
		{#if next}
			<a
				href={next.href}
				class="focus-live flex min-h-11 min-w-0 items-center gap-1 rounded-lg bg-accent-500 px-3 font-semibold text-white shadow-sm hover:bg-accent-600"
			>
				<span class="shrink-0">Next:</span>
				<span class="truncate">{next.label}</span>
			</a>
		{:else}
			<a
				href="/practice/log"
				onclick={clearPlan}
				class="focus-live flex min-h-11 items-center rounded-lg bg-accent-500 px-3 font-semibold text-white shadow-sm hover:bg-accent-600"
			>
				Finish
			</a>
		{/if}
	</nav>
{/if}
