<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { SplitText } from 'gsap/SplitText';
	import StageScene from '$lib/components/landing/StageScene.svelte';
	import SetBuilder from '$lib/components/landing/SetBuilder.svelte';
	import TapeMarquee from '$lib/components/landing/TapeMarquee.svelte';
	import TrackFeedback from '$lib/components/landing/TrackFeedback.svelte';

	let pageEl: HTMLDivElement;
	let navEl: HTMLElement;
	let sceneWrap: HTMLDivElement;
	let headlineEl: HTMLHeadingElement;
	let limeEl: HTMLSpanElement;
	let subEl: HTMLParagraphElement;
	let ctaEl: HTMLAnchorElement;
	let cueEl: HTMLDivElement;

	onMount(() => {
		gsap.registerPlugin(ScrollTrigger, SplitText);

		const ctx = gsap.context(() => {
			ScrollTrigger.create({
				start: 60,
				end: '+=999999',
				toggleClass: { targets: navEl, className: 'nav-solid' }
			});

			const mm = gsap.matchMedia();
			mm.add('(prefers-reduced-motion: no-preference)', () => {
				gsap.set(sceneWrap, { autoAlpha: 0 });
				gsap.set(headlineEl, { autoAlpha: 0 });
				gsap.set([subEl, ctaEl], { y: 26, autoAlpha: 0 });
				gsap.set(cueEl, { autoAlpha: 0 });

				let split: SplitText | undefined;
				// SplitText measures line breaks, so the webfonts must be in first
				document.fonts.ready.then(() => {
					if (!headlineEl?.isConnected) return;
					split = new SplitText(headlineEl, { type: 'lines,chars', mask: 'lines' });
					gsap.set(headlineEl, { autoAlpha: 1 });

					const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
					tl.to(sceneWrap, { autoAlpha: 1, duration: 1.8, ease: 'power2.inOut' }, 0);
					tl.from(split.chars, { yPercent: 110, duration: 0.9, stagger: 0.016 }, 0.3);
					// The limelight phrase strikes like a tube lamp, then burns steady
					tl.to(
						limeEl,
						{ keyframes: { opacity: [1, 0.25, 1, 0.4, 0.9, 1] }, duration: 0.5, ease: 'none' },
						'>-0.25'
					)
						.set(
							limeEl,
							{ textShadow: '0 0 24px rgba(187,201,42,0.55), 0 0 64px rgba(187,201,42,0.22)' },
							'<'
						)
						.to(limeEl, { textShadow: '0 0 0px rgba(187,201,42,0)', duration: 1.6 }, '>+0.25');
					tl.to([subEl, ctaEl], { y: 0, autoAlpha: 1, duration: 0.9, stagger: 0.12 }, 1.1);
					tl.to(cueEl, { autoAlpha: 1, duration: 0.8 }, 1.7);
				});

				gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
					gsap.from(el, {
						y: 34,
						autoAlpha: 0,
						duration: 0.9,
						ease: 'power3.out',
						scrollTrigger: { trigger: el, start: 'top 84%' }
					});
				});

				return () => split?.revert();
			});
		}, pageEl);

		return () => ctx.revert();
	});
</script>

<svelte:head>
	<title>Setlist · Know your set. Own the stage.</title>
	<meta
		name="description"
		content="Build setlists, track timing to the second, and keep your band in sync. The setlist builder for musicians who take the stage seriously."
	/>
</svelte:head>

<div bind:this={pageEl}>
	<nav bind:this={navEl} class="fixed inset-x-0 top-0 z-50 border-b border-transparent">
		<div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
			<a href="/" class="focus-live rounded-md font-display text-2xl font-bold text-accent-hot">
				Setlist
			</a>
			<div class="flex items-center gap-3">
				<a
					href="/auth"
					class="focus-live rounded-lg px-3 py-2 text-sm font-medium text-surface-300 transition-colors hover:text-surface-100"
				>
					Log in
				</a>
				<a
					href="/auth?redirect=/dashboard"
					class="focus-live rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-600"
				>
					Get started
				</a>
			</div>
		</div>
	</nav>

	<!-- Hero: the house lights -->
	<section
		class="relative flex min-h-svh items-center justify-center overflow-hidden bg-surface-950"
	>
		<div bind:this={sceneWrap} class="absolute inset-0">
			<StageScene />
			<div
				class="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-surface-900"
			></div>
		</div>
		<div class="relative z-10 mx-auto w-full max-w-5xl px-6 pt-20 pb-24 text-center">
			<h1
				bind:this={headlineEl}
				class="font-display text-[clamp(3rem,9vw,7.75rem)] leading-[0.98] font-black text-surface-50"
			>
				Know your set.<br />
				<span bind:this={limeEl} class="text-neon-300">Own the stage.</span>
			</h1>
			<p
				bind:this={subEl}
				class="mx-auto mt-7 max-w-xl text-lg leading-relaxed text-pretty text-surface-200 md:text-xl"
			>
				A song library, timed setlists, and one link your whole band plays from.
			</p>
			<a
				bind:this={ctaEl}
				href="/auth?redirect=/dashboard"
				class="focus-live mt-10 inline-block rounded-lg bg-accent-hot px-8 py-4 font-display text-lg font-bold text-surface-950 shadow-glow-accent transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 motion-reduce:transition-none"
			>
				Build your first setlist
			</a>
		</div>
		<div
			bind:this={cueEl}
			class="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
		>
			<span class="text-[0.625rem] tracking-[0.2em] text-surface-300 uppercase">Scroll</span>
			<span class="relative block h-10 w-px overflow-hidden bg-surface-600">
				<span class="cue-dot absolute top-0 left-0 h-3 w-px bg-neon-400"></span>
			</span>
		</div>
	</section>

	<!-- The set builds itself -->
	<SetBuilder />

	<!-- The library -->
	<section class="overflow-hidden bg-surface-950 py-24 md:py-36">
		<div data-reveal class="mx-auto max-w-6xl px-6">
			<h2
				class="font-display text-[clamp(2.1rem,4.5vw,3.5rem)] leading-[1.05] font-bold text-balance text-surface-50"
			>
				Your whole catalog, one drag away.
			</h2>
			<p class="mt-5 max-w-[52ch] text-base leading-relaxed text-surface-300 md:text-lg">
				Songs are a name and a length. Search the library, drag a song into any set, and let band
				workspaces keep every copy in sync: edit it once, it updates everywhere it's played.
			</p>
		</div>
		<div class="mt-14 md:mt-20">
			<TapeMarquee />
		</div>
	</section>

	<!-- Song ideas & feedback -->
	<section class="bg-surface-900 py-24 md:py-36">
		<div class="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[5fr_6fr] lg:gap-20">
			<div data-reveal class="lg:order-last">
				<h2
					class="font-display text-[clamp(2.1rem,4.5vw,3.5rem)] leading-[1.05] font-bold text-balance text-surface-50"
				>
					Rough today. Tight by Friday.
				</h2>
				<p class="mt-5 max-w-[48ch] text-base leading-relaxed text-surface-300 md:text-lg">
					Drop a demo in the band workspace and let everyone weigh in. Comments pin to the exact
					second they're about, so &ldquo;fix the bridge&rdquo; finally points at the bridge. New
					takes stack up as versions instead of dying in the group chat.
				</p>
			</div>
			<div data-reveal class="lg:order-first">
				<TrackFeedback />
			</div>
		</div>
	</section>

	<!-- The share link -->
	<section class="bg-surface-950 py-24 md:py-36">
		<div class="mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-[6fr_5fr] lg:gap-20">
			<div data-reveal>
				<h2
					class="font-display text-[clamp(2.1rem,4.5vw,3.5rem)] leading-[1.05] font-bold text-balance text-surface-50"
				>
					One link. The whole band plays from it.
				</h2>
				<p class="mt-5 max-w-[48ch] text-base leading-relaxed text-surface-300 md:text-lg">
					Share a read-only page your drummer can open from a text: big type, dark-stage legible,
					always the latest version. No login, no app, no wrong PDF.
				</p>
			</div>
			<div data-reveal>
				<div
					class="flex items-center justify-between gap-3 rounded-lg border border-surface-700 bg-surface-800 px-4 py-3"
				>
					<span class="truncate text-sm text-surface-300">setlist.app/share/k7x2m9q4</span>
					<span class="flex shrink-0 items-center gap-2">
						<span class="h-2 w-2 rounded-full bg-accent-hot shadow-glow-accent"></span>
						<span class="text-[0.625rem] font-medium tracking-[0.05em] text-accent-300 uppercase">
							Sharing on
						</span>
					</span>
				</div>
				<div class="mt-4 rounded-xl border border-surface-700 bg-surface-800 shadow-md">
					<header class="flex items-baseline justify-between border-b border-surface-700 px-5 py-4">
						<h3 class="font-display text-lg font-semibold text-surface-100">Friday · The Roxy</h3>
						<p class="text-sm text-surface-300">8 songs</p>
					</header>
					<ol class="px-2 py-2">
						{#each [['Voltage Hymn', '3:42'], ['Mile Marker 29', '4:05'], ['Gasoline Heart', '3:18'], ['Static & Smoke', '4:47']] as [name, time], i (name)}
							<li class="flex items-center gap-3 px-3 py-2">
								<span class="w-6 text-right font-display text-sm text-surface-400">{i + 1}</span>
								<span class="flex-1 truncate text-sm font-medium text-surface-100">{name}</span>
								<span class="font-display text-sm font-semibold text-surface-300">{time}</span>
							</li>
						{/each}
						<li class="px-3 py-2 pl-12 text-sm text-surface-400">4 more…</li>
					</ol>
					<footer
						class="flex items-end justify-between border-t border-surface-700 bg-surface-900/60 px-5 pt-4 pb-5"
					>
						<div>
							<p class="text-[0.625rem] font-medium tracking-[0.05em] text-surface-300 uppercase">
								Total
							</p>
							<span class="font-display text-3xl font-bold text-accent-hot">34:18</span>
						</div>
						<p class="text-sm font-medium text-success-300">Fits the 35:00 slot</p>
					</footer>
				</div>
			</div>
		</div>
	</section>

	<!-- Final call -->
	<section class="relative overflow-hidden bg-surface-950 py-28 md:py-40">
		<div class="cta-pool absolute inset-0" aria-hidden="true"></div>
		<div data-reveal class="relative mx-auto max-w-4xl px-6 text-center">
			<h2
				class="font-display text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.98] font-black text-surface-50"
			>
				Walk on ready.
			</h2>
			<p class="mx-auto mt-6 max-w-md text-lg leading-relaxed text-surface-300">
				Add your songs, set a target, drag until it fits. Your next set starts here.
			</p>
			<a
				href="/auth?redirect=/dashboard"
				class="focus-live mt-10 inline-block rounded-lg bg-accent-hot px-8 py-4 font-display text-lg font-bold text-surface-950 shadow-glow-accent transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 motion-reduce:transition-none"
			>
				Build your first setlist
			</a>
		</div>
	</section>

	<footer class="border-t border-surface-800 bg-surface-950 px-6 py-10">
		<div class="mx-auto flex max-w-6xl flex-col items-center gap-6 md:flex-row md:justify-between">
			<a href="/" class="focus-live rounded-md font-display text-xl font-bold text-accent-hot">
				Setlist
			</a>
			<div class="flex items-center gap-6">
				<a
					href="/auth"
					class="focus-live rounded-md text-sm text-surface-300 transition-colors hover:text-surface-100"
				>
					Sign up
				</a>
				<a
					href="/auth"
					class="focus-live rounded-md text-sm text-surface-300 transition-colors hover:text-surface-100"
				>
					Log in
				</a>
			</div>
			<p class="text-sm text-surface-300">&copy; 2026 Setlist</p>
		</div>
	</footer>
</div>

<style>
	nav {
		transition:
			background-color 0.3s,
			border-color 0.3s;
	}
	:global(nav.nav-solid) {
		background: color-mix(in oklab, var(--color-surface-900) 94%, transparent);
		border-color: var(--color-surface-700);
	}
	.cta-pool {
		background: radial-gradient(60% 50% at 50% 100%, rgba(215, 137, 81, 0.1), transparent 70%);
	}
	@media (prefers-reduced-motion: no-preference) {
		.cue-dot {
			animation: cue 2.2s cubic-bezier(0.16, 1, 0.3, 1) infinite;
		}
		@keyframes cue {
			0% {
				transform: translateY(-12px);
				opacity: 0;
			}
			30% {
				opacity: 1;
			}
			100% {
				transform: translateY(40px);
				opacity: 0;
			}
		}
	}
</style>
