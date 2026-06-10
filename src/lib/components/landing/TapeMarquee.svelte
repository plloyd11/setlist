<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';

	const ROWS = [
		[
			{ name: 'Voltage Hymn', time: '3:42' },
			{ name: 'Mile Marker 29', time: '4:05' },
			{ name: 'Gasoline Heart', time: '3:18' },
			{ name: 'Static & Smoke', time: '4:47' },
			{ name: 'The Long Way Home', time: '5:12' },
			{ name: 'Copperline', time: '4:21' },
			{ name: 'Last Call Choir', time: '3:55' },
			{ name: 'Wildfire', time: '4:58' }
		],
		[
			{ name: 'Neon Mile', time: '4:33' },
			{ name: 'Borrowed Time', time: '3:27' },
			{ name: 'Royal Static', time: '3:51' },
			{ name: 'Glass Jaw', time: '2:58' },
			{ name: 'Midnight Freight', time: '5:40' },
			{ name: 'Paper Crown', time: '3:33' },
			{ name: 'Dead Reckoning', time: '4:12' },
			{ name: 'Hum of the Amps', time: '3:08' }
		]
	];

	let root: HTMLDivElement;

	onMount(() => {
		gsap.registerPlugin(ScrollTrigger);
		const mm = gsap.matchMedia();

		mm.add('(prefers-reduced-motion: no-preference)', () => {
			const tracks = gsap.utils.toArray<HTMLElement>('[data-track]', root);
			const drift = tracks.map((track, i) =>
				gsap.fromTo(
					track,
					{ xPercent: i % 2 ? -50 : 0 },
					{ xPercent: i % 2 ? 0 : -50, duration: 48 + i * 7, ease: 'none', repeat: -1 }
				)
			);
			const st = ScrollTrigger.create({
				trigger: root,
				start: 'top bottom',
				end: 'bottom top',
				onUpdate(self) {
					const kick = 1 + Math.min(Math.abs(self.getVelocity()) / 1000, 3);
					drift.forEach((tween) => {
						tween.timeScale(kick);
						gsap.to(tween, { timeScale: 1, duration: 1.4, ease: 'power3.out', overwrite: true });
					});
				}
			});
			return () => {
				st.kill();
				drift.forEach((tween) => tween.kill());
			};
		});

		return () => mm.revert();
	});
</script>

<div bind:this={root} class="-rotate-[1.4deg] space-y-4" aria-hidden="true">
	{#each ROWS as row, rowIndex (rowIndex)}
		<div class="overflow-hidden">
			<div data-track class="flex w-max">
				{#each [0, 1] as copyIndex (copyIndex)}
					<div class="flex gap-4 pr-4">
						{#each row as song, i (song.name)}
							<span
								class="inline-flex items-baseline gap-3 rounded-md border border-surface-700 bg-surface-800 px-4 py-2.5 whitespace-nowrap {i %
									2 ===
								0
									? '-rotate-[0.5deg]'
									: 'rotate-[0.6deg]'}"
							>
								<span class="text-sm font-medium text-surface-200">{song.name}</span>
								<span class="font-display text-sm font-semibold text-accent-300">{song.time}</span>
							</span>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	{/each}
</div>
