<script lang="ts">
	import { rig } from '#lib/utils/rig.svelte.js';
</script>

<!-- The rig keeps running between screens. Away from the practice screens and the Rig
     page there's no panel to turn it off from, so this says it's live, gives the
     switch, and leads to the Rig page for everything else. -->
{#if rig.monitoring && rig.panels === 0}
	<div
		role="status"
		class="fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-1 rounded-full border border-surface-200 bg-surface-50 p-1 shadow-sm md:bottom-4 dark:border-surface-700 dark:bg-surface-800"
	>
		<a
			href="/rig"
			title="Open the rig"
			class="focus-live flex min-h-9 items-center gap-2 rounded-full pr-2 pl-2.5 text-sm font-medium text-surface-800 transition-colors duration-150 hover:bg-surface-100 dark:text-surface-100 dark:hover:bg-surface-700"
		>
			<span
				class="h-2 w-2 rounded-full bg-neon-600 shadow-glow-neon dark:bg-neon-400"
				aria-hidden="true"
			></span>
			Rig on
		</a>
		<button
			type="button"
			onclick={() => rig.stop()}
			class="focus-live min-h-9 rounded-full px-3 text-sm font-medium text-accent-700 transition-colors duration-150 hover:bg-surface-100 dark:text-accent-300 dark:hover:bg-surface-700"
		>
			Turn off
		</button>
	</div>
{/if}
