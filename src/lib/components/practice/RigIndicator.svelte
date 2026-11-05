<script lang="ts">
	import { rig } from '#lib/utils/rig.svelte.js';
</script>

<!-- The rig keeps running between screens. Off the practice screens there's no panel
     to turn it off from, so this says it's live and gives the switch. -->
{#if rig.monitoring && rig.panels === 0}
	<div
		role="status"
		class="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 rounded-full border border-surface-200 bg-surface-50 py-1 pr-1 pl-3 shadow-sm md:bottom-4 dark:border-surface-700 dark:bg-surface-800"
	>
		<span
			class="h-2 w-2 rounded-full bg-neon-600 shadow-glow-neon dark:bg-neon-400"
			aria-hidden="true"
		></span>
		<span class="text-sm font-medium text-surface-800 dark:text-surface-100">Rig on</span>
		<button
			type="button"
			onclick={() => rig.stop()}
			class="focus-live min-h-9 rounded-full px-3 text-sm font-medium text-accent-700 transition-colors duration-150 hover:bg-surface-100 dark:text-accent-300 dark:hover:bg-surface-700"
		>
			Turn off
		</button>
	</div>
{/if}
