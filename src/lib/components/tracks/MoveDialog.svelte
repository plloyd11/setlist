<script lang="ts">
	interface FolderNode {
		id: string;
		parent_id: string | null;
		name: string;
	}

	interface PickOpts {
		title: string;
		folders: FolderNode[];
		/** When moving a folder: its own subtree is not a valid destination */
		excludeSubtreeOf?: string | null;
		/** The item's current location (folder id, null = root) — disabled as a no-op */
		currentLocation?: string | null;
	}

	let dialogEl = $state<HTMLDialogElement>();
	let opts = $state<PickOpts | null>(null);
	let resolver: ((value: string | null | undefined) => void) | null = null;

	/** Resolves with the chosen folder id, null for the top level, or
	 * undefined when cancelled — mirrors ConfirmDialog's promise API. */
	export function pick(o: PickOpts): Promise<string | null | undefined> {
		opts = o;
		return new Promise((resolve) => {
			resolver = resolve;
			dialogEl?.showModal();
		});
	}

	function choose(value: string | null) {
		resolver?.(value);
		resolver = null;
		dialogEl?.close();
	}

	function handleClose() {
		resolver?.(undefined);
		resolver = null;
	}

	let entries = $derived.by(() => {
		if (!opts) return [];
		const childrenOf = new Map<string | null, FolderNode[]>();
		for (const f of opts.folders) {
			const siblings = childrenOf.get(f.parent_id) ?? [];
			siblings.push(f);
			childrenOf.set(f.parent_id, siblings);
		}

		const excluded = new Set<string>();
		if (opts.excludeSubtreeOf) {
			const collect = (id: string) => {
				excluded.add(id);
				for (const child of childrenOf.get(id) ?? []) collect(child.id);
			};
			collect(opts.excludeSubtreeOf);
		}

		const out: { id: string; name: string; depth: number; disabled: boolean }[] = [];
		const walk = (parent: string | null, depth: number) => {
			for (const f of childrenOf.get(parent) ?? []) {
				out.push({
					id: f.id,
					name: f.name,
					depth,
					disabled: excluded.has(f.id) || f.id === opts?.currentLocation
				});
				walk(f.id, depth + 1);
			}
		};
		walk(null, 0);
		return out;
	});
</script>

<dialog
	bind:this={dialogEl}
	class="m-auto w-full max-w-lg rounded-xl border border-surface-200 bg-surface-50 p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm dark:border-surface-700 dark:bg-surface-800"
	onclose={handleClose}
>
	{#if opts}
		<div class="p-6">
			<h3 class="font-display text-lg font-semibold text-surface-900 dark:text-surface-100">
				{opts.title}
			</h3>
			<div class="mt-4 max-h-96 space-y-0.5 overflow-y-auto">
				<button
					type="button"
					disabled={(opts.currentLocation ?? null) === null}
					class="focus-live flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-surface-700 hover:bg-surface-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-surface-300 dark:hover:bg-surface-700 dark:disabled:hover:bg-transparent"
					onclick={() => choose(null)}
				>
					<svg
						class="h-4 w-4 shrink-0 text-surface-500 dark:text-surface-300"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="1.5"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
						/>
					</svg>
					Tracks (top level)
				</button>
				{#each entries as entry (entry.id)}
					<button
						type="button"
						disabled={entry.disabled}
						style="padding-left: {entry.depth * 16 + 12}px"
						class="focus-live flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-sm text-surface-700 hover:bg-surface-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-surface-300 dark:hover:bg-surface-700 dark:disabled:hover:bg-transparent"
						onclick={() => choose(entry.id)}
					>
						<svg
							class="h-4 w-4 shrink-0 text-accent-500 dark:text-accent-400"
							fill="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								d="M3.75 5.25A1.5 1.5 0 015.25 3.75h4.193c.4 0 .784.16 1.066.444l1.547 1.556h6.694a1.5 1.5 0 011.5 1.5v11a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5V5.25z"
							/>
						</svg>
						<span class="truncate">{entry.name}</span>
					</button>
				{/each}
			</div>
			<div class="mt-4 flex justify-end">
				<button
					type="button"
					class="rounded-lg px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-800 dark:text-surface-300 dark:hover:text-surface-200"
					onclick={() => dialogEl?.close()}
				>
					Cancel
				</button>
			</div>
		</div>
	{/if}
</dialog>
