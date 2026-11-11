import {
	BoxGeometry,
	CircleGeometry,
	Color,
	CylinderGeometry,
	DoubleSide,
	ExtrudeGeometry,
	Group,
	LatheGeometry,
	Mesh,
	MeshBasicMaterial,
	MeshPhysicalMaterial,
	MeshStandardMaterial,
	PlaneGeometry,
	Shape,
	SphereGeometry,
	TorusGeometry,
	Vector2,
	Vector3,
	type BufferGeometry,
	type Material,
	type Object3D,
	type Texture
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cloth, grille, setlistSheet } from './textures.js';

/**
 * The backline: everything standing on the deck, built from primitives in metres.
 * +z is toward the house, so stage left is -x from where the audience stands.
 */

const UP = new Vector3(0, 1, 0);
const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

export type Materials = ReturnType<typeof createMaterials>;

export function createMaterials() {
	return {
		chrome: new MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: 0.2 }),
		steel: new MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.85, roughness: 0.4 }),
		aluminium: new MeshStandardMaterial({ color: 0x6f747b, metalness: 1, roughness: 0.5 }),
		// Copper sparkle under lacquer: the kit is the one piece of Tube Glow on the deck
		shell: new MeshPhysicalMaterial({
			color: 0xa04a22,
			metalness: 0.55,
			roughness: 0.4,
			clearcoat: 1,
			clearcoatRoughness: 0.12
		}),
		head: new MeshStandardMaterial({ color: 0xe6dfd0, roughness: 0.55 }),
		brass: new MeshStandardMaterial({
			color: 0xd9ad58,
			metalness: 0.5,
			roughness: 0.38,
			side: DoubleSide
		}),
		tolex: new MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.7 }),
		tweed: new MeshStandardMaterial({ color: 0x9f7740, roughness: 0.62 }),
		rubber: new MeshStandardMaterial({ color: 0x08080a, roughness: 0.9 }),
		caseBlack: new MeshStandardMaterial({ color: 0x14161a, roughness: 0.6 }),
		micGrille: new MeshStandardMaterial({ color: 0x9a9da3, metalness: 0.9, roughness: 0.45 }),
		cream: new MeshPhysicalMaterial({
			color: 0xe4d6b4,
			roughness: 0.35,
			clearcoat: 1,
			clearcoatRoughness: 0.1
		}),
		burst: new MeshPhysicalMaterial({
			color: 0x7a2c12,
			roughness: 0.35,
			clearcoat: 1,
			clearcoatRoughness: 0.1
		}),
		maple: new MeshStandardMaterial({ color: 0xc39a5c, roughness: 0.45 }),
		rosewood: new MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.6 }),
		gold: new MeshStandardMaterial({ color: 0xb8924a, metalness: 1, roughness: 0.4 }),
		piping: new MeshStandardMaterial({ color: 0x8f897b, roughness: 0.5 }),
		ivory: new MeshStandardMaterial({ color: 0xd9cfb6, roughness: 0.5 }),
		// A lit pilot lamp. Brighter than white, so the bloom picks it up.
		pilot: new MeshBasicMaterial({ color: new Color(0xd78951).multiplyScalar(6) })
	};
}

/** A rod between two points. */
export function tube(a: Vector3, b: Vector3, radius: number, material: Material): Mesh {
	const span = b.clone().sub(a);
	const length = span.length();
	const mesh = new Mesh(new CylinderGeometry(radius, radius, length, 10), material);
	mesh.position.copy(a).addScaledVector(span, 0.5);
	mesh.quaternion.setFromUnitVectors(UP, span.normalize());
	return mesh;
}

function tripod(spread: number, hub: number, material: Material, turn = 0): Mesh[] {
	return [0, 1, 2].map((i) => {
		const a = turn + (i * Math.PI * 2) / 3 + Math.PI / 2;
		return tube(
			v(0, hub, 0),
			v(Math.cos(a) * spread, 0.012, Math.sin(a) * spread),
			0.009,
			material
		);
	});
}

/** Thin strips around a rectangle on a front face. */
function frame(
	width: number,
	height: number,
	cx: number,
	cy: number,
	z: number,
	material: Material,
	thick = 0.007
): Mesh[] {
	const horizontal = new BoxGeometry(width + thick, thick, thick);
	const vertical = new BoxGeometry(thick, height + thick, thick);
	return [
		[horizontal, 0, height / 2] as const,
		[horizontal, 0, -height / 2] as const,
		[vertical, width / 2, 0] as const,
		[vertical, -width / 2, 0] as const
	].map(([geometry, dx, dy]) => {
		const strip = new Mesh(geometry, material);
		strip.position.set(cx + dx, cy + dy, z);
		return strip;
	});
}

// ---- Drums ----

/** A drum standing on its end, centred on the origin. */
function drum(
	radius: number,
	depth: number,
	lugs: number,
	m: Materials,
	hoop: Material = m.chrome,
	hoopRadius = 0.008
): Group {
	const group = new Group();
	group.add(new Mesh(new CylinderGeometry(radius, radius, depth, 40, 1, true), m.shell));
	for (const side of [1, -1]) {
		const skin = new Mesh(new CylinderGeometry(radius * 0.985, radius * 0.985, 0.004, 40), m.head);
		skin.position.y = (side * depth) / 2;
		const rim = new Mesh(new TorusGeometry(radius + 0.003, hoopRadius, 8, 40), hoop);
		rim.rotation.x = Math.PI / 2;
		rim.position.y = side * (depth / 2 + 0.002);
		group.add(skin, rim);
	}
	for (let i = 0; i < lugs; i++) {
		const a = (i / lugs) * Math.PI * 2;
		const lug = new Mesh(new BoxGeometry(0.02, Math.min(0.09, depth * 0.4), 0.014), m.chrome);
		lug.position.set(Math.cos(a) * (radius + 0.006), 0, Math.sin(a) * (radius + 0.006));
		lug.rotation.y = -a + Math.PI / 2;
		group.add(lug);
	}
	return group;
}

function cymbal(radius: number, m: Materials): Mesh {
	const k = radius / 0.22;
	const profile = [
		new Vector2(0.006, 0.034 * k),
		new Vector2(0.03 * k, 0.032 * k),
		new Vector2(0.055 * k, 0.014 * k),
		new Vector2(radius * 0.6, 0.003),
		new Vector2(radius, -0.014 * k)
	];
	return new Mesh(new LatheGeometry(profile, 40), m.brass);
}

function cymbalStand(
	height: number,
	radius: number,
	tiltX: number,
	tiltZ: number,
	m: Materials
): Group {
	const group = new Group();
	group.add(...tripod(0.27, 0.27, m.chrome, height));
	group.add(tube(v(0, 0.02, 0), v(0, height * 0.62, 0), 0.012, m.chrome));
	group.add(tube(v(0, height * 0.6, 0), v(0, height + 0.03, 0), 0.008, m.chrome));
	const plate = cymbal(radius, m);
	plate.position.y = height;
	plate.rotation.set(tiltX, 0, tiltZ);
	group.add(plate);
	return group;
}

/** The kit, with the kick's centre over the origin and the drummer at -z. */
export function drumKit(m: Materials, kickHead: Texture): Group {
	const kit = new Group();

	const kickRadius = 0.28;
	const kickDepth = 0.42;
	const kickY = kickRadius + 0.02;
	const kick = drum(kickRadius, kickDepth, 8, m, m.shell, 0.015);
	kick.rotation.x = Math.PI / 2;
	kick.position.y = kickY;
	const logo = new Mesh(
		new CircleGeometry(kickRadius * 0.972, 48),
		new MeshStandardMaterial({ map: kickHead, roughness: 0.5 })
	);
	logo.position.set(0, kickY, kickDepth / 2 + 0.005);
	kit.add(kick, logo);
	for (const side of [1, -1]) {
		kit.add(tube(v(side * 0.22, 0.2, 0.1), v(side * 0.38, 0.01, 0.27), 0.007, m.chrome));
	}

	// Rack toms over the kick, tipped back toward the drummer
	kit.add(tube(v(0, kickY + kickRadius - 0.01, -0.06), v(0, 0.8, -0.06), 0.011, m.chrome));
	for (const [x, radius, depth] of [
		[0.2, 0.14, 0.2],
		[-0.21, 0.16, 0.23]
	]) {
		const tom = drum(radius, depth, 6, m);
		tom.position.set(x, 0.8, -0.1);
		tom.rotation.set(-0.42, 0, x > 0 ? -0.1 : 0.1);
		kit.add(tom, tube(v(0, 0.78, -0.06), v(x * 0.4, 0.8, -0.08), 0.008, m.chrome));
	}

	const floorTom = drum(0.2, 0.38, 8, m);
	floorTom.position.set(-0.6, 0.46, -0.6);
	kit.add(floorTom);
	for (let i = 0; i < 3; i++) {
		const a = (i * Math.PI * 2) / 3 + 0.5;
		const x = -0.6 + Math.cos(a) * 0.215;
		const z = -0.6 + Math.sin(a) * 0.215;
		kit.add(
			tube(
				v(x, 0.5, z),
				v(-0.6 + Math.cos(a) * 0.27, 0.01, -0.6 + Math.sin(a) * 0.27),
				0.006,
				m.chrome
			)
		);
	}

	const snare = drum(0.178, 0.14, 10, m);
	snare.position.set(0.3, 0.66, -0.62);
	snare.rotation.x = -0.08;
	const snareStand = new Group();
	snareStand.add(...tripod(0.22, 0.2, m.chrome, 0.4));
	snareStand.add(tube(v(0, 0.02, 0), v(0, 0.58, 0), 0.011, m.chrome));
	snareStand.position.set(0.3, 0, -0.62);
	kit.add(snare, snareStand);

	// Hi-hat: two cymbals facing each other on the drummer's left
	const hat = new Group();
	hat.add(...tripod(0.24, 0.22, m.chrome, 1.1));
	hat.add(tube(v(0, 0.02, 0), v(0, 0.86, 0), 0.011, m.chrome));
	hat.add(tube(v(0, 0.84, 0), v(0, 1.08, 0), 0.004, m.chrome));
	const bottom = cymbal(0.178, m);
	bottom.rotation.x = Math.PI;
	bottom.position.y = 0.88;
	const top = cymbal(0.178, m);
	top.position.y = 0.905;
	hat.add(bottom, top);
	hat.position.set(0.72, 0, -0.5);
	kit.add(hat);

	const ride = cymbalStand(0.98, 0.255, 0.1, 0.12, m);
	ride.position.set(-0.78, 0, -0.18);
	const crashLeft = cymbalStand(1.24, 0.21, 0.16, 0.14, m);
	crashLeft.position.set(-0.44, 0, 0.12);
	const crashRight = cymbalStand(1.2, 0.225, 0.14, -0.16, m);
	crashRight.position.set(0.58, 0, 0.1);
	kit.add(ride, crashLeft, crashRight);

	const throne = new Group();
	const seat = new Mesh(new CylinderGeometry(0.165, 0.165, 0.075, 28), m.rubber);
	seat.position.y = 0.52;
	throne.add(seat, tube(v(0, 0.02, 0), v(0, 0.5, 0), 0.014, m.chrome));
	throne.add(...tripod(0.24, 0.22, m.chrome, 0.2));
	throne.position.set(0, 0, -1);
	kit.add(throne);

	return kit;
}

// ---- Microphones ----

function microphone(m: Materials): Group {
	const mic = new Group();
	const handle = new Mesh(new CylinderGeometry(0.013, 0.009, 0.14, 12), m.steel);
	const ball = new Mesh(new SphereGeometry(0.025, 16, 12), m.micGrille);
	ball.position.y = 0.088;
	mic.add(handle, ball);
	return mic;
}

/** A boom stand reaching toward +x, its mic hanging off the end over the kit. */
function boomStand(m: Materials, height = 1.5, reach = 0.7, rise = 0.26): Group {
	const stand = new Group();
	stand.add(...tripod(0.31, 0.3, m.steel));
	stand.add(tube(v(0, 0.02, 0), v(0, height, 0), 0.011, m.steel));
	const tip = v(reach, height + rise, 0);
	const tail = v(-0.3, height - rise * 0.42, 0);
	stand.add(tube(tail, tip, 0.008, m.steel));
	const weight = new Mesh(new CylinderGeometry(0.018, 0.018, 0.07, 10), m.steel);
	weight.position.copy(tail);
	weight.rotation.z = Math.PI / 2 - Math.atan2(rise * 1.42, reach + 0.3);
	const clutch = new Mesh(new SphereGeometry(0.022, 10, 8), m.steel);
	clutch.position.y = height;
	const mic = microphone(m);
	mic.position.set(tip.x + 0.03, tip.y - 0.06, 0);
	mic.rotation.z = Math.PI + 0.45;
	stand.add(weight, clutch, mic);
	return stand;
}

/** A straight round-base stand: the singer's spot. */
function vocalStand(m: Materials): Group {
	const stand = new Group();
	const base = new Mesh(new CylinderGeometry(0.135, 0.15, 0.022, 32), m.steel);
	base.position.y = 0.011;
	stand.add(base);
	stand.add(tube(v(0, 0.02, 0), v(0, 0.86, 0), 0.011, m.steel));
	stand.add(tube(v(0, 0.84, 0), v(0, 1.5, 0), 0.008, m.chrome));
	const clutch = new Mesh(new CylinderGeometry(0.016, 0.016, 0.06, 10), m.steel);
	clutch.position.y = 0.86;
	const mic = microphone(m);
	mic.position.set(0, 1.53, -0.01);
	mic.rotation.x = -1.05;
	stand.add(clutch, mic);
	return stand;
}

// ---- Amps and speakers ----

interface AmpSpec {
	w: number;
	h: number;
	d: number;
	body: Material;
	/** Speaker cloth. A head has none. */
	cloth?: Material;
	piping?: Material;
	panel?: { height: number; at: 'top' | 'bottom'; face: Material; knobs: number; knob: Material };
}

function amp(spec: AmpSpec, m: Materials): Group {
	const { w, h, d, panel } = spec;
	const group = new Group();
	const body = new Mesh(new RoundedBoxGeometry(w, h, d, 3, 0.016), spec.body);
	body.position.y = h / 2;
	group.add(body);

	const margin = 0.04;
	const front = d / 2;
	const innerW = w - margin * 2;
	let low = margin;
	let high = h - margin;

	if (panel) {
		const y = panel.at === 'top' ? high - panel.height / 2 : low + panel.height / 2;
		const face = new Mesh(new BoxGeometry(innerW, panel.height, 0.008), panel.face);
		face.position.set(0, y, front + 0.002);
		group.add(face);
		const run = innerW - 0.16;
		for (let i = 0; i < panel.knobs; i++) {
			const knob = new Mesh(new CylinderGeometry(0.011, 0.013, 0.016, 14), panel.knob);
			knob.rotation.x = Math.PI / 2;
			knob.position.set(
				-innerW / 2 + 0.05 + (i * run) / Math.max(1, panel.knobs - 1),
				y,
				front + 0.014
			);
			group.add(knob);
		}
		const pilot = new Mesh(new SphereGeometry(0.009, 10, 8), m.pilot);
		pilot.position.set(innerW / 2 - 0.035, y, front + 0.01);
		group.add(pilot);
		if (panel.at === 'top') high -= panel.height + 0.012;
		else low += panel.height + 0.012;
	}

	if (spec.cloth) {
		const height = high - low;
		const face = new Mesh(new PlaneGeometry(innerW, height), spec.cloth);
		face.position.set(0, low + height / 2, front + 0.002);
		group.add(face);
		if (spec.piping) {
			group.add(...frame(innerW, height, 0, low + height / 2, front + 0.004, spec.piping));
		}
	}

	const handle = new Mesh(new BoxGeometry(Math.min(0.2, w * 0.3), 0.014, 0.03), m.rubber);
	handle.position.y = h + 0.007;
	group.add(handle);
	return group;
}

/** A floor monitor. Its grille faces -z, at whoever it's pointed at. */
function wedge(m: Materials, mesh: Material): Group {
	const width = 0.62;
	// Side profile in (z, y). Extruding runs along +z, so it's drawn against -z and turned.
	const profile: [number, number][] = [
		[-0.26, 0],
		[0.26, 0],
		[0.26, 0.3],
		[0.12, 0.36],
		[-0.26, 0.07]
	];
	const shape = new Shape();
	profile.forEach(([z, y], i) => (i ? shape.lineTo(-z, y) : shape.moveTo(-z, y)));
	const geometry = new ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
	geometry.rotateY(Math.PI / 2);
	geometry.translate(-width / 2, 0, 0);

	const group = new Group();
	group.add(new Mesh(geometry, m.caseBlack));

	const top = v(0, 0.36, 0.12);
	const lip = v(0, 0.07, -0.26);
	const slope = top.clone().sub(lip);
	const normal = v(0, slope.z, -slope.y).normalize();
	const face = new Mesh(new PlaneGeometry(width - 0.07, slope.length() - 0.06), mesh);
	face.position.copy(lip).addScaledVector(slope, 0.5).addScaledVector(normal, 0.004);
	face.lookAt(face.position.clone().add(normal));
	group.add(face);
	return group;
}

/** One side of the PA: two subs with a top box on them. */
function paStack(m: Materials, mesh: Material): Group {
	const stack = new Group();
	const box = (w: number, h: number, d: number, y: number) => {
		const cabinet = new Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.012), m.caseBlack);
		cabinet.position.y = y + h / 2;
		const face = new Mesh(new PlaneGeometry(w - 0.08, h - 0.08), mesh);
		face.position.set(0, y + h / 2, d / 2 + 0.002);
		stack.add(cabinet, face);
	};
	box(1.05, 0.62, 0.8, 0);
	box(1.05, 0.62, 0.8, 0.63);
	box(0.72, 1.0, 0.55, 1.27);
	return stack;
}

/** A flight case, for the wings. */
function roadCase(w: number, h: number, d: number, m: Materials): Group {
	const group = new Group();
	const body = new Mesh(new BoxGeometry(w, h, d), m.caseBlack);
	body.position.y = h / 2 + 0.06;
	group.add(body);
	group.add(...frame(w - 0.014, h - 0.014, 0, h / 2 + 0.06, d / 2, m.aluminium, 0.014));
	for (const x of [-w * 0.28, w * 0.28]) {
		const latch = new Mesh(new BoxGeometry(0.07, 0.09, 0.012), m.aluminium);
		latch.position.set(x, h * 0.62 + 0.06, d / 2 + 0.006);
		group.add(latch);
	}
	for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) {
		for (const z of [-d / 2 + 0.08, d / 2 - 0.08]) {
			const caster = new Mesh(new CylinderGeometry(0.035, 0.035, 0.03, 12), m.rubber);
			caster.rotation.z = Math.PI / 2;
			caster.position.set(x, 0.035, z);
			group.add(caster);
		}
	}
	return group;
}

// ---- Guitars ----

/** A solid-body on a stand, leaning back, face to the house. */
function guitarOnStand(body: Material, neckLength: number, m: Materials): Group {
	const outline: [number, number][] = [
		[0.115, -0.2],
		[0.168, -0.11],
		[0.14, 0],
		[0.15, 0.1],
		[0.135, 0.185],
		[0.1, 0.2],
		[0.07, 0.15],
		[0.04, 0.115],
		[-0.04, 0.115],
		[-0.065, 0.17],
		[-0.105, 0.235],
		[-0.15, 0.2],
		[-0.16, 0.1],
		[-0.135, 0],
		[-0.168, -0.11],
		[-0.115, -0.2],
		[0, -0.215]
	];
	const shape = new Shape();
	shape.moveTo(0, -0.215);
	shape.splineThru(outline.map(([x, y]) => new Vector2(x, y)));
	const slab = new ExtrudeGeometry(shape, {
		depth: 0.034,
		bevelEnabled: true,
		bevelThickness: 0.005,
		bevelSize: 0.005,
		bevelSegments: 2,
		curveSegments: 20
	});
	slab.translate(0, 0.215, -0.017);

	const guitar = new Group();
	guitar.add(new Mesh(slab, body));
	const heel = 0.31;
	const part = (
		w: number,
		h: number,
		d: number,
		x: number,
		y: number,
		z: number,
		material: Material
	) => {
		const mesh = new Mesh(new BoxGeometry(w, h, d), material);
		mesh.position.set(x, y, z);
		guitar.add(mesh);
	};
	part(0.044, neckLength, 0.02, 0, heel + neckLength / 2, 0.012, m.maple);
	part(0.046, neckLength + 0.06, 0.006, 0, heel + neckLength / 2 - 0.03, 0.025, m.rosewood);
	part(0.066, 0.16, 0.014, -0.008, heel + neckLength + 0.08, 0.008, m.maple);
	part(0.078, 0.024, 0.01, 0, 0.25, 0.026, m.ivory);
	part(0.078, 0.024, 0.01, 0, 0.165, 0.026, m.ivory);
	part(0.088, 0.026, 0.014, 0, 0.11, 0.028, m.chrome);
	for (const [x, y] of [
		[0.09, 0.075],
		[0.115, 0.125]
	]) {
		const knob = new Mesh(new CylinderGeometry(0.011, 0.012, 0.012, 12), m.steel);
		knob.rotation.x = Math.PI / 2;
		knob.position.set(x, y, 0.03);
		guitar.add(knob);
	}
	guitar.position.set(0, 0.13, 0.05);
	guitar.rotation.x = -0.17;

	const stand = new Group();
	stand.add(...tripod(0.2, 0.2, m.steel, 0.5));
	const top = heel + neckLength * 0.55;
	stand.add(tube(v(0, 0.02, -0.02), v(0, top, -0.12), 0.009, m.steel));
	stand.add(tube(v(0, top, -0.12), v(0, top + 0.02, -0.06), 0.008, m.rubber));
	for (const x of [-0.09, 0.09]) {
		stand.add(tube(v(0, 0.16, -0.04), v(x, 0.12, 0.1), 0.008, m.steel));
	}
	stand.add(guitar);
	return stand;
}

// ---- The whole deck ----

/**
 * Merges every mesh under `root` into one mesh per material. The backline is a few
 * hundred small parts; drawn one by one they'd cost a draw call each, every frame.
 */
export function bake(root: Object3D): Group {
	root.updateMatrixWorld(true);
	const byMaterial = new Map<Material, BufferGeometry[]>();
	root.traverse((object) => {
		const mesh = object as Mesh;
		if (!mesh.isMesh) return;
		const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
		geometry.applyMatrix4(mesh.matrixWorld);
		for (const name of Object.keys(geometry.attributes)) {
			if (name !== 'position' && name !== 'normal' && name !== 'uv') {
				geometry.deleteAttribute(name);
			}
		}
		const list = byMaterial.get(mesh.material as Material) ?? [];
		list.push(geometry);
		byMaterial.set(mesh.material as Material, list);
		mesh.geometry.dispose();
	});

	const baked = new Group();
	for (const [material, geometries] of byMaterial) {
		const mesh = new Mesh(mergeGeometries(geometries), material);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		baked.add(mesh);
		geometries.forEach((geometry) => geometry.dispose());
	}
	return baked;
}

/** Sets the backline out on the deck. Coordinates are relative to the deck's centre line. */
export function buildBackline(m: Materials, kickHead: Texture): Group {
	const deck = new Group();
	const place = (object: Object3D, x: number, z: number, turn = 0, y = 0) => {
		object.position.set(x, y, z);
		object.rotation.y = turn;
		deck.add(object);
		return object;
	};
	const fabric = (map: Texture) => new MeshStandardMaterial({ map, roughness: 0.92 });

	place(drumKit(m, kickHead), 0, -0.9);
	place(boomStand(m), -1.28, -0.8);
	place(boomStand(m), 1.28, -0.8, Math.PI);
	// The singer stands a step off centre, which also keeps the kick's wordmark in the clear
	place(vocalStand(m), -0.5, 1.15);

	const sheet = new Mesh(
		new PlaneGeometry(0.21, 0.297),
		new MeshStandardMaterial({ map: setlistSheet(), roughness: 0.8 })
	);
	place(sheet, -0.16, 1.34, 0, 0.004);
	sheet.rotation.set(-Math.PI / 2, 0, 0.18);

	// Stage left: a half stack with a guitar in front of it, and a tweed combo
	const blackCloth = fabric(
		cloth({ base: '#17181b', thread: 'rgb(255 255 255 / 0.05)', aspect: 1, speakers: [2, 2] })
	);
	place(
		amp({ w: 0.76, h: 0.76, d: 0.36, body: m.tolex, cloth: blackCloth, piping: m.piping }, m),
		-3.2,
		-1.75
	);
	place(
		amp(
			{
				w: 0.74,
				h: 0.27,
				d: 0.23,
				body: m.tolex,
				piping: m.piping,
				panel: { height: 0.07, at: 'bottom', face: m.gold, knobs: 6, knob: m.rubber }
			},
			m
		),
		-3.2,
		-1.75,
		0,
		0.775
	);
	const tweedCloth = fabric(
		cloth({ base: '#5b3622', thread: 'rgb(214 170 96 / 0.22)', aspect: 1.6, speakers: [1, 1] })
	);
	place(
		amp(
			{
				w: 0.62,
				h: 0.5,
				d: 0.26,
				body: m.tweed,
				cloth: tweedCloth,
				panel: { height: 0.055, at: 'top', face: m.chrome, knobs: 5, knob: m.rubber }
			},
			m
		),
		-2.25,
		-1.6,
		0.14
	);
	place(guitarOnStand(m.cream, 0.46, m), -3.25, -0.95, 0.2);

	// Stage right: the bass rig, the bass, and a second combo
	const silverCloth = fabric(
		cloth({ base: '#4f545b', thread: 'rgb(255 255 255 / 0.1)', aspect: 0.56, speakers: [2, 4] })
	);
	place(amp({ w: 0.66, h: 1.16, d: 0.4, body: m.tolex, cloth: silverCloth }, m), 3.2, -1.75);
	place(
		amp(
			{
				w: 0.62,
				h: 0.22,
				d: 0.3,
				body: m.tolex,
				panel: { height: 0.09, at: 'bottom', face: m.aluminium, knobs: 7, knob: m.rubber }
			},
			m
		),
		3.2,
		-1.75,
		0,
		1.175
	);
	const diamondCloth = fabric(
		cloth({
			base: '#4a2f1e',
			thread: 'rgb(214 170 96 / 0.3)',
			aspect: 1.55,
			speakers: [2, 1],
			diamond: true
		})
	);
	place(
		amp(
			{
				w: 0.7,
				h: 0.54,
				d: 0.27,
				body: m.tolex,
				cloth: diamondCloth,
				piping: m.gold,
				panel: { height: 0.05, at: 'top', face: m.steel, knobs: 6, knob: m.ivory }
			},
			m
		),
		2.25,
		-1.6,
		-0.14
	);
	place(guitarOnStand(m.burst, 0.6, m), 3.25, -0.95, -0.2);

	// Wedges, each turned to face the player it's for
	const steelMesh = new MeshStandardMaterial({ map: grille(), roughness: 0.6, metalness: 0.4 });
	steelMesh.map!.repeat.set(10, 8);
	const aim = (x: number, z: number, atX: number, atZ: number) =>
		Math.atan2(-(atX - x), -(atZ - z));
	place(wedge(m, steelMesh), -1.75, 1.5, aim(-1.75, 1.5, -1.1, -0.6));
	place(wedge(m, steelMesh), 1.75, 1.5, aim(1.75, 1.5, 1.1, -0.6));
	place(wedge(m, steelMesh), -3.3, 0.75, aim(-3.3, 0.75, -2.9, -0.6));
	place(wedge(m, steelMesh), 3.3, 0.75, aim(3.3, 0.75, 2.9, -0.6));

	// The wings, for screens wide enough to see them
	const paMesh = new MeshStandardMaterial({ map: grille(), roughness: 0.6, metalness: 0.4 });
	paMesh.map!.repeat.set(16, 14);
	place(paStack(m, paMesh), -5.5, 1.1);
	place(paStack(m, paMesh), 5.5, 1.1);
	place(roadCase(1.1, 0.7, 0.6, m), -7, -2.6, 0.1);
	place(roadCase(0.7, 0.5, 0.55, m), -7.05, -2.6, 0.1, 0.78);
	place(roadCase(1.2, 0.9, 0.6, m), -8.6, -2.4, -0.15);
	place(roadCase(1.1, 0.7, 0.6, m), 7, -2.6, -0.1);
	place(roadCase(1.2, 0.9, 0.6, m), 8.6, -2.4, 0.15);
	place(roadCase(0.8, 0.55, 0.55, m), 8.55, -2.4, 0.15, 0.98);

	return bake(deck);
}
