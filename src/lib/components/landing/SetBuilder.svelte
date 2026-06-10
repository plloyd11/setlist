<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { formatDuration } from '$lib/utils/duration';

	const TARGET = 2100;

	// The last song overshoots the 35:00 slot on purpose: it lands, the readout
	// flips red, and the scroll cuts it. That edit is the product's whole pitch.
	const songs = [
		{ name: 'Voltage Hymn', seconds: 222, cut: false },
		{ name: 'Mile Marker 29', seconds: 245, cut: false },
		{ name: 'Gasoline Heart', seconds: 198, cut: false },
		{ name: 'Static & Smoke', seconds: 287, cut: false },
		{ name: 'The Long Way Home', seconds: 312, cut: false },
		{ name: 'Copperline', seconds: 261, cut: false },
		{ name: 'Last Call Choir', seconds: 235, cut: false },
		{ name: 'Wildfire', seconds: 298, cut: false },
		{ name: 'Neon Mile', seconds: 273, cut: true }
	];
	const keptTotal = songs.filter((s) => !s.cut).reduce((sum, s) => sum + s.seconds, 0);

	let root: HTMLElement;
	let stage: HTMLDivElement;
	let copy: HTMLDivElement;
	let panel: HTMLDivElement;
	let ringEl: HTMLDivElement;
	let totalEl: HTMLSpanElement;
	let diffEl: HTMLSpanElement;
	let barEl: HTMLDivElement;

	onMount(() => {
		gsap.registerPlugin(ScrollTrigger);
		const mm = gsap.matchMedia();

		mm.add('(prefers-reduced-motion: no-preference)', () => {
			const rows = gsap.utils.toArray<HTMLElement>('[data-row]', panel);
			const cutRow = rows[rows.length - 1];

			const render = (value: number) => {
				const total = Math.round(value);
				const over = total > TARGET;
				totalEl.textContent = formatDuration(total);
				diffEl.textContent = `${over ? '+' : '-'}${formatDuration(Math.abs(total - TARGET))}`;
				diffEl.classList.toggle('text-danger-300', over);
				diffEl.classList.toggle('text-success-300', !over);
				barEl.classList.toggle('bg-danger-400', over);
				barEl.classList.toggle('bg-success-400', !over);
				barEl.style.transform = `scaleX(${Math.min(total / TARGET, 1)})`;
				cutRow.classList.toggle('over-culprit', over);
			};
			const restore = () => {
				render(keptTotal);
				cutRow.classList.remove('over-culprit');
			};

			gsap.set(rows, { y: 26, autoAlpha: 0 });
			gsap.set(cutRow, { display: 'flex' });

			const counter = { v: 0 };
			render(0);

			const tl = gsap.timeline({
				defaults: { ease: 'power3.out' },
				scrollTrigger: {
					trigger: root,
					start: 'top top',
					end: '+=2800',
					scrub: 0.6,
					pin: stage,
					anticipatePin: 1
				}
			});

			tl.from(copy, { y: 36, autoAlpha: 0, duration: 0.4 }, 0);

			let cumulative = 0;
			songs.forEach((song, i) => {
				cumulative += song.seconds;
				const value = cumulative;
				tl.to(rows[i], { y: 0, autoAlpha: 1, duration: 0.45 }, i === 0 ? 0.45 : '>-0.08');
				tl.to(
					counter,
					{ v: value, duration: 0.45, ease: 'none', onUpdate: () => render(counter.v) },
					'<'
				);
			});

			tl.to({}, { duration: 0.5 }); // sit with the overrun
			tl.to(cutRow, { x: 96, autoAlpha: 0, duration: 0.55, ease: 'power2.in' });
			tl.to(
				counter,
				{ v: keptTotal, duration: 0.55, ease: 'none', onUpdate: () => render(counter.v) },
				'<'
			);
			tl.fromTo(ringEl, { opacity: 0 }, { opacity: 1, duration: 0.15 }, '>-0.05');
			tl.to(ringEl, { opacity: 0, duration: 0.55 });
			tl.to({}, { duration: 0.35 }); // exhale before the unpin

			return restore;
		});

		return () => mm.revert();
	});
</script>

<section bind:this={root} class="relative bg-surface-900">
	<div bind:this={stage} class="flex min-h-svh items-center py-16 md:py-0">
		<div
			class="mx-auto grid w-full max-w-6xl items-center gap-10 px-6 lg:grid-cols-[5fr_6fr] lg:gap-16"
		>
			<div bind:this={copy}>
				<h2
					class="font-display text-[clamp(2.1rem,4.5vw,3.5rem)] leading-[1.05] font-bold text-balance text-surface-50"
				>
					Every second, accounted for.
				</h2>
				<p class="mt-5 max-w-[46ch] text-base leading-relaxed text-surface-300 md:text-lg">
					Set a target. Drag songs in. The running total updates with every drop, so the set that
					runs long gets fixed at the kitchen table, not in front of a crowd.
				</p>
				<p class="mt-6 hidden text-sm text-surface-300 italic motion-safe:block">
					Keep scrolling. The set builds itself.
				</p>
			</div>

			<div bind:this={panel} class="relative">
				<div
					bind:this={ringEl}
					class="pointer-events-none absolute -inset-px rounded-xl border border-neon-400 opacity-0 shadow-glow-neon"
				></div>
				<div class="overflow-hidden rounded-xl border border-surface-700 bg-surface-800 shadow-lg">
					<header class="flex items-baseline justify-between border-b border-surface-700 px-5 py-4">
						<h3 class="font-display text-lg font-semibold text-surface-100">Friday · The Roxy</h3>
						<p class="text-[0.625rem] font-medium tracking-[0.05em] text-surface-300 uppercase">
							Target
							<span
								class="ml-1 font-display text-sm font-semibold tracking-normal text-surface-200 normal-case"
							>
								35:00
							</span>
						</p>
					</header>
					<ol class="px-2 py-2">
						{#each songs as song, i (song.name)}
							<li
								data-row
								class="{song.cut
									? 'hidden'
									: 'flex'} items-center gap-3 rounded-lg border border-transparent px-3 py-2 md:py-2.5"
							>
								<span class="w-6 text-right font-display text-sm text-surface-400">{i + 1}</span>
								<span
									class="flex-1 truncate text-sm font-medium text-surface-100 md:text-[0.9375rem]"
								>
									{song.name}
								</span>
								<span class="font-display text-sm font-semibold text-surface-300">
									{formatDuration(song.seconds)}
								</span>
							</li>
						{/each}
					</ol>
					<footer class="border-t border-surface-700 bg-surface-900/60 px-5 pt-4 pb-5">
						<div class="flex items-end justify-between gap-6">
							<div>
								<p class="text-[0.625rem] font-medium tracking-[0.05em] text-surface-300 uppercase">
									Total
								</p>
								<span
									bind:this={totalEl}
									class="font-display text-4xl font-bold text-accent-hot md:text-5xl"
								>
									{formatDuration(keptTotal)}
								</span>
							</div>
							<div class="text-right">
								<p class="text-[0.625rem] font-medium tracking-[0.05em] text-surface-300 uppercase">
									Diff
								</p>
								<span
									bind:this={diffEl}
									class="font-display text-2xl font-semibold text-success-300 md:text-3xl"
								>
									-{formatDuration(TARGET - keptTotal)}
								</span>
							</div>
						</div>
						<div class="mt-4 h-1 overflow-hidden rounded-full bg-surface-700">
							<div
								bind:this={barEl}
								class="h-full origin-left rounded-full bg-success-400"
								style="transform: scaleX({keptTotal / TARGET})"
							></div>
						</div>
					</footer>
				</div>
			</div>
		</div>
	</div>
</section>

<style>
	:global(li.over-culprit) {
		border-color: color-mix(in oklab, var(--color-danger-400) 45%, transparent);
		background: color-mix(in oklab, var(--color-danger-400) 8%, transparent);
	}
</style>
