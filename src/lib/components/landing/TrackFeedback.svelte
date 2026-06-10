<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';

	// Deterministic pseudo-waveform: same bars on server and client render
	const BARS = Array.from({ length: 56 }, (_, i) => {
		const wave =
			Math.sin(i * 0.42 + 1.1) * 0.45 + Math.sin(i * 0.83) * 0.35 + Math.sin(i * 1.7 + 0.4) * 0.2;
		return 0.18 + 0.72 * Math.abs(wave);
	});

	const comments = [
		{ at: '0:19', name: 'Sam', text: 'Slow the intro a hair. Let it breathe.', mark: 0.32 },
		{ at: '0:54', name: 'Dee', text: 'Double the kick into the second chorus.', mark: 0.68 }
	];

	// Static resting point for no-JS / reduced-motion: mid-listen, both notes in
	const RESTING = 0.62;

	let root: HTMLDivElement;
	let waveWrap: HTMLDivElement;
	let playedEl: HTMLDivElement;
	let playheadEl: HTMLDivElement;

	onMount(() => {
		gsap.registerPlugin(ScrollTrigger);
		const mm = gsap.matchMedia();

		mm.add('(prefers-reduced-motion: no-preference)', () => {
			const rows = gsap.utils.toArray<HTMLElement>('[data-comment]', root);
			gsap.set(playheadEl, { left: 0 });

			const proxy = { p: 0 };
			const render = () => {
				const width = waveWrap.clientWidth;
				playheadEl.style.transform = `translateX(${proxy.p * width}px)`;
				playedEl.style.clipPath = `inset(0 ${(1 - proxy.p) * 100}% 0 0)`;
				rows.forEach((row, i) => {
					row.style.opacity = proxy.p >= comments[i].mark ? '1' : '0.45';
				});
			};
			render();

			const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.2, paused: true });
			tl.to(proxy, { p: 1, duration: 9, ease: 'none', onUpdate: render });

			const st = ScrollTrigger.create({
				trigger: root,
				start: 'top bottom',
				end: 'bottom top',
				onToggle: (self) => (self.isActive ? tl.play() : tl.pause())
			});

			return () => {
				st.kill();
				tl.kill();
				rows.forEach((row) => (row.style.opacity = ''));
				playedEl.style.clipPath = '';
				playheadEl.style.transform = '';
			};
		});

		return () => mm.revert();
	});
</script>

<div bind:this={root} class="rounded-xl border border-surface-700 bg-surface-800 shadow-md">
	<header class="flex items-center justify-between border-b border-surface-700 px-5 py-4">
		<h3 class="font-display text-lg font-semibold text-surface-100">Wildfire · demo</h3>
		<span class="rounded-full bg-accent-900/50 px-2 py-0.5 text-xs font-medium text-accent-300">
			v2
		</span>
	</header>

	<div class="px-5 pt-7 pb-5">
		<div bind:this={waveWrap} class="relative h-20" aria-hidden="true">
			<!-- Unplayed waveform -->
			<div class="absolute inset-0 flex items-end gap-[2px]">
				{#each BARS as height, i (i)}
					<span
						class="flex-1 rounded-[1px] bg-surface-600"
						style="height: {Math.round(height * 100)}%"
					></span>
				{/each}
			</div>
			<!-- Played portion, clipped to the playhead -->
			<div
				bind:this={playedEl}
				class="absolute inset-0 flex items-end gap-[2px]"
				style="clip-path: inset(0 {(1 - RESTING) * 100}% 0 0)"
			>
				{#each BARS as height, i (i)}
					<span
						class="flex-1 rounded-[1px] bg-accent-400"
						style="height: {Math.round(height * 100)}%"
					></span>
				{/each}
			</div>
			<!-- Comment pins -->
			{#each comments as comment (comment.at)}
				<span
					class="absolute -top-2.5 h-2 w-2 -translate-x-1/2 rounded-full bg-accent-400"
					style="left: {comment.mark * 100}%"
				></span>
			{/each}
			<!-- The playhead: the limelight is on because the track is live -->
			<div
				bind:this={playheadEl}
				class="absolute inset-y-0 w-px bg-neon-400 shadow-glow-neon"
				style="left: {RESTING * 100}%"
			></div>
		</div>
	</div>

	<ul class="space-y-3 border-t border-surface-700 bg-surface-900/60 px-5 py-5">
		{#each comments as comment (comment.at)}
			<li data-comment class="flex items-baseline gap-3">
				<span
					class="shrink-0 rounded-full bg-accent-900/50 px-2 py-0.5 font-display text-xs font-semibold text-accent-300"
				>
					{comment.at}
				</span>
				<p class="text-sm leading-relaxed text-surface-300">
					<span class="font-semibold text-surface-100">{comment.name}</span>
					{comment.text}
				</p>
			</li>
		{/each}
	</ul>
</div>
