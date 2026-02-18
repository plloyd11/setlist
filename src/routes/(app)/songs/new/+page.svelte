<script lang="ts">
	import { enhance } from '$app/forms';
	import Toast from '$lib/components/ui/Toast.svelte';

	let { form } = $props();
	let toast: Toast;
</script>

<div class="p-6 md:p-8">
	<div class="mb-8 flex items-center gap-4">
		<a
			href="/songs"
			class="flex items-center text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="16"
				height="16"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="mr-1"
			>
				<path d="M19 12H5M12 19l-7-7 7-7" />
			</svg>
			Songs
		</a>
	</div>

	<h1 class="font-display text-3xl text-stone-900 dark:text-stone-100">Add Song</h1>

	<form
		method="POST"
		class="mt-8 max-w-md space-y-6"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'success') {
					toast.show('Song added');
					await update({ reset: true });
				} else {
					await update();
				}
			};
		}}
	>
		<div>
			<label for="title" class="block text-sm font-medium text-stone-700 dark:text-stone-300">
				Title
			</label>
			<input
				id="title"
				name="title"
				type="text"
				required
				value={form?.title ?? ''}
				class="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500 dark:focus:border-amber-500"
			/>
		</div>

		<div>
			<label for="duration" class="block text-sm font-medium text-stone-700 dark:text-stone-300">
				Duration
			</label>
			<input
				id="duration"
				name="duration"
				type="text"
				required
				placeholder="3:45"
				inputmode="numeric"
				pattern="\d{1,3}:[0-5]\d"
				value={form?.durationRaw ?? ''}
				class="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500 dark:focus:border-amber-500"
			/>
		</div>

		<div>
			<label for="notes" class="block text-sm font-medium text-stone-700 dark:text-stone-300">
				Notes <span class="text-stone-400 dark:text-stone-500">(optional)</span>
			</label>
			<textarea
				id="notes"
				name="notes"
				rows="3"
				class="mt-1 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-stone-900 placeholder-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100 dark:placeholder-stone-500 dark:focus:border-amber-500"
			>{form?.notes ?? ''}</textarea>
		</div>

		{#if form?.error}
			<p class="text-sm text-red-500">{form.error}</p>
		{/if}

		<button
			type="submit"
			class="w-full rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-white shadow-sm hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 dark:focus:ring-offset-stone-900"
		>
			Add Song
		</button>
	</form>
</div>

<Toast bind:this={toast} />
