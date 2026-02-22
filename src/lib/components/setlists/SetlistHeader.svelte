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
			class="w-full max-w-md rounded border border-neon-400 bg-transparent px-2 py-1 text-center font-display text-2xl text-surface-900 focus:outline-none focus:ring-1 focus:ring-neon-400 dark:border-neon-600 dark:text-surface-100"
		/>
	{:else}
		<button
			onclick={startNameEdit}
			class="font-display text-2xl text-surface-900 hover:text-neon-500 dark:text-surface-100 dark:hover:text-neon-400"
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
			class="rounded border border-surface-300 bg-transparent px-2 py-1 text-sm text-surface-600 focus:border-neon-400 focus:outline-none dark:border-surface-600 dark:text-surface-400"
			placeholder="Date"
		/>
		<input
			type="text"
			bind:value={venueValue}
			onblur={handleVenueBlur}
			onkeydown={handleVenueKeydown}
			placeholder="Venue"
			class="rounded border border-surface-300 bg-transparent px-2 py-1 text-sm text-surface-600 placeholder-surface-400 focus:border-neon-400 focus:outline-none dark:border-surface-600 dark:text-surface-400 dark:placeholder-surface-500"
		/>
	</div>
</div>
