import {
	ACESFilmicToneMapping,
	AdditiveBlending,
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	Color,
	FogExp2,
	Group,
	HalfFloatType,
	HemisphereLight,
	MathUtils,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	PMREMGenerator,
	Points,
	PointsMaterial,
	Scene,
	SpotLight,
	Vector2,
	Vector3,
	WebGLRenderer,
	WebGLRenderTarget,
	type Material,
	type Object3D,
	type Texture
} from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { buildBackline, createMaterials } from './gear.js';
import { createLightingRig } from './lighting.js';
import { fascia, kickHead, mote, planks, rug, seeded } from './textures.js';

/**
 * The landing page: a band's stage, set and lit, waiting for the band.
 *
 * The platform runs far past both edges of any screen, so it always reads as the
 * full width. Units are metres; the deck's top is STAGE_HEIGHT above the house floor.
 */

const STAGE_HEIGHT = 0.5;
const STAGE_FRONT = 2.6;
const STAGE_BACK = -5;
const FOV = 30;
const REACH = Math.tan(MathUtils.degToRad(FOV / 2));
const PLANK_TILE = { across: 1.12, along: 4 };

/** The pages that share the stage. Each has its own place to stand. */
export type ShotName = 'home' | 'auth';

/** How long the camera takes to travel between shots. The auth page's CSS waits on this. */
const MOVE_SECONDS = 2;

/**
 * The auth page's card sits right of the kit on a screen this wide and this shape, and
 * under it otherwise. StageCard.svelte carries the same test as a media query: keep the
 * two in step.
 */
const SIDE_BY_SIDE = { minWidth: 720, minAspect: 5 / 4 };

interface Pose {
	position: Vector3;
	target: Vector3;
	/** How far the picture slides off centre, as a fraction of the frame: +x is left, +y is up. */
	shiftX: number;
	shiftY: number;
	/** How far the camera drifts with the mouse, in metres. */
	sway: number;
}

/** Where the camera stands for a shot, on a screen of this size. */
function poseFor(shot: ShotName, width: number, height: number): Pose {
	const aspect = width / height;
	if (shot === 'home') {
		// Out in the house, square on. A wide screen just sees more stage; a narrow one
		// backs off until the kit and its mics still fit.
		return {
			position: new Vector3(0, 1.95, Math.max(10.6, 1.8 / (REACH * aspect))),
			target: new Vector3(0, 1.6, -1),
			shiftX: 0,
			shiftY: 0,
			sway: 0.7
		};
	}

	// Up at the lip of the stage, off the kit's shoulder. The camera still looks straight
	// at the kit; the picture is slid aside to leave the card its half of the screen.
	const side = width >= SIDE_BY_SIDE.minWidth && aspect >= SIDE_BY_SIDE.minAspect;
	const target = side ? new Vector3(0.05, 1.45, -0.75) : new Vector3(0, 1.25, -0.7);
	const toward = (side ? new Vector3(0.42, 0.17, 1) : new Vector3(0.26, 0.15, 1)).normalize();
	const halfWidth = side ? 1.4 : 1.15;
	const halfHeight = side ? 1.4 : 2.3;
	const distance = Math.max(halfHeight / REACH, halfWidth / (REACH * aspect));
	return {
		position: target.clone().addScaledVector(toward, distance),
		target,
		shiftX: side ? 0.2 : 0,
		shiftY: side ? 0 : 0.27,
		sway: 0.25
	};
}

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** What a chrome stand has to reflect: a dark room with a few lit panels overhead. */
function roomReflections(renderer: WebGLRenderer): Texture {
	const room = new Scene();
	room.background = new Color(0x04060a);
	const panel = (color: number, power: number, x: number, y: number, z: number, w: number) => {
		const mesh = new Mesh(
			new BoxGeometry(w, 0.1, w),
			new MeshBasicMaterial({ color: new Color(color).multiplyScalar(power) })
		);
		mesh.position.set(x, y, z);
		mesh.lookAt(0, 0, 0);
		room.add(mesh);
	};
	panel(0xff9a4d, 5, -4, 5, 1, 2.4);
	panel(0x78a9ff, 5, 4, 5, 1, 2.4);
	panel(0xffe6cc, 4, 0, 6, -1, 2);
	panel(0xffc9a0, 1.2, 0, 1.5, 9, 5);
	const pmrem = new PMREMGenerator(renderer);
	const texture = pmrem.fromScene(room, 0.03).texture;
	pmrem.dispose();
	disposeTree(room);
	return texture;
}

function disposeTree(root: Object3D) {
	root.traverse((object) => {
		const mesh = object as Mesh;
		mesh.geometry?.dispose();
		const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		for (const material of materials) {
			if (!material) continue;
			(material as Material & { map?: Texture | null }).map?.dispose();
			material.dispose();
		}
	});
}

/** The back curtain: a wide plane pushed into folds. */
function curtain(): Mesh {
	const geometry = new PlaneGeometry(70, 8.5, 900, 1);
	const position = geometry.attributes.position;
	for (let i = 0; i < position.count; i++) {
		const x = position.getX(i);
		position.setZ(i, 0.11 * Math.sin(x * 8.2) + 0.05 * Math.sin(x * 19.7 + 1.3));
	}
	geometry.computeVertexNormals();
	const mesh = new Mesh(geometry, new MeshStandardMaterial({ color: 0x18202f, roughness: 1 }));
	mesh.position.set(0, 4.25, STAGE_BACK + 0.25);
	mesh.receiveShadow = true;
	return mesh;
}

/** Dust hanging in the light. A few hundred points, moved by hand each frame. */
function dust() {
	const count = 260;
	const rand = seeded(23);
	const home = new Float32Array(count * 3);
	const positions = new Float32Array(count * 3);
	const pace = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		home[i * 3] = (rand() - 0.5) * 15;
		home[i * 3 + 1] = 0.4 + rand() * 5;
		home[i * 3 + 2] = -3.5 + rand() * 6.5;
		pace[i] = 0.3 + rand() * 0.7;
	}
	positions.set(home);
	const geometry = new BufferGeometry();
	geometry.setAttribute('position', new BufferAttribute(positions, 3));
	const points = new Points(
		geometry,
		new PointsMaterial({
			map: mote(),
			color: 0xffd9b0,
			size: 0.035,
			transparent: true,
			opacity: 0.5,
			blending: AdditiveBlending,
			depthWrite: false
		})
	);
	return {
		points,
		update(seconds: number) {
			for (let i = 0; i < count; i++) {
				const p = pace[i];
				positions[i * 3] = home[i * 3] + Math.sin(seconds * 0.11 * p + i) * 0.4;
				positions[i * 3 + 1] = 0.4 + ((home[i * 3 + 1] + seconds * 0.02 * p) % 5);
				positions[i * 3 + 2] = home[i * 3 + 2] + Math.cos(seconds * 0.09 * p + i * 1.7) * 0.3;
			}
			geometry.attributes.position.needsUpdate = true;
		}
	};
}

export interface Stage {
	/** Sends the camera to another page's shot. */
	setShot(shot: ShotName): void;
	dispose(): void;
}

/**
 * Builds the stage on `canvas`, sized to `host`, and keeps it running until it's
 * disposed. Throws if the browser can't give us WebGL.
 */
export function createStage(
	canvas: HTMLCanvasElement,
	host: HTMLElement,
	initialShot: ShotName,
	onReady: () => void
): Stage {
	const renderer = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'default' });
	renderer.toneMapping = ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1;
	renderer.shadowMap.enabled = true;

	const scene = new Scene();
	scene.background = new Color(0x04060a);
	scene.fog = new FogExp2(0x05080d, 0.02);
	scene.environment = roomReflections(renderer);
	scene.environmentIntensity = 0.6;

	const camera = new PerspectiveCamera(FOV, 1, 0.5, 120);

	// ---- The room ----
	const floorMap = planks({ hue: 27, sat: 32, light: 25, spread: 6, seed: 5 });
	const floorDepth = 46;
	floorMap.repeat.set(90 / PLANK_TILE.across, floorDepth / PLANK_TILE.along);
	const floor = new Mesh(
		new PlaneGeometry(90, floorDepth),
		new MeshStandardMaterial({ map: floorMap, roughness: 0.4 })
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.z = STAGE_FRONT - 2 + floorDepth / 2;
	floor.receiveShadow = true;
	scene.add(floor);

	const depth = STAGE_FRONT - STAGE_BACK;
	const middle = (STAGE_FRONT + STAGE_BACK) / 2;
	const fasciaMap = fascia();
	fasciaMap.repeat.set(90 / 2.44, 1);
	const platform = new Mesh(
		new BoxGeometry(90, STAGE_HEIGHT, depth),
		new MeshStandardMaterial({ color: 0x1b1d23, map: fasciaMap, roughness: 0.55 })
	);
	platform.position.set(0, STAGE_HEIGHT / 2 - 0.002, middle);
	scene.add(platform);
	// The metal nosing along the deck's front edge: the line that carries the stage across
	const nosing = new Mesh(
		new BoxGeometry(90, 0.03, 0.035),
		new MeshStandardMaterial({ color: 0x8d939b, metalness: 1, roughness: 0.35 })
	);
	nosing.position.set(0, STAGE_HEIGHT - 0.012, STAGE_FRONT + 0.005);
	scene.add(nosing);

	// Everything on the deck lives in this group, with y = 0 at the boards
	const stage = new Group();
	stage.position.y = STAGE_HEIGHT;
	scene.add(stage);

	const deckMap = planks({ hue: 218, sat: 12, light: 20, spread: 5, seed: 9 });
	deckMap.repeat.set(90 / PLANK_TILE.across, depth / PLANK_TILE.along);
	const deck = new Mesh(
		new PlaneGeometry(90, depth),
		new MeshStandardMaterial({ map: deckMap, roughness: 0.42 })
	);
	deck.rotation.x = -Math.PI / 2;
	deck.position.z = middle;
	deck.receiveShadow = true;

	const carpet = new Mesh(
		new PlaneGeometry(3.6, 2.9),
		new MeshStandardMaterial({ map: rug(), roughness: 0.95 })
	);
	carpet.rotation.x = -Math.PI / 2;
	carpet.position.set(0, 0.006, -1.3);
	carpet.receiveShadow = true;

	stage.add(deck, carpet, curtain());

	// ---- Backline and lights ----
	const materials = createMaterials();
	let renderStill = () => {};
	stage.add(
		buildBackline(
			materials,
			kickHead(() => renderStill())
		)
	);
	const rig = createLightingRig(stage, materials.steel);

	// Front of house: a soft warm key and a cooler fill, so the gear has faces
	const key = new SpotLight(0xffdcbc, 480, 0, 0.42, 1, 2);
	key.position.set(-6, 7.5, 14);
	key.target.position.set(-0.5, 1.2, -1.5);
	key.castShadow = true;
	key.shadow.mapSize.set(2048, 2048);
	key.shadow.camera.near = 8;
	key.shadow.camera.far = 26;
	key.shadow.bias = -0.0004;
	key.shadow.normalBias = 0.03;
	const fill = new SpotLight(0xa9c6ff, 220, 0, 0.42, 1, 2);
	fill.position.set(7, 6.5, 13);
	fill.target.position.set(0.5, 1.2, -1.5);
	// And one low wash across the house floor, as if spilling off the stage
	const spill = new SpotLight(0xffb070, 70, 0, 1.2, 1, 2);
	spill.position.set(0, 3.2, 4.4);
	spill.target.position.set(0, 0, 4.6);
	scene.add(key, key.target, fill, fill.target, spill, spill.target);
	scene.add(new HemisphereLight(0x33405c, 0x140d08, 0.45));

	const motes = dust();
	stage.add(motes.points);

	// ---- Bloom, so lamps and hot highlights glow instead of clipping ----
	const composer = new EffectComposer(
		renderer,
		new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 })
	);
	composer.addPass(new RenderPass(scene, camera));
	const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.45, 0.8, 1.2);
	composer.addPass(bloom);
	composer.addPass(new OutputPass());

	// ---- Framing ----
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
	const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
	const size = { width: 1, height: 1 };
	let shot = initialShot;
	let destination = poseFor(shot, 1, 1);
	// Where the current move set off from. Null once the camera has arrived.
	let origin: Pose | null = null;
	let travelled = 1;
	const view = poseFor(shot, 1, 1);

	const aim = (elapsed: number) => {
		const from = origin ?? destination;
		if (origin) {
			travelled = Math.min(1, travelled + elapsed / MOVE_SECONDS);
			if (travelled === 1) origin = null;
		}
		const eased = origin ? easeInOut(travelled) : 1;
		view.position.lerpVectors(from.position, destination.position, eased);
		// A crane move, not a straight line: up and over on the way
		view.position.y +=
			Math.sin(Math.PI * eased) * 0.07 * from.position.distanceTo(destination.position);
		view.target.lerpVectors(from.target, destination.target, eased);
		view.shiftX = MathUtils.lerp(from.shiftX, destination.shiftX, eased);
		view.shiftY = MathUtils.lerp(from.shiftY, destination.shiftY, eased);
		view.sway = MathUtils.lerp(from.sway, destination.sway, eased);

		camera.position.copy(view.position);
		camera.position.x += pointer.x * view.sway;
		camera.position.y -= pointer.y * view.sway * 0.36;
		camera.lookAt(view.target);
		camera.setViewOffset(
			size.width,
			size.height,
			view.shiftX * size.width,
			view.shiftY * size.height,
			size.width,
			size.height
		);
	};

	const resize = () => {
		size.width = Math.max(1, host.clientWidth);
		size.height = Math.max(1, host.clientHeight);
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		renderer.setPixelRatio(ratio);
		renderer.setSize(size.width, size.height, false);
		composer.setPixelRatio(ratio);
		composer.setSize(size.width, size.height);
		camera.aspect = size.width / size.height;
		destination = poseFor(shot, size.width, size.height);
		renderStill();
	};

	// ---- The loop ----
	// The clock starts on the first frame, not here, so a slow shader compile can't eat the intro
	let started = -1;
	let last = 0;
	let raf = 0;
	let running = false;
	let ready = false;

	const washes = [key, fill, spill].map((light) => ({ light, power: light.intensity }));
	const draw = (seconds: number, still: boolean, elapsed = 0) => {
		rig.update(seconds, still);
		// Front of house comes up from a preset glow as the rig strikes
		const up = still ? 1 : MathUtils.smoothstep(seconds, 0.3, 2.6);
		for (const wash of washes) wash.light.intensity = wash.power * (0.2 + 0.8 * up);
		motes.update(seconds);
		aim(elapsed);
		composer.render();
		if (!ready) {
			ready = true;
			onReady();
		}
	};

	const frame = (now: number) => {
		raf = requestAnimationFrame(frame);
		if (started < 0) started = last = now;
		// Capped, so a tab coming back from the background doesn't finish a move in one frame
		const elapsed = Math.min(0.1, (now - last) / 1000);
		last = now;
		pointer.x += (pointer.targetX - pointer.x) * 0.04;
		pointer.y += (pointer.targetY - pointer.y) * 0.04;
		draw((now - started) / 1000, false, elapsed);
	};
	const start = () => {
		if (running || reduced.matches || document.hidden) return;
		running = true;
		last = performance.now();
		raf = requestAnimationFrame(frame);
	};
	const stop = () => {
		running = false;
		cancelAnimationFrame(raf);
	};
	// With motion reduced there's no loop, so anything that changes the picture redraws it once
	renderStill = () => {
		if (reduced.matches) draw(30, true);
	};

	const onVisibility = () => (document.hidden ? stop() : start());
	const onPointer = (event: PointerEvent) => {
		if (event.pointerType !== 'mouse') return;
		pointer.targetX = (event.clientX / window.innerWidth) * 2 - 1;
		pointer.targetY = (event.clientY / window.innerHeight) * 2 - 1;
	};
	const onReducedChange = () => {
		if (reduced.matches) {
			stop();
			pointer.x = pointer.y = pointer.targetX = pointer.targetY = 0;
			renderStill();
		} else {
			start();
		}
	};
	const observer = new ResizeObserver(resize);
	observer.observe(host);
	document.addEventListener('visibilitychange', onVisibility);
	window.addEventListener('pointermove', onPointer, { passive: true });
	reduced.addEventListener('change', onReducedChange);

	resize();
	// Shaders compile off the main thread where the browser can, so the first frame doesn't
	// freeze a page someone may already be typing into
	let disposed = false;
	renderer
		.compileAsync(scene, camera)
		.catch(() => {})
		.then(() => {
			if (!disposed) start();
		});

	return {
		setShot(next) {
			if (next === shot) return;
			shot = next;
			const arrival = poseFor(shot, size.width, size.height);
			if (reduced.matches || !ready) {
				// Nothing to travel from, or no wish to watch it: cut straight there
				origin = null;
				destination = arrival;
				renderStill();
				return;
			}
			origin = {
				position: view.position.clone(),
				target: view.target.clone(),
				shiftX: view.shiftX,
				shiftY: view.shiftY,
				sway: view.sway
			};
			destination = arrival;
			travelled = 0;
		},
		dispose() {
			disposed = true;
			stop();
			observer.disconnect();
			document.removeEventListener('visibilitychange', onVisibility);
			window.removeEventListener('pointermove', onPointer);
			reduced.removeEventListener('change', onReducedChange);
			disposeTree(scene);
			scene.environment?.dispose();
			bloom.dispose();
			composer.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
		}
	};
}
