<script lang="ts">
	import type { Setlist, Profile } from '$lib/types/database';

	let {
		setlist,
		profile = null,
		onUpdate
	}: {
		setlist: Setlist;
		profile: Profile | null;
		onUpdate: (updates: Partial<Pick<Setlist, 'name' | 'gig_date' | 'venue'>>) => void;
	} = $props();

	let editingName = $state(false);
	let nameValue = $state(setlist.name);
	let dateValue = $state(setlist.gig_date ?? '');
	let venueValue = $state(setlist.venue ?? '');

	function startNameEdit() {
		nameValue = setlist.name;
		editingName = true;
	}

	function saveName() {
		const trimmed = nameValue.trim();
		if (trimmed && trimmed !== setlist.name) {
			onUpdate({ name: trimmed });
		}
		editingName = false;
	}

	function handleNameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			saveName();
		} else if (e.key === 'Escape') {
			nameValue = setlist.name;
			editingName = false;
		}
	}

	function handleDateChange() {
		onUpdate({ gig_date: dateValue || null });
	}

	function handleVenueBlur() {
		const trimmed = venueValue.trim();
		if (trimmed !== (setlist.venue ?? '')) {
			onUpdate({ venue: trimmed || null });
		}
	}

	function handleVenueKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.target as HTMLInputElement).blur();
		}
	}
</script>

<div class="mb-4 text-center">
	<!-- Logo -->
	{#if profile?.logo_url}
		<img
			src={profile.logo_url}
			alt=""
			class="mx-auto mb-3 max-h-24 w-auto"
		/>
	{/if}

	<!-- Setlist name (editable) -->
	{#if editingName}
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="text"
			bind:value={nameValue}
			onblur={saveName}
			onkeydown={handleNameKeydown}
			autofocus
			class="w-full max-w-md rounded border border-amber-400 bg-transparent px-2 py-1 text-center font-display text-2xl text-stone-900 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-amber-600 dark:text-stone-100"
		/>
	{:else}
		<button
			onclick={startNameEdit}
			class="font-display text-2xl text-stone-900 hover:text-amber-600 dark:text-stone-100 dark:hover:text-amber-400"
			title="Click to rename"
		>
			{setlist.name}
		</button>
	{/if}

	<!-- Date and venue row -->
	<div class="mt-2 flex items-center justify-center gap-3">
		<input
			type="date"
			bind:value={dateValue}
			onchange={handleDateChange}
			class="rounded border border-stone-300 bg-transparent px-2 py-1 text-sm text-stone-600 focus:border-amber-500 focus:outline-none dark:border-stone-600 dark:text-stone-400"
			placeholder="Date"
		/>
		<input
			type="text"
			bind:value={venueValue}
			onblur={handleVenueBlur}
			onkeydown={handleVenueKeydown}
			placeholder="Venue"
			class="rounded border border-stone-300 bg-transparent px-2 py-1 text-sm text-stone-600 placeholder-stone-400 focus:border-amber-500 focus:outline-none dark:border-stone-600 dark:text-stone-400 dark:placeholder-stone-500"
		/>
	</div>
</div>
