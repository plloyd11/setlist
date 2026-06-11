<script lang="ts">
	let dialogEl = $state<HTMLDialogElement>();
	let inputEl = $state<HTMLInputElement>();
	let title = $state('');
	let submitLabel = $state('Save');
	let name = $state('');
	let error = $state('');
	let busy = $state(false);
	let onsubmit: ((name: string) => Promise<string | null>) | null = null;

	/** onsubmit returns an error message to show inline (dialog stays open
	 * for retry — duplicate names, depth cap) or null on success (closes). */
	export function open(o: {
		title: string;
		initial?: string;
		submitLabel?: string;
		onsubmit: (name: string) => Promise<string | null>;
	}) {
		title = o.title;
		name = o.initial ?? '';
		submitLabel = o.submitLabel ?? 'Save';
		error = '';
		busy = false;
		onsubmit = o.onsubmit;
		dialogEl?.showModal();
		inputEl?.select();
	}

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		const trimmed = name.trim();
		if (!trimmed || !onsubmit || busy) return;
		busy = true;
		const err = await onsubmit(trimmed);
		busy = false;
		if (err) {
			error = err;
			inputEl?.select();
			return;
		}
		onsubmit = null;
		dialogEl?.close();
	}
</script>

<dialog
	bind:this={dialogEl}
	class="m-auto w-full max-w-md rounded-xl border border-surface-200 bg-surface-50 p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm dark:border-surface-700 dark:bg-surface-800"
	onclose={() => (onsubmit = null)}
>
	<form class="p-6" onsubmit={handleSubmit}>
		<h3 class="font-display text-lg font-semibold text-surface-900 dark:text-surface-100">
			{title}
		</h3>
		<input
			bind:this={inputEl}
			type="text"
			bind:value={name}
			placeholder="Folder name..."
			disabled={busy}
			class="focus-live mt-4 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 py-2 text-surface-900 placeholder-surface-500 dark:border-surface-600 dark:bg-surface-800 dark:text-surface-100 dark:placeholder-surface-300"
		/>
		{#if error}
			<p role="alert" class="mt-2 text-sm text-danger-600 dark:text-danger-400">{error}</p>
		{/if}
		<div class="mt-6 flex justify-end gap-3">
			<button
				type="button"
				disabled={busy}
				class="rounded-lg px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-800 dark:text-surface-300 dark:hover:text-surface-200"
				onclick={() => dialogEl?.close()}
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={busy || !name.trim()}
				class="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-600 disabled:opacity-50"
			>
				{submitLabel}
			</button>
		</div>
	</form>
</dialog>
