<script lang="ts">
	import { secondaryButton } from './practiceStyles.js';
	import type { RigFile } from '#lib/utils/rigStore.js';

	let {
		id,
		label,
		noun,
		noneLabel,
		addLabel,
		accept,
		files,
		selected,
		disabled = false,
		removable = true,
		onselect,
		onadd,
		onremove
	}: {
		id: string;
		/** Names the select, e.g. "Cab IR"; the file input is "<label> file" */
		label: string;
		/** For "Remove this IR" */
		noun: string;
		noneLabel: string;
		addLabel: string;
		accept: string;
		files: RigFile[];
		selected: string | null;
		disabled?: boolean;
		/** False where removing lives somewhere else, like the Rig page's library */
		removable?: boolean;
		onselect: (id: string | null) => void;
		onadd: (file: File) => void;
		onremove?: (id: string) => void;
	} = $props();

	let fileInput: HTMLInputElement | undefined = $state();

	const selectClass =
		'focus-live min-h-11 min-w-0 flex-1 rounded-lg border border-surface-300 bg-surface-50 px-2 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100';

	function picked(e: Event & { currentTarget: HTMLInputElement }) {
		const file = e.currentTarget.files?.[0];
		e.currentTarget.value = '';
		if (file) onadd(file);
	}
</script>

<div class="flex items-center gap-2">
	<label class="sr-only" for={id}>{label}</label>
	<select
		{id}
		class={selectClass}
		value={selected ?? ''}
		{disabled}
		onchange={(e) => onselect(e.currentTarget.value || null)}
	>
		<option value="">{noneLabel}</option>
		{#each files as file (file.id)}
			<option value={file.id}>{file.name}</option>
		{/each}
	</select>
	{#if selected && removable}
		{@const current = selected}
		<button
			type="button"
			onclick={() => onremove?.(current)}
			aria-label="Remove this {noun}"
			title="Remove this {noun}"
			class="focus-live flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-surface-500 transition-colors duration-150 hover:bg-surface-100 hover:text-surface-700 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100"
		>
			<svg
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				aria-hidden="true"
			>
				<path d="M18 6 6 18M6 6l12 12" />
			</svg>
		</button>
	{/if}
	<button type="button" class="{secondaryButton} shrink-0" onclick={() => fileInput?.click()}>
		{addLabel}
	</button>
	<input
		bind:this={fileInput}
		type="file"
		{accept}
		aria-label="{label} file"
		class="hidden"
		onchange={picked}
	/>
</div>
