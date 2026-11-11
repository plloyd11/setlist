import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

/** Every surface on the stage is drawn here, so the page ships no image files. */

/** Seeded, so the stage looks the same on every visit. */
export function seeded(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function surface(width: number, height: number) {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	return { canvas, ctx: canvas.getContext('2d')! };
}

function toTexture(canvas: HTMLCanvasElement, tile = false): CanvasTexture {
	const texture = new CanvasTexture(canvas);
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 8;
	if (tile) texture.wrapS = texture.wrapT = RepeatWrapping;
	return texture;
}

/** Floorboards running along v: eight strips across, each a few boards laid end to end. */
export function planks(o: {
	hue: number;
	sat: number;
	light: number;
	spread: number;
	seed: number;
}) {
	const size = 1024;
	const { canvas, ctx } = surface(size, size);
	const rand = seeded(o.seed);
	const strips = 8;
	const width = size / strips;

	for (let i = 0; i < strips; i++) {
		const x = i * width;
		let y = -rand() * 400;
		while (y < size) {
			const length = 420 + rand() * 500;
			const light = o.light + (rand() - 0.5) * o.spread;
			ctx.fillStyle = `hsl(${o.hue + (rand() - 0.5) * 6} ${o.sat}% ${light}%)`;
			ctx.fillRect(x, y, width, length);
			for (let g = 0; g < 46; g++) {
				const shift = (rand() < 0.5 ? -1 : 1) * (1 + rand() * o.spread * 0.6);
				ctx.fillStyle = `hsl(${o.hue} ${o.sat}% ${light + shift}% / ${0.12 + rand() * 0.25})`;
				ctx.fillRect(
					x + rand() * width,
					y + rand() * length * 0.3,
					1 + rand() * 1.5,
					length * (0.4 + rand() * 0.6)
				);
			}
			ctx.fillStyle = 'rgb(0 0 0 / 0.5)';
			ctx.fillRect(x, y + length - 2, width, 2);
			y += length;
		}
		ctx.fillStyle = 'rgb(0 0 0 / 0.55)';
		ctx.fillRect(x, 0, 2, size);
	}
	return toTexture(canvas, true);
}

/** The drum rug: an oxblood field, a banded border and a centre medallion. */
export function rug() {
	const w = 640;
	const h = 512;
	const { canvas, ctx } = surface(w, h);
	const rand = seeded(7);
	const oxblood = '#4a1716';
	const navy = '#141d30';
	const cream = '#cbb894';
	const copper = '#a8623a';

	const diamond = (cx: number, cy: number, rx: number, ry: number) => {
		ctx.beginPath();
		ctx.moveTo(cx, cy - ry);
		ctx.lineTo(cx + rx, cy);
		ctx.lineTo(cx, cy + ry);
		ctx.lineTo(cx - rx, cy);
		ctx.closePath();
	};

	ctx.fillStyle = navy;
	ctx.fillRect(0, 0, w, h);
	ctx.fillStyle = cream;
	ctx.fillRect(20, 20, w - 40, h - 40);
	ctx.fillStyle = oxblood;
	ctx.fillRect(25, 25, w - 50, h - 50);

	// Border band: a run of small diamonds between two cream lines
	const band = 44;
	ctx.fillStyle = navy;
	ctx.fillRect(34, 34, w - 68, h - 68);
	for (let x = 34 + band / 2; x < w - 34; x += band) {
		for (const y of [34 + band / 2, h - 34 - band / 2]) {
			ctx.fillStyle = copper;
			diamond(x, y, band * 0.38, band * 0.38);
			ctx.fill();
			ctx.fillStyle = cream;
			diamond(x, y, band * 0.13, band * 0.13);
			ctx.fill();
		}
	}
	for (let y = 34 + band * 1.5; y < h - 34 - band; y += band) {
		for (const x of [34 + band / 2, w - 34 - band / 2]) {
			ctx.fillStyle = copper;
			diamond(x, y, band * 0.38, band * 0.38);
			ctx.fill();
			ctx.fillStyle = cream;
			diamond(x, y, band * 0.13, band * 0.13);
			ctx.fill();
		}
	}
	const inset = 34 + band;
	ctx.fillStyle = cream;
	ctx.fillRect(inset, inset, w - inset * 2, h - inset * 2);
	ctx.fillStyle = oxblood;
	ctx.fillRect(inset + 4, inset + 4, w - inset * 2 - 8, h - inset * 2 - 8);

	// Field: a quiet lattice, then the medallion
	for (let row = 0; row * 26 < h - inset * 2 - 30; row++) {
		for (let col = 0; col * 30 < w - inset * 2 - 30; col++) {
			const x = inset + 22 + col * 30 + (row % 2) * 15;
			const y = inset + 20 + row * 26;
			ctx.fillStyle = (row + col) % 3 === 0 ? 'rgb(203 184 148 / 0.4)' : 'rgb(20 29 48 / 0.55)';
			diamond(x, y, 5, 6);
			ctx.fill();
		}
	}
	ctx.fillStyle = cream;
	diamond(w / 2, h / 2, 138, 108);
	ctx.fill();
	ctx.fillStyle = navy;
	diamond(w / 2, h / 2, 130, 101);
	ctx.fill();
	ctx.fillStyle = copper;
	diamond(w / 2, h / 2, 84, 64);
	ctx.fill();
	ctx.fillStyle = oxblood;
	diamond(w / 2, h / 2, 60, 45);
	ctx.fill();
	ctx.fillStyle = cream;
	diamond(w / 2, h / 2, 16, 13);
	ctx.fill();

	// Wool
	for (let i = 0; i < 26000; i++) {
		ctx.fillStyle = rand() < 0.5 ? 'rgb(0 0 0 / 0.1)' : 'rgb(255 255 255 / 0.035)';
		ctx.fillRect(rand() * w, rand() * h, 2, 2);
	}
	return toTexture(canvas);
}

/**
 * Speaker cloth. The speakers behind it are only shadows through the weave,
 * which is all you see of them from the floor.
 */
export function cloth(o: {
	base: string;
	thread: string;
	aspect: number;
	speakers?: [columns: number, rows: number];
	diamond?: boolean;
}) {
	const w = 512;
	const h = Math.max(64, Math.round(w / o.aspect));
	const { canvas, ctx } = surface(w, h);
	ctx.fillStyle = o.base;
	ctx.fillRect(0, 0, w, h);

	if (o.speakers) {
		const [columns, rows] = o.speakers;
		const cw = w / columns;
		const ch = h / rows;
		const r = Math.min(cw, ch) * 0.43;
		for (let cx = 0; cx < columns; cx++) {
			for (let cy = 0; cy < rows; cy++) {
				const x = (cx + 0.5) * cw;
				const y = (cy + 0.5) * ch;
				const shade = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
				shade.addColorStop(0, 'rgb(0 0 0 / 0.5)');
				shade.addColorStop(0.25, 'rgb(0 0 0 / 0.28)');
				shade.addColorStop(0.92, 'rgb(0 0 0 / 0.4)');
				shade.addColorStop(1, 'rgb(0 0 0 / 0)');
				ctx.fillStyle = shade;
				ctx.fillRect(x - r, y - r, r * 2, r * 2);
			}
		}
	}

	ctx.strokeStyle = o.thread;
	ctx.lineWidth = 1;
	ctx.beginPath();
	if (o.diamond) {
		for (let d = -h; d < w + h; d += 14) {
			ctx.moveTo(d, 0);
			ctx.lineTo(d + h, h);
			ctx.moveTo(d + h, 0);
			ctx.lineTo(d, h);
		}
	} else {
		for (let x = 0; x < w; x += 4) {
			ctx.moveTo(x + 0.5, 0);
			ctx.lineTo(x + 0.5, h);
		}
		for (let y = 0; y < h; y += 4) {
			ctx.moveTo(0, y + 0.5);
			ctx.lineTo(w, y + 0.5);
		}
	}
	ctx.stroke();
	return toTexture(canvas);
}

/** One deck module's front panel: plain, with the seam where it meets the next. */
export function fascia() {
	const { canvas, ctx } = surface(512, 32);
	ctx.fillStyle = '#fff';
	ctx.fillRect(0, 0, 512, 32);
	ctx.fillStyle = 'rgb(0 0 0 / 0.7)';
	ctx.fillRect(0, 0, 2, 32);
	return toTexture(canvas, true);
}

/** Perforated steel for the PA and the wedges. */
export function grille() {
	const { canvas, ctx } = surface(64, 64);
	ctx.fillStyle = '#17191d';
	ctx.fillRect(0, 0, 64, 64);
	ctx.fillStyle = '#040506';
	for (let y = 0; y < 8; y++) {
		for (let x = 0; x < 8; x++) {
			ctx.beginPath();
			ctx.arc(x * 8 + (y % 2 ? 6 : 2), y * 8 + 4, 2.4, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	return toTexture(canvas, true);
}

/**
 * The front head of the kick drum, with the wordmark on it. Cartridge may still be
 * loading, so the head is drawn once now and again when the font arrives.
 */
export function kickHead(onRedraw: () => void) {
	const size = 512;
	const { canvas, ctx } = surface(size, size);
	const font = '900 86px Cartridge, sans-serif';

	const draw = () => {
		const c = size / 2;
		ctx.fillStyle = '#0c0d10';
		ctx.fillRect(0, 0, size, size);
		const sheen = ctx.createRadialGradient(c - 60, c - 90, 20, c, c, c);
		sheen.addColorStop(0, 'rgb(255 255 255 / 0.07)');
		sheen.addColorStop(1, 'rgb(255 255 255 / 0)');
		ctx.fillStyle = sheen;
		ctx.fillRect(0, 0, size, size);

		ctx.strokeStyle = '#d78951';
		ctx.lineWidth = 5;
		ctx.beginPath();
		ctx.arc(c, c, c * 0.84, 0, Math.PI * 2);
		ctx.stroke();
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(c, c, c * 0.79, 0, Math.PI * 2);
		ctx.stroke();

		ctx.fillStyle = '#e9dfcb';
		ctx.font = font;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('SETLIST', c, c + 4, size * 0.68);
	};

	draw();
	const texture = toTexture(canvas);
	document.fonts
		?.load(font)
		.then(() => {
			draw();
			texture.needsUpdate = true;
			onRedraw();
		})
		.catch(() => {});
	return texture;
}

/** The set, taped to the deck by the centre mic. */
export function setlistSheet() {
	const { canvas, ctx } = surface(128, 180);
	const rand = seeded(3);
	ctx.fillStyle = '#e7e2d6';
	ctx.fillRect(0, 0, 128, 180);
	ctx.fillStyle = '#1a1c20';
	ctx.fillRect(14, 14, 62, 9);
	for (let i = 0; i < 9; i++) {
		ctx.fillRect(14, 36 + i * 15, 46 + rand() * 50, 5);
	}
	return toTexture(canvas);
}

/** A soft round dot: dust in the beams. */
export function mote() {
	const { canvas, ctx } = surface(64, 64);
	const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
	glow.addColorStop(0, 'rgb(255 255 255 / 1)');
	glow.addColorStop(0.35, 'rgb(255 255 255 / 0.35)');
	glow.addColorStop(1, 'rgb(255 255 255 / 0)');
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, 64, 64);
	return toTexture(canvas);
}
