<script lang="ts">
	import { fade } from 'svelte/transition';
</script>

<svelte:head>
	<title>Setlist · The platform for musicians</title>
	<meta
		name="description"
		content="Build setlists, track timing to the second, and keep your band in sync. The setlist builder for musicians who take the stage seriously."
	/>
</svelte:head>

<!-- The whole page is the stage (in the layout). The name is on the kick drum; the button
     is the only way in. Absolute, so it can fade out over the auth page as that arrives. -->
<main class="absolute inset-0 overflow-hidden" out:fade|global={{ duration: 300 }}>
	<div class="pitch absolute inset-x-0 z-10 flex flex-col items-center px-6 text-center">
		<h1 class="font-display leading-[0.98] font-black text-balance text-surface-50">
			The platform for musicians
		</h1>
		<a
			href="/auth"
			class="focus-live hit-44 rounded-lg bg-accent-hot px-8 py-4 font-display text-lg font-bold text-surface-950 shadow-glow-accent transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 motion-reduce:transition-none"
		>
			Pick up that riff stick
		</a>
	</div>
</main>

<style>
	/* The headline hangs in the haze between the lamps and the kit. Where those sit
	   depends on the screen's shape (see the home shot in stage/scene.ts), so the
	   block is placed and sized against the viewport's height, not the page's. */
	.pitch {
		top: 17svh;
		gap: clamp(1rem, 3.5svh, 2.25rem);
	}
	h1 {
		font-size: clamp(2rem, min(6.4vw, 11svh), 5.5rem);
		text-shadow:
			0 2px 28px rgb(4 6 10 / 0.75),
			0 0 2px rgb(4 6 10 / 0.6);
	}
	/* Tall screens: the camera has stepped back, so the lamps hang lower in the frame */
	@media (max-aspect-ratio: 5/8) {
		.pitch {
			top: 23svh;
		}
	}
	/* A phone on its side: little room above the kit, so everything tightens up */
	@media (max-height: 480px) {
		.pitch {
			top: 11svh;
		}
		.pitch > a {
			padding: 0.625rem 1.5rem;
			font-size: 1rem;
		}
	}
	@media (prefers-reduced-motion: no-preference) {
		.pitch > * {
			animation: arrive 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both;
		}
		.pitch > a {
			animation-delay: 0.65s;
		}
		/* Coming back from the auth page: wait for the camera to pull out */
		:global(.travelled) .pitch > * {
			animation-delay: 1.2s;
		}
		:global(.travelled) .pitch > a {
			animation-delay: 1.35s;
		}
		@keyframes arrive {
			from {
				opacity: 0;
				translate: 0 1.25rem;
			}
		}
	}
</style>
