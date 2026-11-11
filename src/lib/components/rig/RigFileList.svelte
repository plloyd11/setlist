<script lang="ts">
	import {
		field,
		panel,
		panelFooter,
		panelRows,
		secondaryButton
	} from '#lib/components/practice/practiceStyles.js';
	import { FILE_NAME_MAX, rig } from '#lib/utils/rig.svelte.js';
	import { formatFileSize, MODE_LABELS } from '#lib/utils/rigFormat.js';
	import type { RigFile, RigFileKind } from '#lib/utils/rigStore.js';
	import { licenseLabel } from '#lib/utils/tone3000.js';
	import { focusAndSelect, iconButton, rowAction } from './rigNames.js';

	/**
	 * Everything of one kind kept in this browser, amp models or cab IRs, as rows: what
	 * each is, where it came from, what's using it, and a way to use, rename or remove
	 * it. The pickers in the rack choose; this is where the collection is looked after.
	 */
	let {
		kind,
		dropping = false,
		onremove
	}: {
		kind: RigFileKind;
		/** Files are being dragged over the page: this is where they'll land */
		dropping?: boolean;
		/** The page asks first, then removes */
		onremove: (file: RigFile) => void;
	} = $props();

	let models = $derived(kind === 'models');
	let files = $derived(models ? rig.models : rig.irs);
	let nam = $derived(rig.settings.mode === 'nam');
	let title = $derived(models ? 'Amp models' : 'Cab IRs');
	let totalBytes = $derived(files.reduce((sum, file) => sum + file.size, 0));

	let editing = $state<string | null>(null);
	let draft = $state('');
	let fileInput: HTMLInputElement | undefined = $state();

	/** Chosen for the mode that's on */
	function inUse(file: RigFile): boolean {
		if (models) return nam && rig.settings.modelId === file.id;
		return rig.setup.irId === file.id || rig.setup.irId2 === file.id;
	}

	/** Where else it's chosen: the mode that isn't on, and any saved rigs */
	function alsoUsed(file: RigFile): string[] {
		const notes: string[] = [];
		if (models) {
			if (!nam && rig.settings.modelId === file.id) notes.push("NAM's amp");
		} else {
			const other = nam ? 'amp' : 'nam';
			const { irId, irId2 } = rig.settings.setups[other];
			if (irId === file.id || irId2 === file.id) notes.push(`${MODE_LABELS[other]}'s cab`);
		}
		const rigs = rig.presets.filter((preset) =>
			models
				? preset.modelId === file.id
				: preset.setup.irId === file.id || preset.setup.irId2 === file.id
		).length;
		if (rigs > 0) notes.push(rigs === 1 ? '1 saved rig' : `${rigs} saved rigs`);
		// Only worth saying once there's an account to be in step with
		if (!models && rig.canSync && !rig.isSynced(file)) {
			notes.push(file.source || file.owner ? 'This device only' : 'Not synced yet');
		}
		return notes;
	}

	async function use(file: RigFile) {
		if (models) {
			// A model only sounds in NAM mode, so using one goes there
			await rig.setMode('nam');
			await rig.selectModel(file.id);
		} else {
			await rig.selectIr(file.id);
		}
	}

	function startRename(file: RigFile) {
		editing = file.id;
		draft = file.name;
	}

	async function commitRename(file: RigFile) {
		// Enter commits, and then the field's blur arrives: only the first one counts
		if (editing !== file.id) return;
		editing = null;
		if (draft.trim() && draft.trim() !== file.name) await rig.renameFile(kind, file.id, draft);
	}

	function renameKeydown(e: KeyboardEvent, file: RigFile) {
		if (e.key === 'Enter') {
			e.preventDefault();
			void commitRename(file);
		} else if (e.key === 'Escape') {
			e.preventDefault();
			editing = null;
		}
	}

	function picked(e: Event & { currentTarget: HTMLInputElement }) {
		const chosen = [...(e.currentTarget.files ?? [])];
		e.currentTarget.value = '';
		if (chosen.length > 0) void rig.addFiles(chosen);
	}
</script>

<section
	aria-label={title}
	class="{panel} min-w-0 transition-[border-color,box-shadow] duration-150 {dropping
		? 'border-neon-600 shadow-glow-neon dark:border-neon-400'
		: ''}"
>
	<div class="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-3">
		<h3 class="font-display text-base text-surface-900 dark:text-surface-100">{title}</h3>
		<div class="flex items-baseline gap-3 text-xs text-surface-500 dark:text-surface-300">
			{#if !models && rig.canSync}
				<!-- Where uploaded IRs stand with the account -->
				<p aria-live="polite" data-testid="rig-sync">
					{#if rig.syncState === 'syncing'}
						Syncing…
					{:else if rig.syncState === 'failed'}
						Couldn't sync.
						<button
							type="button"
							class="focus-live rounded-sm font-medium text-accent-700 underline underline-offset-2 dark:text-accent-300"
							onclick={() => rig.sync()}
						>
							Try again
						</button>
					{:else if rig.syncState === 'synced'}
						Synced
					{/if}
				</p>
			{/if}
			{#if files.length > 0}
				<p>{files.length} · {formatFileSize(totalBytes)}</p>
			{/if}
		</div>
	</div>

	{#if files.length > 0}
		<ul class="{panelRows} border-t border-surface-200 dark:border-surface-700">
			{#each files as file (file.id)}
				{@const notes = alsoUsed(file)}
				<li class="flex min-h-14 items-center gap-1.5 py-2 pr-2 pl-4">
					<div class="min-w-0 flex-1">
						{#if editing === file.id}
							<input
								use:focusAndSelect
								bind:value={draft}
								maxlength={FILE_NAME_MAX}
								aria-label="New name for {file.name}"
								class="{field} min-h-9"
								onkeydown={(e) => renameKeydown(e, file)}
								onblur={() => commitRename(file)}
							/>
						{:else}
							<p
								class="truncate text-sm font-medium text-surface-900 dark:text-surface-100"
								title={file.name}
							>
								{file.name}
							</p>
							<!-- A TONE3000 file keeps its maker and license beside it, as their terms ask -->
							<p class="mt-0.5 text-xs text-surface-500 dark:text-surface-300">
								{formatFileSize(file.size)}
								{#if file.source}
									· By {file.source.creator} · {licenseLabel(file.source.license)} ·
									<a
										href={file.source.toneUrl}
										target="_blank"
										rel="noopener noreferrer"
										title={file.source.toneTitle}
										class="focus-live rounded-sm font-medium text-surface-700 underline underline-offset-2 dark:text-surface-200"
										>On TONE3000</a
									>
								{/if}
								{#each notes as note (note)}
									· {note}
								{/each}
							</p>
						{/if}
					</div>
					{#if inUse(file)}
						<span class="shrink-0 px-2 text-xs font-medium text-surface-600 dark:text-surface-300">
							In use
						</span>
					{:else}
						<button
							type="button"
							class={rowAction}
							aria-label="{models && !nam ? 'Use in NAM' : 'Use'}: {file.name}"
							onclick={() => use(file)}
						>
							{models && !nam ? 'Use in NAM' : 'Use'}
						</button>
					{/if}
					<button
						type="button"
						class={iconButton}
						aria-label="Rename {file.name}"
						title="Rename"
						onclick={() => startRename(file)}
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
						aria-label="Remove {file.name}"
						title="Remove"
						onclick={() => onremove(file)}
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
		<p class="px-4 pb-4 text-sm text-surface-500 dark:text-surface-300">
			{models
				? 'No amp models yet. NAM mode needs one: a .nam file, or a capture from TONE3000.'
				: 'No cab IRs yet. An IR is a short .wav that stands in for the speaker and mic. The ones you upload follow your account.'}
		</p>
	{/if}

	<div class="{panelFooter} flex items-center gap-3 rounded-b-xl px-4 py-3">
		<button type="button" class={secondaryButton} onclick={() => fileInput?.click()}>
			Add {models ? '.nam files' : '.wav files'}
		</button>
		<input
			bind:this={fileInput}
			type="file"
			multiple
			accept={models ? '.nam' : '.wav,audio/wav,audio/x-wav'}
			aria-label="Add {models ? 'amp models' : 'cab IRs'}"
			class="hidden"
			onchange={picked}
		/>
		<p class="text-xs text-surface-500 dark:text-surface-300">
			{dropping ? 'Drop them here.' : 'Or drop them anywhere on this page.'}
		</p>
	</div>
</section>
