<script lang="ts">
	import SetlistCard from '$lib/components/setlists/SetlistCard.svelte';
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { enhance } from '$app/forms';

	let { data } = $props();

	// Create form state
	let showCreateForm = $state(false);
	let newName = $state('');

	// Component refs
	let confirmDialog: ConfirmDialog;
	let toast: Toast;
	let deleteForm: HTMLFormElement;
	let deleteInput: HTMLInputElement;
	let duplicateForm: HTMLFormElement;
	let duplicateInput: HTMLInputElement;
	let renameForm: HTMLFormElement;
	let renameIdInput: HTMLInputElement;
	let renameNameInput: HTMLInputElement;

	let hasSetlists = $derived(data.setlists.length > 0);
	let setlistCountLabel = $derived(
		data.setlists.length === 1 ? '1 setlist' : `${data.setlists.length} setlists`
	);

	function toggleCreate() {
		showCreateForm = !showCreateForm;
		if (showCreateForm) {
			newName = '';
		}
	}

	async function handleDelete(id: string, name: string) {
		const confirmed = await confirmDialog.confirm(
			'Delete Setlist',
			`Are you sure you want to delete "${name}"? This cannot be undone.`
		);
		if (confirmed) {
			deleteInput.value = id;
			deleteForm.requestSubmit();
		}
	}

	function handleDuplicate(id: string) {
		duplicateInput.value = id;
		duplicateForm.requestSubmit();
	}

	function handleRename(id: string, name: string) {
		renameIdInput.value = id;
		renameNameInput.value = name;
		renameForm.requestSubmit();
	}
</script>

<div class="p-6 md:p-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div class="flex items-baseline gap-3">
			<h1 class="font-display text-3xl text-stone-900 dark:text-stone-100">Setlists</h1>
			{#if hasSetlists}
				<span class="text-sm text-stone-500 dark:text-stone-400">{setlistCountLabel}</span>
			{/if}
		</div>
		<button
			onclick={toggleCreate}
			class="flex items-center justify-center rounded-lg bg-amber-500 p-2 text-white shadow-sm hover:bg-amber-600"
			aria-label="New setlist"
		>
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 5v14M5 12h14" />
			</svg>
		</button>
	</div>

	<!-- Inline create form -->
	{#if showCreateForm}
		<form
			method="POST"
			action="?/create"
			class="mt-4 flex items-center gap-2"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'redirect') {
						// Let SvelteKit handle the redirect
						await update();
					} else if (result.type === 'failure') {
						toast.show('Failed to create setlist');
					}
				};
			}}
		>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				name="name"
				bind:value={newName}
				placeholder="Setlist name..."
				autofocus
				required
				class="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500"
			/>
			<button
				type="submit"
				disabled={!newName.trim()}
				class="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500"
			>
				Create
			</button>
			<button
				type="button"
				onclick={toggleCreate}
				class="rounded-lg px-3 py-2 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-300"
			>
				Cancel
			</button>
		</form>
	{/if}

	{#if hasSetlists}
		<!-- Card grid -->
		<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.setlists as setlist (setlist.id)}
				<SetlistCard
					{setlist}
					songCount={data.stats[setlist.id]?.songCount ?? 0}
					totalSeconds={data.stats[setlist.id]?.totalSeconds ?? 0}
					ondelete={handleDelete}
					onduplicate={handleDuplicate}
					onrename={handleRename}
				/>
			{/each}
		</div>
	{:else if !showCreateForm}
		<!-- Empty state -->
		<div class="mt-8 rounded-xl border border-dashed border-stone-300 bg-white/50 p-12 text-center dark:border-stone-700 dark:bg-stone-900/50">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="48"
				height="48"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="mx-auto text-stone-300 dark:text-stone-600"
			>
				<path d="M4 6h16M4 10h16M4 14h10M4 18h10" />
			</svg>
			<p class="mt-4 font-display text-lg text-stone-700 dark:text-stone-300">
				No setlists yet
			</p>
			<p class="mt-2 text-sm text-stone-500 dark:text-stone-400">
				Create your first setlist to get started.
			</p>
			<button
				onclick={toggleCreate}
				class="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-amber-600"
			>
				Create your first setlist
			</button>
		</div>
	{/if}
</div>

<!-- Confirm dialog -->
<ConfirmDialog bind:this={confirmDialog} />

<!-- Hidden delete form -->
<form
	bind:this={deleteForm}
	method="POST"
	action="?/delete"
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.show('Setlist deleted');
				await update();
			}
		};
	}}
>
	<input bind:this={deleteInput} type="hidden" name="id" value="" />
</form>

<!-- Hidden duplicate form -->
<form
	bind:this={duplicateForm}
	method="POST"
	action="?/duplicate"
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.show('Setlist duplicated');
				await update();
			}
		};
	}}
>
	<input bind:this={duplicateInput} type="hidden" name="id" value="" />
</form>

<!-- Hidden rename form -->
<form
	bind:this={renameForm}
	method="POST"
	action="?/rename"
	class="hidden"
	use:enhance={() => {
		return async ({ result, update }) => {
			if (result.type === 'success') {
				toast.show('Setlist renamed');
				await update();
			}
		};
	}}
>
	<input bind:this={renameIdInput} type="hidden" name="id" value="" />
	<input bind:this={renameNameInput} type="hidden" name="name" value="" />
</form>

<!-- Toast -->
<Toast bind:this={toast} />
