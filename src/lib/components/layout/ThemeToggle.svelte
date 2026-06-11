<script lang="ts">
	import { onMount } from 'svelte';
	import { theme, initTheme, toggleTheme } from '$lib/stores/theme.svelte';

	let {
		variant = 'icon',
		showLabel = false
	}: {
		variant?: 'icon' | 'switch';
		showLabel?: boolean;
	} = $props();

	// Shared runes state — multiple instances (Sidebar + settings) stay in sync
	onMount(initTheme);

	// Label names the mode you switch TO, matching the icon (moon = go dark)
	let actionLabel = $derived(theme.dark ? 'Light mode' : 'Dark mode');
</script>

{#snippet modeIcon()}
	{#if theme.dark}
		<!-- Sun icon (click to go light) -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<circle cx="12" cy="12" r="5" />
			<line x1="12" y1="1" x2="12" y2="3" />
			<line x1="12" y1="21" x2="12" y2="23" />
			<line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
			<line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
			<line x1="1" y1="12" x2="3" y2="12" />
			<line x1="21" y1="12" x2="23" y2="12" />
			<line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
			<line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
		</svg>
	{:else}
		<!-- Moon icon (click to go dark) -->
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
		</svg>
	{/if}
{/snippet}

{#if variant === 'switch'}
	<!-- On/off switch: state is readable at a glance, no iconography to decode -->
	<button
		onclick={toggleTheme}
		role="switch"
		aria-checked={theme.dark}
		aria-label="Dark mode"
		class="focus-live relative h-6 w-11 shrink-0 rounded-full transition-colors {theme.dark
			? 'bg-accent-500'
			: 'bg-surface-300'}"
	>
		<span
			class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none {theme.dark
				? 'translate-x-5'
				: ''}"
		></span>
	</button>
{:else if showLabel}
	<!-- Sidebar row: icon + text label so the action is explicit -->
	<button
		onclick={toggleTheme}
		title={actionLabel}
		class="focus-live flex h-10 w-full items-center rounded-lg text-sm font-medium text-surface-600 transition-colors hover:bg-surface-100 hover:text-accent-600 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-accent-300"
	>
		<span class="flex h-10 w-10 shrink-0 items-center justify-center">
			{@render modeIcon()}
		</span>
		<span class="nav-label whitespace-nowrap">{actionLabel}</span>
	</button>
{:else}
	<button
		onclick={toggleTheme}
		title={actionLabel}
		aria-label={actionLabel}
		class="focus-live rounded-lg p-2 text-surface-500 transition-colors hover:text-accent-600 dark:text-surface-300 dark:hover:text-accent-300"
	>
		{@render modeIcon()}
	</button>
{/if}
