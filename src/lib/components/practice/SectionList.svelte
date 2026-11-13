<script lang="ts">
	import { microLabel, panelFooter } from './practiceStyles.js';
	import { formatDuration } from '#lib/utils/duration.js';
	import { sameRange } from '#lib/utils/sections.js';
	import { MAX_SECTIONS, type LoopRange, type SavedSection } from '#lib/utils/practicePrefs.js';

	let {
		sections,
		loop,
		loopEnabled,
		currentId,
		disabled = false,
		onmark,
		onsaveloop,
		onrecall,
		onrename,
		ondelete,
		onsettoloop
	}: {
		/** In time order */
		sections: SavedSection[];
		loop: LoopRange | null;
		loopEnabled: boolean;
		/** The section under the playhead */
		currentId: string | null;
		disabled?: boolean;
		onmark: () => void;
		onsaveloop: (label: string) => void;
		onrecall: (section: SavedSection) => void;
		onrename: (id: string, label: string) => void;
		ondelete: (id: string) => void;
		onsettoloop: (id: string) => void;
	} = $props();

	let editingId = $state<string | null>(null);
	let editLabel = $state('');
	let naming = $state(false);
	let newLabel = $state('');

	let full = $derived(sections.length >= MAX_SECTIONS);
	// A loop that already is a section has nothing left to save
	let loopIsSaved = $derived(loop !== null && sections.some((s) => sameRange(s, loop)));

	const range = (r: LoopRange) =>
		`${formatDuration(Math.round(r.start))}–${formatDuration(Math.round(r.end))}`;

	function startEdit(section: SavedSection) {
		// A name typed into another row isn't thrown away by opening this one
		if (editingId) commitEdit();
		editingId = section.id;
		editLabel = section.label;
	}

	function commitEdit() {
		const label = editLabel.trim();
		const section = sections.find((s) => s.id === editingId);
		if (section && label && label !== section.label) onrename(section.id, label);
		editingId = null;
	}

	function commitNew() {
		const label = newLabel.trim();
		if (label) onsaveloop(label);
		naming = false;
		newLabel = '';
	}

	const quietButton =
		'focus-live min-h-9 rounded-lg px-2.5 text-sm font-medium text-surface-600 hover:bg-surface-100 hover:text-surface-800 disabled:opacity-50 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100';
	const field =
		'focus-live w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-1.5 text-sm text-surface-900 dark:border-surface-600 dark:bg-surface-900 dark:text-surface-100';
	const keycap =
		'rounded border border-surface-300 bg-surface-100 px-1 text-label font-medium text-surface-600 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-300';
</script>

<section aria-label="Sections">
	<div class="flex items-baseline justify-between px-4 pt-3">
		<h2 class={microLabel}>Sections</h2>
		{#if sections.length > 0}
			<span class="text-xs text-surface-500 dark:text-surface-300">
				{sections.length} of {MAX_SECTIONS}
			</span>
		{/if}
	</div>

	{#if sections.length === 0}
		<p class="px-4 pt-1.5 pb-3 text-sm text-surface-600 dark:text-surface-300">
			Mark each change as the song plays and it's mapped: tap a section to loop it, or step through
			them from the transport.
		</p>
	{:else}
		<ol class="mt-1.5 pb-1">
			{#each sections as section, i (section.id)}
				{@const looped = loop !== null && sameRange(section, loop)}
				{@const armed = looped && loopEnabled}
				<li>
					{#if editingId === section.id}
						<div class="space-y-2 bg-surface-100/60 px-4 py-2.5 dark:bg-surface-900/40">
							<!-- svelte-ignore a11y_autofocus — revealed by an explicit click -->
							<input
								type="text"
								bind:value={editLabel}
								autofocus
								maxlength="40"
								aria-label="Section name"
								onkeydown={(e) => {
									if (e.key === 'Enter') commitEdit();
									if (e.key === 'Escape') editingId = null;
								}}
								class={field}
							/>
							<div class="flex flex-wrap items-center gap-1">
								<button
									type="button"
									onclick={() => onsettoloop(section.id)}
									disabled={disabled || !loop || looped}
									title={loop
										? 'Move this section to where the loop is now'
										: 'Set a loop first: drag on the waveform, or press [ and ]'}
									class={quietButton}
								>
									Set to loop{loop && !looped ? ` ${range(loop)}` : ''}
								</button>
								<button
									type="button"
									onclick={() => {
										editingId = null;
										ondelete(section.id);
									}}
									class="{quietButton} text-danger-700 hover:text-danger-800 dark:text-danger-300 dark:hover:text-danger-200"
								>
									Delete
								</button>
								<button
									type="button"
									onclick={commitEdit}
									class="focus-live ml-auto min-h-9 rounded-lg bg-accent-500 px-3 text-sm font-semibold text-white shadow-sm hover:bg-accent-600"
								>
									Done
								</button>
							</div>
						</div>
					{:else}
						<div
							class="flex items-center {looped
								? 'bg-accent-100/70 dark:bg-accent-900/30'
								: 'hover:bg-surface-100 dark:hover:bg-surface-700/50'}"
						>
							<button
								type="button"
								onclick={() => onrecall(section)}
								{disabled}
								aria-pressed={armed}
								aria-label="Loop {section.label}"
								class="focus-inset flex min-h-11 min-w-0 flex-1 items-center gap-2.5 py-1.5 pr-1 pl-4 text-left disabled:opacity-50"
							>
								<!-- The number is its key: 1 to 9 loop a section from the keyboard -->
								<span
									class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-medium {armed
										? 'bg-neon-600 text-white shadow-glow-neon dark:bg-neon-400 dark:text-surface-950'
										: currentId === section.id
											? 'bg-accent-500 text-white'
											: 'bg-surface-200 text-surface-700 dark:bg-surface-700 dark:text-surface-200'}"
								>
									{i + 1}
								</span>
								<span
									class="min-w-0 flex-1 truncate text-sm font-medium text-surface-900 dark:text-surface-100"
								>
									{section.label}
								</span>
								<span class="shrink-0 text-xs text-surface-500 dark:text-surface-300">
									{range(section)}
								</span>
							</button>
							<button
								type="button"
								onclick={() => startEdit(section)}
								aria-label="Edit {section.label}"
								class="focus-live mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-surface-500 hover:bg-surface-200 hover:text-surface-800 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100"
							>
								<svg
									width="15"
									height="15"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									aria-hidden="true"
								>
									<path d="M12 20h9" />
									<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
								</svg>
							</button>
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}

	<div class="flex flex-wrap items-center gap-1 rounded-b-xl px-2.5 py-2 {panelFooter}">
		{#if naming}
			<!-- svelte-ignore a11y_autofocus — revealed by an explicit click -->
			<input
				type="text"
				bind:value={newLabel}
				autofocus
				maxlength="40"
				placeholder="Name this loop"
				aria-label="New section name"
				onkeydown={(e) => {
					if (e.key === 'Enter') commitNew();
					if (e.key === 'Escape') {
						naming = false;
						newLabel = '';
					}
				}}
				onblur={commitNew}
				class={field}
			/>
		{:else}
			<button
				type="button"
				onclick={onmark}
				disabled={disabled || full}
				title="Start a new section where the song is now"
				class="{quietButton} flex items-center gap-1.5"
			>
				Mark here <kbd class={keycap} aria-hidden="true">S</kbd>
			</button>
			<button
				type="button"
				onclick={() => (naming = true)}
				disabled={disabled || !loop || loopIsSaved || full}
				title={loop ? undefined : 'Set a loop first: drag on the waveform, or press [ and ]'}
				class={quietButton}
			>
				Save loop
			</button>
		{/if}
	</div>
</section>
