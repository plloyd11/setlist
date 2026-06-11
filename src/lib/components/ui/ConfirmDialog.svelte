<script lang="ts">
	let dialogEl: HTMLDialogElement | undefined = $state();
	let title = $state('');
	let message = $state('');
	let resolver: ((value: boolean) => void) | null = null;

	export function confirm(t: string, msg: string): Promise<boolean> {
		title = t;
		message = msg;
		return new Promise<boolean>((resolve) => {
			resolver = resolve;
			dialogEl?.showModal();
		});
	}

	function handleConfirm() {
		resolver?.(true);
		resolver = null;
		dialogEl?.close();
	}

	function handleCancel() {
		resolver?.(false);
		resolver = null;
		dialogEl?.close();
	}
</script>

<dialog
	bind:this={dialogEl}
	class="m-auto rounded-xl border border-surface-200 bg-surface-50 p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm dark:border-surface-700 dark:bg-surface-800"
	onclose={handleCancel}
>
	<div class="p-6">
		<h3 class="font-display text-lg font-semibold text-surface-900 dark:text-surface-100">
			{title}
		</h3>
		<p class="mt-2 text-sm text-surface-600 dark:text-surface-300">
			{message}
		</p>
		<div class="mt-6 flex justify-end gap-3">
			<button
				class="rounded-lg px-4 py-2 text-sm font-medium text-surface-600 hover:text-surface-800 dark:text-surface-300 dark:hover:text-surface-200"
				onclick={handleCancel}
			>
				Cancel
			</button>
			<button
				class="rounded-lg bg-danger-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-danger-600"
				onclick={handleConfirm}
			>
				Delete
			</button>
		</div>
	</div>
</dialog>
