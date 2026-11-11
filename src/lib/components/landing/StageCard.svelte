<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';

	/**
	 * The panel the auth pages sit in, placed where the stage's auth shot leaves room
	 * for it: right of the kit on a wide screen, under it on a tall one.
	 */
	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<div class="door relative z-10 flex min-h-svh" out:fade|global={{ duration: 250 }}>
	<a
		href="/"
		class="back focus-live hit-44 absolute top-4 left-4 rounded-lg px-3 py-2 text-sm font-medium text-surface-200 transition-colors hover:text-surface-50"
	>
		<span aria-hidden="true">←</span> Back
	</a>
	<div class="card w-full max-w-sm rounded-2xl border border-surface-700 bg-surface-900 p-7">
		<h1 class="mb-6 font-display text-2xl font-bold text-surface-50">{title}</h1>
		{@render children()}
	</div>
</div>

<style>
	/* Under the kit. The camera puts the kit in the top of the frame (stage/scene.ts),
	   and the padding keeps the card clear of it. A short screen scrolls. */
	.door {
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		padding: 43svh 1rem 1.5rem;
	}
	.card {
		box-shadow:
			0 24px 60px rgb(0 0 0 / 0.55),
			0 2px 8px rgb(0 0 0 / 0.4);
	}
	/* Beside the kit. The same test as SIDE_BY_SIDE in stage/scene.ts: keep them in step. */
	@media (min-width: 720px) and (min-aspect-ratio: 5/4) {
		.door {
			align-items: flex-end;
			justify-content: center;
			padding: 1.5rem clamp(1.5rem, 10vw, 12rem) 1.5rem 1rem;
		}
	}
	/* Reached by a link: wait for the camera, then come up as it settles. A fresh load
	   skips this, so the form is there to type into at once. */
	@media (prefers-reduced-motion: no-preference) {
		:global(.travelled) .card,
		:global(.travelled) .back {
			animation: arrive 0.8s cubic-bezier(0.16, 1, 0.3, 1) 1.15s both;
		}
		@keyframes arrive {
			from {
				opacity: 0;
				translate: 0 1.5rem;
			}
		}
	}
</style>
