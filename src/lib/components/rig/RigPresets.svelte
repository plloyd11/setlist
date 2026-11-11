<script lang="ts">
	import {
		field,
		fieldLabel,
		panel,
		panelFooter,
		panelRows,
		primaryButton,
		sectionHeading
	} from '#lib/components/practice/practiceStyles.js';
	import { PRESET_NAME_MAX, rig, type RigPreset } from '#lib/utils/rig.svelte.js';
	import { MODE_LABELS } from '#lib/utils/rigFormat.js';
	import { focusAndSelect, iconButton } from './rigNames.js';

	/**
	 * Saved rigs: whatever is dialed in, kept under a name, and one tap to get back.
	 * Each carries its mode, so a real-amp sound and a NAM sound sit in the same list.
	 * Saving under a name that's taken saves over it, which is how one gets updated:
	 * load it, change it, and the button here reads Update.
	 */
	let { onremove }: { onremove: (preset: RigPreset) => void } = $props();

	let name = $state('');
	let problem = $state<string | null>(null);
	let editing = $state<string | null>(null);
	let draft = $state('');

	let sameName = $derived(
		rig.presets.find((preset) => preset.name.toLowerCase() === name.trim().toLowerCase())
	);
	/** The name in the field is a saved rig, and nothing has changed since */
	let upToDate = $derived(!!sameName && sameName.id === rig.activePresetId);

	function summary(preset: RigPreset): string {
		const parts: string[] = [MODE_LABELS[preset.mode]];
		if (preset.mode === 'nam') {
			parts.push(rig.models.find((file) => file.id === preset.modelId)?.name ?? 'No amp model');
		}
		const irs = [preset.setup.irId, preset.setup.irId2]
			.map((id) => rig.irs.find((file) => file.id === id)?.name)
			.filter((name) => name !== undefined);
		parts.push(irs.length > 0 ? irs.join(' + ') : 'No IR');
		return parts.join(' · ');
	}

	async function load(preset: RigPreset) {
		problem = null;
		// Its name goes in the field, ready to save over once it's been changed
		name = preset.name;
		await rig.applyPreset(preset.id);
	}

	function save(e: SubmitEvent) {
		e.preventDefault();
		problem = rig.savePreset(name);
		if (!problem) name = name.trim();
	}

	function startRename(preset: RigPreset) {
		problem = null;
		editing = preset.id;
		draft = preset.name;
	}

	function commitRename(preset: RigPreset) {
		if (editing !== preset.id) return;
		editing = null;
		const next = draft.trim();
		if (!next || next === preset.name) return;
		problem = rig.renamePreset(preset.id, next);
		if (!problem && name.trim().toLowerCase() === preset.name.toLowerCase()) name = next;
	}

	function renameKeydown(e: KeyboardEvent, preset: RigPreset) {
		if (e.key === 'Enter') {
			e.preventDefault();
			commitRename(preset);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			editing = null;
		}
	}
</script>

<section aria-labelledby="saved-rigs-heading" class="min-w-0">
	<h2 id="saved-rigs-heading" class={sectionHeading}>Saved rigs</h2>
	<div class="{panel} mt-2">
		{#if rig.presets.length > 0}
			<ul class={panelRows} aria-label="Saved rigs">
				{#each rig.presets as preset (preset.id)}
					{@const loaded = preset.id === rig.activePresetId}
					<li
						class="flex items-center gap-1 pr-2 first:rounded-t-xl {loaded
							? 'bg-surface-100 dark:bg-surface-700/60'
							: ''}"
					>
						{#if editing === preset.id}
							<div class="min-w-0 flex-1 py-2 pl-4">
								<input
									use:focusAndSelect
									bind:value={draft}
									maxlength={PRESET_NAME_MAX}
									aria-label="New name for {preset.name}"
									class="{field} min-h-9"
									onkeydown={(e) => renameKeydown(e, preset)}
									onblur={() => commitRename(preset)}
								/>
							</div>
						{:else}
							<button
								type="button"
								aria-pressed={loaded}
								aria-label="Load {preset.name}"
								onclick={() => load(preset)}
								class="focus-inset flex min-h-14 min-w-0 flex-1 flex-col justify-center rounded-lg py-2 pr-2 pl-4 text-left transition-[background-color] duration-150 {loaded
									? ''
									: 'hover:bg-surface-100 dark:hover:bg-surface-700/50'}"
							>
								<span
									class="w-full truncate text-sm text-surface-900 dark:text-surface-100 {loaded
										? 'font-semibold'
										: 'font-medium'}"
								>
									{preset.name}
								</span>
								<span class="w-full truncate text-xs text-surface-500 dark:text-surface-300">
									{summary(preset)}
								</span>
							</button>
							{#if loaded}
								<span
									class="shrink-0 px-1 text-xs font-medium text-surface-600 dark:text-surface-300"
								>
									Loaded
								</span>
							{/if}
						{/if}
						<button
							type="button"
							class={iconButton}
							aria-label="Rename {preset.name}"
							title="Rename"
							onclick={() => startRename(preset)}
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
								<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
							</svg>
						</button>
						<button
							type="button"
							class={iconButton}
							aria-label="Remove {preset.name}"
							title="Remove"
							onclick={() => onremove(preset)}
						>
							<svg
								width="15"
								height="15"
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
					</li>
				{/each}
			</ul>
		{:else}
			<p class="px-4 pt-3.5 pb-1 text-sm text-surface-500 dark:text-surface-300">
				Dial in a sound, then save it here. Each saved rig keeps its mode, amp model, IR and knobs,
				so swapping sounds is one tap.
			</p>
		{/if}

		<form
			onsubmit={save}
			class="flex flex-wrap items-end gap-2 rounded-b-xl p-4 {rig.presets.length > 0
				? panelFooter
				: ''}"
		>
			<label class="min-w-32 flex-1">
				<span class={fieldLabel}>Save what's dialed in</span>
				<input
					bind:value={name}
					maxlength={PRESET_NAME_MAX}
					placeholder="Plexi crunch"
					autocomplete="off"
					class="{field} mt-1"
					oninput={() => (problem = null)}
				/>
			</label>
			<button
				type="submit"
				class="{primaryButton} disabled:opacity-50"
				disabled={!name.trim() || upToDate}
			>
				{upToDate ? 'Saved' : sameName ? 'Update' : 'Save'}
			</button>
			{#if problem}
				<p role="alert" class="w-full text-sm text-danger-700 dark:text-danger-300">{problem}</p>
			{/if}
		</form>
	</div>
</section>
