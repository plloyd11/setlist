<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { panel, primaryButton, sectionHeading } from '#lib/components/practice/practiceStyles.js';
	import {
		tour,
		startTour,
		nextStep,
		prevStep,
		endTour,
		claimAutoStart
	} from '#lib/stores/tour.svelte.js';
	import {
		TOUR_STEPS,
		TOUR_HOME,
		placeTourCard,
		shouldAutoStartTour,
		type TourBox,
		type TourUser
	} from '#lib/utils/tour.js';

	let { user, supabase }: { user: TourUser | null; supabase: SupabaseClient } = $props();

	const uid = $props.id();

	/** The hole is a little bigger than the control it lights */
	const HOLE_PAD = 6;
	/** How long a freshly opened page gets to draw its anchor before the card gives up on it */
	const ANCHOR_WAIT_MS = 1500;

	const ghostButton =
		'focus-live min-h-11 rounded-lg px-3 text-sm font-medium text-surface-600 transition-colors duration-150 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-300 dark:hover:bg-surface-700 dark:hover:text-surface-100';

	let dialogEl: HTMLDialogElement | undefined = $state();
	let cardEl: HTMLElement | undefined = $state();
	let nextButton: HTMLButtonElement | undefined = $state();

	let hole = $state<TourBox | null>(null);
	let cardPos = $state<{ x: number; y: number } | null>(null);
	// The card glides between steps, but must not glide in from the corner on its first frame
	let cardMoves = $state(false);
	let anchorMissing = $state(false);

	// Tracking state the frame loop owns; nothing renders from these
	let anchorEl: HTMLElement | null = null;
	let navigating = false;
	let waitUntil = 0;
	let stepRun = 0;

	let step = $derived(TOUR_STEPS[tour.index]);
	let isLast = $derived(tour.index === TOUR_STEPS.length - 1);
	let body = $derived(anchorMissing && step.fallbackBody ? step.fallbackBody : step.body);

	// A new account gets the tour the first time it reaches Home. It's marked seen as it
	// starts, not as it ends, so closing the tab halfway never brings it back.
	$effect(() => {
		if (tour.active || page.url.pathname !== TOUR_HOME || !shouldAutoStartTour(user)) return;
		if (!claimAutoStart()) return;
		startTour();
		void supabase.auth.updateUser({ data: { tour_seen: true } });
	});

	// A modal dialog sits in the top layer, makes the page behind it inert and traps focus.
	// It's only in the DOM while the tour runs, so opening it is just a matter of it arriving.
	$effect(() => {
		const dialog = dialogEl;
		if (!dialog || dialog.open) return;
		dialog.showModal();
		nextButton?.focus();
	});

	$effect(() => {
		if (!tour.active) return;
		const index = tour.index;
		untrack(() => enterStep(index));
	});

	async function enterStep(index: number) {
		const run = ++stepRun;
		const target = TOUR_STEPS[index];
		anchorEl = null;
		anchorMissing = false;
		navigating = false;
		waitUntil = 0;

		if (target.route && window.location.pathname !== target.route) {
			// Close the hole while the page changes under it
			navigating = true;
			hole = null;
			try {
				// A navigation normally blurs the focused control and resets focus to the body,
				// which would drop it out of the dialog and take the arrow keys with it
				await goto(target.route, { reset: false });
			} catch {
				// A failed navigation leaves the card up with no hole; Next and Skip still work
			}
			if (run !== stepRun) return;
			navigating = false;
			waitUntil = performance.now() + ANCHOR_WAIT_MS;
		}

		await tick();
		if (run !== stepRun) return;
		// Back disappears on the first step and Skip on the last, taking focus with them
		if (!cardEl?.contains(document.activeElement)) nextButton?.focus();
	}

	// Measured every frame rather than on resize and scroll: pages settle after they load
	// (fonts, the dashboard's time zone refresh, the rail sliding), and one rect read is cheap
	$effect(() => {
		if (!tour.active) return;
		let raf = requestAnimationFrame(function frame() {
			raf = requestAnimationFrame(frame);
			track();
		});
		return () => cancelAnimationFrame(raf);
	});

	function isVisible(el: HTMLElement): boolean {
		return el.isConnected && el.getClientRects().length > 0;
	}

	function findAnchor(name: string): HTMLElement | null {
		for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
			if (isVisible(el)) return el;
		}
		return null;
	}

	function track() {
		if (!cardEl) return;
		if (cardPos) cardMoves = true;

		if (navigating) return;
		if (!anchorEl || !isVisible(anchorEl)) {
			anchorEl = findAnchor(step.anchor);
			// Pages scroll inside <main>, which keeps its offset from the page before. Something
			// taller than the screen (the rig's rack) shows its top, not its middle.
			if (anchorEl) {
				const tall = anchorEl.getBoundingClientRect().height > window.innerHeight * 0.8;
				anchorEl.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest' });
			}
		}

		if (anchorEl) {
			const rect = anchorEl.getBoundingClientRect();
			const next = {
				top: Math.round(rect.top) - HOLE_PAD,
				left: Math.round(rect.left) - HOLE_PAD,
				width: Math.round(rect.width) + HOLE_PAD * 2,
				height: Math.round(rect.height) + HOLE_PAD * 2
			};
			if (
				!hole ||
				hole.top !== next.top ||
				hole.left !== next.left ||
				hole.width !== next.width ||
				hole.height !== next.height
			) {
				hole = next;
			}
			anchorMissing = false;
		} else if (performance.now() < waitUntil) {
			// The page is still drawing: hold the card where it is
			if (cardPos) return;
		} else {
			hole = null;
			anchorMissing = true;
		}

		const next = placeTourCard(
			hole,
			{ width: cardEl.offsetWidth, height: cardEl.offsetHeight },
			{ width: window.innerWidth, height: window.innerHeight },
			step.placement
		);
		if (!cardPos || cardPos.x !== next.x || cardPos.y !== next.y) cardPos = next;
	}

	async function finish() {
		if (!tour.active) return;
		stepRun++;
		const origin = tour.origin;
		// Closed before it's removed: closing is what hands focus back to whatever opened it
		if (dialogEl?.open) dialogEl.close();
		endTour();
		hole = null;
		cardPos = null;
		cardMoves = false;
		anchorEl = null;
		navigating = false;
		// reset: false leaves that focus where it is while the page follows
		if (window.location.pathname + window.location.search !== origin) {
			await goto(origin, { reset: false });
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
		if (event.key === 'ArrowRight' && !isLast) {
			event.preventDefault();
			nextStep();
		} else if (event.key === 'ArrowLeft' && tour.index > 0) {
			event.preventDefault();
			prevStep();
		}
	}
</script>

{#if tour.active}
	<!-- Esc closes a modal dialog natively; onclose catches that and every other way out -->
	<dialog
		bind:this={dialogEl}
		class="fixed inset-0 m-0 h-full max-h-none w-full max-w-none overflow-visible bg-transparent p-0 backdrop:bg-transparent"
		aria-labelledby="{uid}-title"
		aria-describedby="{uid}-body"
		onclose={finish}
		onkeydown={handleKeydown}
	>
		<!-- One element is both the scrim and the hole in it: the shadow dims everything
		     around the box. With no anchor it shrinks to nothing and the scrim is whole. -->
		<div
			class="tour-hole"
			class:tour-hole-open={hole}
			aria-hidden="true"
			style:top={hole ? `${hole.top}px` : undefined}
			style:left={hole ? `${hole.left}px` : undefined}
			style:width={hole ? `${hole.width}px` : undefined}
			style:height={hole ? `${hole.height}px` : undefined}
		></div>

		<div
			bind:this={cardEl}
			class="{panel} fixed top-0 left-0 w-[min(20rem,calc(100vw-1.5rem))] p-4 shadow-lg"
			class:tour-card-moves={cardMoves}
			style:transform={cardPos ? `translate(${cardPos.x}px, ${cardPos.y}px)` : undefined}
			style:visibility={cardPos ? 'visible' : 'hidden'}
		>
			<!-- The signal chain from the first-run board: copper is done, the lit lamp is now -->
			<div class="flex items-center gap-1.5" aria-hidden="true">
				{#each TOUR_STEPS as tourStep, i (tourStep.id)}
					<span
						class="h-2 w-2 rounded-full {i < tour.index
							? 'bg-accent-500 dark:bg-accent-400'
							: i === tour.index
								? 'lamp-live bg-neon-600 dark:bg-neon-400'
								: 'border border-surface-300 dark:border-surface-600'}"
					></span>
				{/each}
			</div>

			<div class="mt-3" aria-live="polite" aria-atomic="true">
				<p class="sr-only">Step {tour.index + 1} of {TOUR_STEPS.length}</p>
				<h2 id="{uid}-title" class={sectionHeading}>{step.title}</h2>
				<p id="{uid}-body" class="mt-1.5 text-sm text-surface-600 dark:text-surface-300">
					{body}
				</p>
			</div>

			<div class="mt-4 flex items-center gap-1">
				{#if !isLast}
					<button type="button" class="{ghostButton} -ml-3" onclick={finish}>Skip tour</button>
				{/if}
				<span class="flex-1"></span>
				{#if tour.index > 0}
					<button type="button" class={ghostButton} onclick={prevStep}>Back</button>
				{/if}
				<button
					bind:this={nextButton}
					type="button"
					class="{primaryButton} text-sm"
					onclick={() => (isLast ? finish() : nextStep())}
				>
					{isLast ? 'Done' : 'Next'}
				</button>
			</div>
		</div>
	</dialog>
{/if}

<style>
	.tour-hole {
		position: fixed;
		top: 50%;
		left: 50%;
		width: 0;
		height: 0;
		border-radius: 0.5rem;
		pointer-events: none;
		box-shadow: 0 0 0 100vmax rgb(8 12 19 / 0.68);
		transition-property: top, left, width, height;
		transition-duration: 220ms;
		transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
	}
	/* The lit control is the live one, so it gets the Limelight ring */
	.tour-hole-open {
		box-shadow:
			0 0 0 2px var(--focus-live-color),
			0 0 0 100vmax rgb(8 12 19 / 0.68);
	}
	.tour-card-moves {
		transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}
	@media (prefers-reduced-motion: reduce) {
		.tour-hole,
		.tour-card-moves {
			transition: none;
		}
	}
</style>
