<script lang="ts">
	let visible = $state(false);
	let message = $state('');
	let timeout: ReturnType<typeof setTimeout>;

	export function show(msg: string, duration = 3000) {
		message = msg;
		visible = true;
		clearTimeout(timeout);
		timeout = setTimeout(() => {
			visible = false;
		}, duration);
	}
</script>

{#if visible}
	<div
		class="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-surface-900 px-4 py-2 text-sm font-medium text-white shadow-lg md:bottom-6 dark:bg-surface-100 dark:text-surface-900"
		role="status"
		aria-live="polite"
	>
		{message}
	</div>
{/if}
