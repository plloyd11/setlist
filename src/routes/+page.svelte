<script>
	import { onMount } from 'svelte';

	onMount(() => {
		const src =
			'https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js';

		// Only append the script once — revisits reuse the already-loaded global
		// @ts-ignore — UnicornStudio is loaded via external script
		if (window.UnicornStudio) {
			// @ts-ignore
			window.UnicornStudio.init();
		} else if (!document.querySelector(`script[src="${src}"]`)) {
			const script = document.createElement('script');
			script.src = src;
			script.onload = () => {
				// @ts-ignore
				window.UnicornStudio.init();
			};
			document.head.appendChild(script);
		}

		return () => {
			// @ts-ignore
			if (window.UnicornStudio?.destroy) window.UnicornStudio.destroy();
		};
	});
</script>

<svelte:head>
	<title>Setlist — Know your set. Own the stage.</title>
	<meta
		name="description"
		content="Build setlists, track timing to the second, and keep your band in sync. The setlist builder for musicians who take the stage seriously."
	/>
</svelte:head>

<!-- Top Navigation -->
<nav
	class="fixed top-0 right-0 left-0 z-50 border-b border-surface-800/50 bg-surface-950/80 backdrop-blur-md"
>
	<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
		<a href="/" class="font-display text-2xl font-bold text-accent-400">Setlist</a>
		<a
			href="/auth"
			class="text-sm font-medium text-surface-400 transition-colors hover:text-surface-200"
		>
			Log In
		</a>
	</div>
</nav>

<!-- Hero Section -->
<section class="relative min-h-screen overflow-hidden bg-surface-950">
	<div
		data-us-project="hSluNvAYoMlk2ZQwpzrN"
		data-us-scale="1"
		data-us-dpi="1.5"
		data-us-lazyload="true"
		data-us-production="true"
		class="absolute inset-0 h-full w-full"
	></div>
	<div
		class="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-24 text-center"
	>
		<h1
			class="font-display text-4xl leading-tight font-black text-surface-100 md:text-6xl lg:text-8xl"
		>
			Know your set.<br />
			<span class="text-neon-300">Own the stage.</span>
		</h1>
		<p class="mx-auto mt-6 max-w-2xl text-lg text-white md:mt-8 md:text-2xl">
			Build setlists, track timing to the second, and keep your band in sync — all in one place.
		</p>
		<a
			href="/auth?redirect=/dashboard"
			class="mt-10 inline-block rounded-lg bg-accent-400 px-8 py-4 font-display text-lg font-bold text-surface-950 shadow-glow-accent transition-all hover:bg-accent-300 hover:shadow-lg md:mt-12"
		>
			Build Your First Setlist
		</a>
	</div>
</section>

<!-- Divider -->
<div
	class="mx-auto h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-surface-700 to-transparent"
></div>

<!-- Feature 1: Setlist Timing (image left, text right) -->
<section class="bg-surface-950 px-6">
	<div
		class="mx-auto flex max-w-6xl flex-col items-center gap-8 py-16 md:flex-row md:gap-16 md:py-24"
	>
		<div class="w-full md:w-1/2">
			<img
				src="/images/screenshots/setlist-timing.svg"
				alt="Setlist timing interface showing running totals and time tracking"
				class="rounded-xl border border-surface-700 shadow-lg"
			/>
		</div>
		<div class="w-full md:w-1/2">
			<h2 class="font-display text-2xl font-bold text-surface-100 md:text-4xl">
				Every second, accounted for
			</h2>
			<p class="mt-4 text-lg text-surface-400">
				Build your setlist and watch the running total update in real time. Set a target duration,
				see exactly how far over or under you are, and walk on stage knowing your set fits the slot.
			</p>
		</div>
	</div>
</section>

<!-- Divider -->
<div
	class="mx-auto h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-surface-700 to-transparent"
></div>

<!-- Feature 2: Song Library (image right, text left) -->
<section class="bg-surface-950 px-6">
	<div
		class="mx-auto flex max-w-6xl flex-col items-center gap-8 py-16 md:flex-row-reverse md:gap-16 md:py-24"
	>
		<div class="w-full md:w-1/2">
			<img
				src="/images/screenshots/song-library.svg"
				alt="Song library with searchable list of songs and durations"
				class="rounded-xl border border-surface-700 shadow-lg"
			/>
		</div>
		<div class="w-full md:w-1/2">
			<h2 class="font-display text-2xl font-bold text-surface-100 md:text-4xl">
				Your songs, always ready
			</h2>
			<p class="mt-4 text-lg text-surface-400">
				Keep your full catalog in one place. Add songs with durations, search instantly, and drag
				them into any setlist. No more spreadsheets, no more guessing how long that encore tune
				actually is.
			</p>
		</div>
	</div>
</section>

<!-- Divider -->
<div
	class="mx-auto h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-surface-700 to-transparent"
></div>

<!-- Feature 3: Band Collaboration (image left, text right) -->
<section class="bg-surface-950 px-6">
	<div
		class="mx-auto flex max-w-6xl flex-col items-center gap-8 py-16 md:flex-row md:gap-16 md:py-24"
	>
		<div class="w-full md:w-1/2">
			<img
				src="/images/screenshots/band-collaboration.svg"
				alt="Band workspace showing shared setlists and collaboration"
				class="rounded-xl border border-surface-700 shadow-lg"
			/>
		</div>
		<div class="w-full md:w-1/2">
			<h2 class="font-display text-2xl font-bold text-surface-100 md:text-4xl">
				Your whole band, one page
			</h2>
			<p class="mt-4 text-lg text-surface-400">
				Create a shared workspace for your band. Everyone sees the same setlists, the same songs,
				the same plan. No more group chat chaos before a gig.
			</p>
		</div>
	</div>
</section>

<!-- Divider -->
<div
	class="mx-auto h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-surface-700 to-transparent"
></div>

<!-- Social Proof Section -->
<section class="bg-surface-950 px-6 py-20 md:py-32">
	<div class="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center md:gap-8">
		<p class="font-display text-xl font-semibold text-surface-200 md:text-3xl">
			Every second of your set, <span class="text-neon-300">accounted for.</span>
		</p>
		<p class="font-display text-xl font-semibold text-surface-200 md:text-3xl">
			One library. <span class="text-neon-300">Unlimited setlists.</span>
		</p>
		<p class="font-display text-xl font-semibold text-surface-200 md:text-3xl">
			Your band, <span class="text-neon-300">in sync.</span>
		</p>
		<a
			href="/auth?redirect=/dashboard"
			class="mt-8 inline-block rounded-lg bg-accent-400 px-8 py-4 font-display text-lg font-bold text-surface-950 shadow-glow-accent transition-all hover:bg-accent-300 hover:shadow-lg md:mt-12"
		>
			Build Your First Setlist
		</a>
	</div>
</section>

<!-- Footer -->
<footer class="border-t border-surface-800 bg-surface-950 px-6 py-10">
	<div class="mx-auto flex max-w-6xl flex-col items-center gap-6 md:flex-row md:justify-between">
		<a href="/" class="font-display text-xl font-bold text-accent-400">Setlist</a>
		<div class="flex items-center gap-6">
			<a href="/auth" class="text-sm text-surface-400 transition-colors hover:text-surface-200">
				Sign Up
			</a>
			<a href="/auth" class="text-sm text-surface-400 transition-colors hover:text-surface-200">
				Log In
			</a>
		</div>
		<p class="text-sm text-surface-600">&copy; 2026 Setlist</p>
	</div>
</footer>
