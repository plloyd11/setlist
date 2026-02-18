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
	class="rounded-xl border border-stone-200 bg-white p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm dark:border-stone-700 dark:bg-stone-800"
	onclose={handleCancel}
>
	<div class="p-6">
		<h3 class="font-display text-lg font-semibold text-stone-900 dark:text-stone-100">
			{title}
		</h3>
		<p class="mt-2 text-sm text-stone-600 dark:text-stone-400">
			{message}
		</p>
		<div class="mt-6 flex justify-end gap-3">
			<button
				class="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
				onclick={handleCancel}
			>
				Cancel
			</button>
			<button
				class="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-600"
				onclick={handleConfirm}
			>
				Delete
			</button>
		</div>
	</div>
</dialog>
