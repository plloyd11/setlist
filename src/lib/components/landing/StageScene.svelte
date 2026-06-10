<script lang="ts">
	import { onMount } from 'svelte';

	let host: HTMLDivElement;
	let canvas: HTMLCanvasElement;

	const VERT = `
attribute vec2 a_pos;
void main() {
	gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

	// Two stage lamps over a navy room: copper house-left, limelight house-right.
	// Haze is fbm noise drifting along each beam; dust motes only sparkle inside light.
	const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;

float hash(vec2 p) {
	p = fract(p * vec2(123.34, 345.45));
	p += dot(p, p + 34.345);
	return fract(p.x * p.y);
}
float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash(i);
	float b = hash(i + vec2(1.0, 0.0));
	float c = hash(i + vec2(0.0, 1.0));
	float d = hash(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 4; i++) {
		v += a * noise(p);
		p = p * 2.03 + vec2(1.7);
		a *= 0.5;
	}
	return v;
}
float beam(vec2 q, vec2 src, vec2 dir, float spread, float falloff) {
	vec2 v = q - src;
	float along = dot(v, dir);
	if (along < 0.0) return 0.0;
	float perp = abs(dot(v, vec2(-dir.y, dir.x)));
	float width = spread * (0.05 + along);
	float i = 1.0 - smoothstep(0.0, width, perp);
	return i * exp(-along * falloff);
}
float dust(vec2 q, float t, float scale, float seed) {
	vec2 g = q * scale + vec2(seed * 7.3, t * 0.02);
	vec2 id = floor(g);
	vec2 f = fract(g);
	float h = hash(id + seed);
	vec2 pos = 0.15 + 0.7 * vec2(hash(id + seed + 1.7), hash(id + seed + 3.1));
	pos += 0.1 * vec2(sin(t * (0.2 + 0.3 * h) + h * 6.28), cos(t * (0.17 + 0.25 * h) + h * 6.28));
	float d = length(f - pos);
	float tw = 0.45 + 0.55 * sin(t * (0.6 + h * 1.7) + h * 6.28);
	return smoothstep(0.05, 0.005, d) * tw * step(0.55, h);
}
void main() {
	vec2 uv = gl_FragCoord.xy / u_res;
	float aspect = u_res.x / u_res.y;
	float halfW = 0.5 * aspect;
	vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
	vec2 par = u_mouse * 0.035;

	vec3 col = mix(vec3(0.024, 0.036, 0.058), vec3(0.045, 0.066, 0.096), uv.y * 0.7);

	vec2 srcA = vec2(-halfW * 0.78, 0.78) + par;
	vec2 dirA = normalize(vec2(0.42, -1.0));
	float bA = beam(q, srcA, dirA, 0.55, 1.45);
	bA *= 0.55 + 0.6 * fbm(q * 2.6 + vec2(u_time * 0.03, -u_time * 0.05));

	vec2 srcB = vec2(halfW * 0.74, 0.84) - par;
	vec2 dirB = normalize(vec2(-0.38, -1.0));
	float bB = beam(q, srcB, dirB, 0.42, 1.7);
	bB *= 0.5 + 0.6 * fbm(q * 3.1 + vec2(-u_time * 0.04, -u_time * 0.045) + 11.0);

	vec3 copper = vec3(0.843, 0.537, 0.318);
	vec3 lime = vec3(0.733, 0.788, 0.165);
	col += copper * bA * 0.5;
	col += lime * bB * 0.22;

	float lit = clamp(bA + bB, 0.0, 1.0);
	float motes = dust(q, u_time, 9.0, 0.0) + dust(q, u_time * 1.1, 16.0, 4.2) * 0.6;
	col += (copper * 0.7 + lime * 0.3) * motes * lit * 0.9;

	float pool = exp(-pow(length((q - vec2(0.16, -0.46)) * vec2(1.0, 2.6)), 2.0) * 6.0);
	col += copper * pool * 0.1;

	float vig = 1.0 - 0.55 * dot(q * vec2(0.8, 1.15), q * vec2(0.8, 1.15));
	col *= clamp(vig, 0.0, 1.0);

	col += (hash(gl_FragCoord.xy + fract(u_time) * 61.7) - 0.5) * 0.018;

	gl_FragColor = vec4(col, 1.0);
}`;

	onMount(() => {
		const gl = canvas.getContext('webgl', {
			antialias: false,
			alpha: false,
			depth: false,
			stencil: false,
			powerPreference: 'low-power'
		});
		if (!gl) return;

		const compile = (type: number, source: string) => {
			const shader = gl.createShader(type)!;
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			return shader;
		};
		const program = gl.createProgram()!;
		gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
		gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
		gl.useProgram(program);

		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const posLoc = gl.getAttribLocation(program, 'a_pos');
		gl.enableVertexAttribArray(posLoc);
		gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

		const uRes = gl.getUniformLocation(program, 'u_res');
		const uTime = gl.getUniformLocation(program, 'u_time');
		const uMouse = gl.getUniformLocation(program, 'u_mouse');

		const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		const t0 = performance.now();
		let raf = 0;
		let running = false;
		let inView = true;
		let mx = 0;
		let my = 0;
		let tx = 0;
		let ty = 0;

		const draw = (t: number) => {
			gl.uniform2f(uRes, canvas.width, canvas.height);
			gl.uniform1f(uTime, t);
			gl.uniform2f(uMouse, mx, my);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		};

		const frame = (now: number) => {
			raf = requestAnimationFrame(frame);
			mx += (tx - mx) * 0.045;
			my += (ty - my) * 0.045;
			draw((now - t0) / 1000);
		};

		const start = () => {
			if (running || reduced.matches || !inView || document.hidden) return;
			running = true;
			raf = requestAnimationFrame(frame);
		};
		const stop = () => {
			running = false;
			cancelAnimationFrame(raf);
		};

		const resize = () => {
			const w = Math.max(1, Math.floor(host.clientWidth * dpr));
			const h = Math.max(1, Math.floor(host.clientHeight * dpr));
			if (canvas.width !== w || canvas.height !== h) {
				canvas.width = w;
				canvas.height = h;
				gl.viewport(0, 0, w, h);
				if (!running) draw(reduced.matches ? 12 : (performance.now() - t0) / 1000);
			}
		};

		const io = new IntersectionObserver(([entry]) => {
			inView = entry.isIntersecting;
			if (inView) start();
			else stop();
		});
		io.observe(host);
		const ro = new ResizeObserver(resize);
		ro.observe(host);

		const onVisibility = () => (document.hidden ? stop() : start());
		document.addEventListener('visibilitychange', onVisibility);
		const onMove = (e: PointerEvent) => {
			tx = (e.clientX / window.innerWidth) * 2 - 1;
			ty = (e.clientY / window.innerHeight) * 2 - 1;
		};
		window.addEventListener('pointermove', onMove, { passive: true });
		const onReducedChange = () => {
			if (reduced.matches) {
				stop();
				draw(12);
			} else {
				start();
			}
		};
		reduced.addEventListener('change', onReducedChange);

		resize();
		if (reduced.matches) draw(12);
		else start();

		return () => {
			stop();
			io.disconnect();
			ro.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pointermove', onMove);
			reduced.removeEventListener('change', onReducedChange);
			gl.getExtension('WEBGL_lose_context')?.loseContext();
		};
	});
</script>

<div bind:this={host} class="absolute inset-0 overflow-hidden" aria-hidden="true">
	<div class="fallback absolute inset-0"></div>
	<canvas bind:this={canvas} class="absolute inset-0 h-full w-full"></canvas>
</div>

<style>
	/* Shown while WebGL boots, and instead of it when unavailable */
	.fallback {
		background:
			radial-gradient(120% 90% at 18% -10%, rgba(215, 137, 81, 0.14), transparent 55%),
			radial-gradient(110% 80% at 85% -12%, rgba(187, 201, 42, 0.07), transparent 50%),
			linear-gradient(to bottom, #0b1119, #080c13);
	}
</style>
