<script lang="ts">
	let { data } = $props();
</script>

<div class="p-6 md:p-8">
	<!-- Welcome header -->
	<h1 class="font-display text-3xl text-surface-900 dark:text-surface-100">
		Welcome back, {data.user?.user_metadata?.full_name || 'there'}
	</h1>
	<p class="mt-2 text-surface-500 dark:text-surface-400">Here's what's happening with your music.</p>

	<!-- Quick stats cards -->
	<div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		<!-- Songs card -->
		<div
			class="rounded-xl border border-surface-200 bg-surface-50 p-6 shadow-sm dark:border-surface-800 dark:bg-surface-900"
		>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/10">
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
						class="text-accent-500"
					>
						<path
							d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z"
						/>
					</svg>
				</div>
				<div>
					<p class="text-2xl font-bold text-surface-900 dark:text-surface-100">0</p>
					<p class="text-sm text-surface-500 dark:text-surface-400">songs in your library</p>
				</div>
			</div>
		</div>

		<!-- Setlists card -->
		<div
			class="rounded-xl border border-surface-200 bg-surface-50 p-6 shadow-sm dark:border-surface-800 dark:bg-surface-900"
		>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-500/10">
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
						class="text-accent-500"
					>
						<path d="M4 6h16M4 10h16M4 14h10M4 18h10" />
					</svg>
				</div>
				<div>
					<p class="text-2xl font-bold text-surface-900 dark:text-surface-100">0</p>
					<p class="text-sm text-surface-500 dark:text-surface-400">setlists created</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Get started prompt -->
	<div
		class="mt-8 rounded-xl border border-dashed border-surface-300 bg-surface-50/50 p-8 text-center dark:border-surface-700 dark:bg-surface-900/50"
	>
		<p class="font-display text-lg text-surface-700 dark:text-surface-300">Get started</p>
		<p class="mt-2 text-sm text-surface-500 dark:text-surface-400">
			Add your first song to start building setlists.
		</p>
		<a
			href="/songs"
			class="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-600"
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
				<line x1="12" y1="5" x2="12" y2="19" />
				<line x1="5" y1="12" x2="19" y2="12" />
			</svg>
			Add a song
		</a>
	</div>
</div>
