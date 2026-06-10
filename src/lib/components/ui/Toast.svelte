<script lang="ts">
	import { onDestroy } from 'svelte';

	type Variant = 'info' | 'success' | 'error';

	let visible = $state(false);
	let message = $state('');
	let variant = $state<Variant>('info');
	let timeout: ReturnType<typeof setTimeout>;

	export function show(msg: string, opts: { variant?: Variant; duration?: number } = {}) {
		message = msg;
		variant = opts.variant ?? 'info';
		visible = true;
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			visible = false;
		}, opts.duration ?? 3000);
	}

	onDestroy(() => clearTimeout(timeout));

	const variantClasses: Record<Variant, string> = {
		info: 'bg-surface-900 text-white dark:bg-surface-100 dark:text-surface-900',
		success: 'bg-success-700 text-success-50',
		error: 'bg-danger-700 text-danger-50'
	};
</script>

{#if visible}
	<div
		class="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2 text-sm font-medium shadow-lg md:bottom-6 {variantClasses[
			variant
		]}"
		role="status"
		aria-live="polite"
	>
		{message}
	</div>
{/if}
