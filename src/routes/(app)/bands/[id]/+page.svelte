<script lang="ts">
	import { page } from '$app/stores';

	let { data } = $props();

	let bandId = $derived($page.params.id);

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '';
		try {
			const date = new Date(dateStr + 'T00:00:00');
			return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
		} catch {
			return dateStr;
		}
	}
</script>

<div class="p-6 md:p-8">
	<!-- Stats cards row -->
	<div class="grid grid-cols-3 gap-4">
		<div
			class="rounded-lg border border-surface-200 bg-surface-50 p-4 text-center dark:border-surface-700 dark:bg-surface-800"
		>
			<p class="font-display text-2xl text-accent-500">{data.memberCount}</p>
			<p class="mt-1 text-sm text-surface-500 dark:text-surface-300">
				{data.memberCount === 1 ? 'Member' : 'Members'}
			</p>
		</div>
		<div
			class="rounded-lg border border-surface-200 bg-surface-50 p-4 text-center dark:border-surface-700 dark:bg-surface-800"
		>
			<p class="font-display text-2xl text-accent-500">{data.songCount}</p>
			<p class="mt-1 text-sm text-surface-500 dark:text-surface-300">
				{data.songCount === 1 ? 'Song' : 'Songs'}
			</p>
		</div>
		<div
			class="rounded-lg border border-surface-200 bg-surface-50 p-4 text-center dark:border-surface-700 dark:bg-surface-800"
		>
			<p class="font-display text-2xl text-accent-500">{data.setlistCount}</p>
			<p class="mt-1 text-sm text-surface-500 dark:text-surface-300">
				{data.setlistCount === 1 ? 'Setlist' : 'Setlists'}
			</p>
		</div>
	</div>

	<!-- Quick actions -->
	<div class="mt-6 flex flex-wrap gap-3">
		<a
			href="/bands/{bandId}/songs"
			class="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-4 py-2 text-sm font-medium text-surface-700 shadow-sm transition-colors hover:bg-surface-100 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
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
			>
				<path d="M9 19V6l12-3v13" />
				<circle cx="6" cy="19" r="3" />
				<circle cx="18" cy="16" r="3" />
			</svg>
			Add Songs
		</a>
		<a
			href="/bands/{bandId}/setlists"
			class="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-4 py-2 text-sm font-medium text-surface-700 shadow-sm transition-colors hover:bg-surface-100 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
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
			>
				<path d="M4 6h16M4 10h16M4 14h10M4 18h10" />
			</svg>
			Create Setlist
		</a>
		<a
			href="/bands/{bandId}/members"
			class="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 bg-surface-50 px-4 py-2 text-sm font-medium text-surface-700 shadow-sm transition-colors hover:bg-surface-100 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
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
			>
				<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
				<circle cx="9" cy="7" r="4" />
				<path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
			</svg>
			Invite Members
		</a>
	</div>

	<!-- Recent setlists section -->
	<div class="mt-8">
		<h2 class="font-display text-lg text-surface-900 dark:text-surface-100">Recent Setlists</h2>
		{#if data.recentSetlists.length > 0}
			<div class="mt-3 space-y-2">
				{#each data.recentSetlists as setlist}
					<a
						href="/bands/{bandId}/setlists/{setlist.id}"
						class="flex items-center justify-between rounded-lg border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:bg-surface-100 dark:border-surface-700 dark:bg-surface-800 dark:hover:bg-surface-700"
					>
						<span class="font-medium text-surface-900 dark:text-surface-100">{setlist.name}</span>
						<span class="text-sm text-surface-500 dark:text-surface-300">
							{#if setlist.venue}{setlist.venue}{/if}
							{#if setlist.venue && setlist.gig_date}
								&mdash;
							{/if}
							{#if setlist.gig_date}{formatDate(setlist.gig_date)}{/if}
						</span>
					</a>
				{/each}
			</div>
		{:else}
			<p class="mt-3 text-sm text-surface-500 dark:text-surface-300">
				No setlists yet. Create one to get started.
			</p>
		{/if}
	</div>
</div>
