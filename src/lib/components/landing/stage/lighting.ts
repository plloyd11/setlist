import {
	AdditiveBlending,
	CircleGeometry,
	Color,
	CylinderGeometry,
	Group,
	Mesh,
	MeshBasicMaterial,
	ShaderMaterial,
	SpotLight,
	Vector3,
	type Material
} from 'three';
import { seeded } from './textures.js';
import { bake, tube } from './gear.js';

/**
 * The overhead rig: a truss of cans, alternating warm and cool. Each can is a real
 * spotlight for the gear below, plus a cone of haze so you can see the beam itself.
 * Limelight stays out of it: chartreuse is the app's live signal, not a wash.
 */

const WARM = new Color(0xff9a4d);
const COOL = new Color(0x78a9ff);

const BEAM_VERTEX = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vWorld;
varying float vAlong;
void main() {
	vec4 world = modelMatrix * vec4(position, 1.0);
	vWorld = world.xyz;
	vNormal = normalize(mat3(modelMatrix) * normal);
	vView = cameraPosition - world.xyz;
	vAlong = uv.y;
	gl_Position = projectionMatrix * viewMatrix * world;
}`;

// The cone is brightest where you look through the most haze (its middle) and fades
// to nothing at the silhouette, so there's no hard edge. Slow noise is the haze drifting.
const BEAM_FRAGMENT = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
uniform float uTime;
uniform float uSeed;
varying vec3 vNormal;
varying vec3 vView;
varying vec3 vWorld;
varying float vAlong;

float hash(vec2 p) {
	p = fract(p * vec2(123.34, 345.45));
	p += dot(p, p + 34.345);
	return fract(p.x * p.y);
}
float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
		f.y
	);
}
float fbm(vec2 p) {
	float value = 0.0;
	float amp = 0.5;
	for (int i = 0; i < 3; i++) {
		value += amp * noise(p);
		p = p * 2.03 + vec2(1.7);
		amp *= 0.5;
	}
	return value;
}
void main() {
	float through = abs(dot(normalize(vNormal), normalize(vView)));
	float body = pow(through, 2.4);
	// Clamped: at a multisampled edge vAlong can land just below zero, and pow() of a
	// negative is NaN, which the bloom then spreads over the whole frame
	float fall = mix(0.1, 1.0, pow(clamp(vAlong, 0.0, 1.0), 1.7));
	vec2 drift = vec2(vWorld.x * 0.5 + vWorld.z * 0.3 + uSeed, vWorld.y * 0.42 - uTime * 0.05);
	float haze = 0.55 + 0.75 * fbm(drift);
	gl_FragColor = vec4(uColor * (body * fall * haze * uIntensity), 1.0);
}`;

interface Lamp {
	light: SpotLight;
	beam: ShaderMaterial;
	lens: MeshBasicMaterial;
	color: Color;
	power: number;
	phase: number;
	delay: number;
}

/** A lamp striking: a short stutter, then it settles. */
function strike(elapsed: number): number {
	if (elapsed <= 0) return 0;
	const ramp = Math.min(1, elapsed / 1.1);
	const eased = ramp * ramp * (3 - 2 * ramp);
	const stutter = elapsed < 0.32 && Math.floor(elapsed * 21) % 2 === 1 ? 0.35 : 1;
	return eased * stutter;
}

export function createLightingRig(parent: Group, steel: Material) {
	const COUNT = 13;
	const SPACING = 1.6;
	const HEIGHT = 3.7;
	const TRUSS = HEIGHT + 0.45;
	const DEPTH = -1.1;
	const ANGLE = 0.3;
	/** The haze cone is drawn a little tighter than the light's soft edge. */
	const SHAFT = 0.23;

	const rand = seeded(11);
	const time = { value: 0 };
	const lamps: Lamp[] = [];
	const centre = (COUNT - 1) / 2;
	const z = new Vector3(0, 0, 1);
	const down = new Vector3(0, -1, 0);
	// Cans, hangers and truss: plain steel, merged into one mesh at the end
	const hardware = new Group();

	for (let i = 0; i < COUNT; i++) {
		const offset = i - centre;
		const cool = Math.abs(offset) % 2 === 0;
		const color = cool ? COOL : WARM;
		const from = new Vector3(offset * SPACING, HEIGHT, DEPTH);
		// The middle three find the kit; the rest lean in and a little downstage
		const to =
			Math.abs(offset) <= 1
				? new Vector3(offset * 0.9, 0.3, -0.7)
				: new Vector3(offset * SPACING * 0.86 + (rand() - 0.5) * 0.3, 0, 0.1 + rand() * 0.5);
		const aim = to.clone().sub(from);
		const length = aim.length() + 0.4;
		aim.normalize();

		const power = cool ? 105 : 120;
		const light = new SpotLight(color, power, 16, ANGLE, 0.75, 2);
		light.position.copy(from);
		light.target.position.copy(to);
		// Shadows cost a depth pass each, so only the lamps over the kit throw them
		if (Math.abs(offset) <= 1) {
			light.castShadow = true;
			light.shadow.mapSize.set(1024, 1024);
			light.shadow.camera.near = 1;
			light.shadow.camera.far = 7;
			light.shadow.bias = -0.0006;
			light.shadow.normalBias = 0.02;
		}
		parent.add(light, light.target);

		const cone = new CylinderGeometry(0.08, length * Math.tan(SHAFT), length, 64, 24, true);
		cone.translate(0, -length / 2, 0);
		const beam = new ShaderMaterial({
			uniforms: {
				uColor: { value: color },
				uIntensity: { value: 0 },
				uTime: time,
				uSeed: { value: i * 7.31 }
			},
			vertexShader: BEAM_VERTEX,
			fragmentShader: BEAM_FRAGMENT,
			transparent: true,
			blending: AdditiveBlending,
			depthWrite: false,
			fog: false
		});
		const shaft = new Mesh(cone, beam);
		shaft.position.copy(from);
		shaft.quaternion.setFromUnitVectors(down, aim);
		shaft.renderOrder = 2;
		parent.add(shaft);

		const can = new Mesh(new CylinderGeometry(0.11, 0.095, 0.3, 20), steel);
		can.position.copy(from).addScaledVector(aim, -0.14);
		can.quaternion.setFromUnitVectors(down, aim);
		const lens = new MeshBasicMaterial({ color: 0x000000 });
		const glass = new Mesh(new CircleGeometry(0.088, 24), lens);
		glass.position.copy(from).addScaledVector(aim, 0.012);
		glass.quaternion.setFromUnitVectors(z, aim);
		parent.add(glass);
		hardware.add(
			can,
			tube(from.clone().setY(HEIGHT + 0.1), from.clone().setY(TRUSS), 0.012, steel)
		);

		lamps.push({
			light,
			beam,
			lens,
			color,
			power,
			phase: rand() * Math.PI * 2,
			// The centre strikes first and the rest follow outward
			delay: 0.5 + Math.abs(offset) * 0.2
		});
	}

	// The truss they hang from
	const half = (COUNT * SPACING) / 2 + 1;
	for (const [y, zOffset] of [
		[TRUSS, 0.14],
		[TRUSS, -0.14],
		[TRUSS + 0.3, 0]
	] as const) {
		hardware.add(
			tube(
				new Vector3(-half, y, DEPTH + zOffset),
				new Vector3(half, y, DEPTH + zOffset),
				0.024,
				steel
			)
		);
	}
	for (let x = -half; x < half; x += 0.6) {
		for (const side of [0.14, -0.14]) {
			hardware.add(
				tube(
					new Vector3(x, TRUSS, DEPTH + side),
					new Vector3(x + 0.3, TRUSS + 0.3, DEPTH),
					0.01,
					steel
				),
				tube(
					new Vector3(x + 0.3, TRUSS + 0.3, DEPTH),
					new Vector3(x + 0.6, TRUSS, DEPTH + side),
					0.01,
					steel
				)
			);
		}
	}
	// It sits above the front-of-house key, and its shadow on the curtain reads as a second truss
	const truss = bake(hardware);
	truss.children.forEach((mesh) => (mesh.castShadow = false));
	parent.add(truss);

	return {
		/** `still` skips the strike and the breathing, for reduced motion. */
		update(seconds: number, still: boolean) {
			time.value = seconds;
			for (const lamp of lamps) {
				const on = still
					? 1
					: strike(seconds - lamp.delay) * (1 + 0.05 * Math.sin(seconds * 0.45 + lamp.phase));
				lamp.light.intensity = lamp.power * on;
				lamp.beam.uniforms.uIntensity.value = 0.34 * on;
				lamp.lens.color.copy(lamp.color).multiplyScalar(7 * on);
			}
		}
	};
}
