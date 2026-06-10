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
	let nameValue = $state('');
	let dateValue = $state('');
	let venueValue = $state('');

	// Sync local state only when the SERVER value actually changes — an
	// invalidateAll elsewhere gives `setlist` a new reference with the same
	// values, and unconditionally syncing would wipe in-progress typing.
	let lastServerName: string | undefined;
	let lastServerDate: string | undefined;
	let lastServerVenue: string | undefined;

	$effect(() => {
		if (setlist.name !== lastServerName) {
			lastServerName = setlist.name;
			nameValue = setlist.name;
		}
	});
	$effect(() => {
		const serverDate = setlist.gig_date ?? '';
		if (serverDate !== lastServerDate) {
			lastServerDate = serverDate;
			dateValue = serverDate;
		}
	});
	$effect(() => {
		const serverVenue = setlist.venue ?? '';
		if (serverVenue !== lastServerVenue) {
			lastServerVenue = serverVenue;
			venueValue = serverVenue;
		}
	});

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
		<img src={profile.logo_url} alt="" loading="lazy" class="mx-auto mb-3 max-h-24 w-auto" />
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
			aria-label="Setlist name"
			class="focus-live w-full max-w-md rounded border border-neon-600 bg-transparent px-2 py-1 text-center font-display text-2xl text-surface-900 dark:border-neon-400 dark:text-surface-100"
		/>
	{:else}
		<button
			onclick={startNameEdit}
			class="font-display text-2xl text-surface-900 hover:text-accent-600 dark:text-surface-100 dark:hover:text-accent-300"
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
			aria-label="Gig date"
			class="focus-live rounded border border-surface-300 bg-transparent px-2 py-1 text-sm text-surface-600 dark:border-surface-600 dark:text-surface-300"
			placeholder="Date"
		/>
		<input
			type="text"
			bind:value={venueValue}
			onblur={handleVenueBlur}
			onkeydown={handleVenueKeydown}
			placeholder="Venue"
			aria-label="Venue"
			class="focus-live rounded border border-surface-300 bg-transparent px-2 py-1 text-sm text-surface-600 placeholder-surface-500 dark:border-surface-600 dark:text-surface-300 dark:placeholder-surface-300"
		/>
	</div>
</div>
