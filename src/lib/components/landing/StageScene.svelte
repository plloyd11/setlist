<script lang="ts">
	import { onMount } from 'svelte';
	import type { ShotName, Stage } from './stage/scene.js';

	/** Which page's camera position to hold. Changing it flies the camera there. */
	let { shot = 'home' }: { shot?: ShotName } = $props();

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let lit = $state(false);
	let stage = $state.raw<Stage>();

	/**
	 * Without a GPU the browser draws WebGL on the CPU: a few frames a second, with the
	 * main thread held up so badly that the sign-in form under it stops responding. Those
	 * machines keep the painted fallback. So does the e2e suite, whose headless browsers
	 * render in software; with the scene running, parallel workers time out signing in.
	 * Chrome doesn't count its software renderer as a "major performance caveat", so the
	 * renderer's name is checked as well.
	 */
	function hasGpu(): boolean {
		const gl = document
			.createElement('canvas')
			.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
		if (!gl) return false;
		const info = gl.getExtension('WEBGL_debug_renderer_info');
		const name = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
		gl.getExtension('WEBGL_lose_context')?.loseContext();
		return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
	}

	onMount(() => {
		let gone = false;

		if (!hasGpu()) return;

		// three.js is large and only these pages use it, so it loads after first paint
		import('./stage/scene.js')
			.then(({ createStage }) => {
				if (gone) return;
				stage = createStage(canvas, host, shot, () => (lit = true));
			})
			.catch(() => {
				// No WebGL, or the chunk didn't arrive: the painted fallback stays up
			});

		return () => {
			gone = true;
			stage?.dispose();
		};
	});

	$effect(() => stage?.setShot(shot));
</script>

<!-- Fixed, not absolute: the page over it may scroll, and the stage shouldn't -->
<div bind:this={host} class="fixed inset-0 overflow-hidden" aria-hidden="true">
	<div class="fallback absolute inset-0"></div>
	<canvas
		bind:this={canvas}
		class="absolute inset-0 h-full w-full transition-opacity duration-500 motion-reduce:transition-none"
		class:opacity-0={!lit}
	></canvas>
</div>

<style>
	/* Shown while the scene loads, and instead of it without WebGL: warm and cool
	   pools of light over a dark deck */
	.fallback {
		background:
			radial-gradient(60% 70% at 50% 8%, rgba(120, 169, 255, 0.12), transparent 70%),
			radial-gradient(45% 70% at 22% 6%, rgba(255, 154, 77, 0.14), transparent 70%),
			radial-gradient(45% 70% at 78% 6%, rgba(255, 154, 77, 0.14), transparent 70%),
			linear-gradient(to bottom, #080c13 0%, #0b1119 62%, #1c130d 62%, #0f0a07 100%);
	}
</style>
