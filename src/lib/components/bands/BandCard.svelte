<script lang="ts">
	interface BandData {
		id: string;
		name: string;
		logo_url: string | null;
		member_count: number;
		song_count: number;
		setlist_count: number;
	}

	let { band }: { band: BandData } = $props();

	let memberLabel = $derived(band.member_count === 1 ? '1 member' : `${band.member_count} members`);
	let songLabel = $derived(band.song_count === 1 ? '1 song' : `${band.song_count} songs`);
</script>

<a
	href="/bands/{band.id}"
	class="block rounded-lg border border-surface-200 bg-surface-50 p-4 shadow-sm transition-shadow hover:shadow-md dark:border-surface-700 dark:bg-surface-800"
>
	<div class="flex items-center gap-3">
		{#if band.logo_url}
			<img
				src={band.logo_url}
				alt="{band.name} logo"
				loading="lazy"
				class="h-10 w-10 rounded-full object-cover"
			/>
		{:else}
			<div
				class="flex h-10 w-10 items-center justify-center rounded-full bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					width="20"
					height="20"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
					/>
				</svg>
			</div>
		{/if}
		<h2
			class="min-w-0 flex-1 truncate font-display text-lg font-semibold text-surface-900 dark:text-surface-100"
		>
			{band.name}
		</h2>
	</div>

	<!-- Stats -->
	<div class="mt-3 flex items-center gap-3 text-sm text-surface-500 dark:text-surface-400">
		<span class="flex items-center gap-1">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
			{memberLabel}
		</span>
		<span class="flex items-center gap-1">
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
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
			{songLabel}
		</span>
	</div>
</a>
