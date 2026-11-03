/**
 * Reads TuxGuitar's native .tg files, which alphaTab can't. There are two formats:
 * since TuxGuitar 1.6 a zip holding version.txt and content.xml, and before that a
 * binary Java stream. The binary reader covers the 1.3 layout, which 1.5 kept as is.
 * Anything older fails, and the player offers the download instead.
 */

/** TuxGuitar's "precise" whole note: every tuplet divides it exactly */
export const WHOLE_TICKS = 11_531_520;
/** Songs start one quarter in, which is where TuxGuitar counts from */
export const SONG_START_TICKS = WHOLE_TICKS / 4;

const MAX_UNZIPPED_BYTES = 100 * 1024 * 1024;

export interface TgDuration {
	value: number;
	dots: number;
	enters: number;
	times: number;
}

export interface TgPoint {
	position: number;
	value: number;
}

export interface TgGrace {
	fret: number;
	duration: number;
	dynamic: number;
	transition: number;
	onBeat: boolean;
	dead: boolean;
}

export interface TgNote {
	value: number;
	string: number;
	velocity: number;
	tied: boolean;
	bend?: TgPoint[];
	tremoloBar?: TgPoint[];
	harmonic?: { type: number; data: number };
	grace?: TgGrace;
	trill?: { fret: number; duration: number };
	tremoloPicking?: number;
	vibrato?: boolean;
	dead?: boolean;
	slide?: boolean;
	hammer?: boolean;
	ghost?: boolean;
	accent?: boolean;
	heavyAccent?: boolean;
	palmMute?: boolean;
	staccato?: boolean;
	tapping?: boolean;
	slapping?: boolean;
	popping?: boolean;
	fadeIn?: boolean;
	letRing?: boolean;
}

export interface TgVoice {
	duration: TgDuration;
	notes: TgNote[];
}

export interface TgChord {
	name: string;
	firstFret: number;
	frets: number[];
}

export interface TgBeat {
	start: number;
	stroke?: { direction: number; value: number };
	pickStroke?: number;
	chord?: TgChord;
	text?: string;
	voices: (TgVoice | null)[];
}

export interface TgMeasure {
	clef: number;
	keySignature: number;
	beats: TgBeat[];
}

export interface TgHeader {
	numerator: number;
	denominator: number;
	quarterTempo: number;
	repeatOpen: boolean;
	repeatClose: number;
	alternatives: number;
	marker: string | null;
	tripletFeel: number;
}

export interface TgChannel {
	id: number;
	bank: number;
	program: number;
	volume: number;
	balance: number;
}

export interface TgTrack {
	name: string;
	channelId: number;
	solo: boolean;
	mute: boolean;
	offset: number;
	color: { r: number; g: number; b: number };
	strings: number[];
	measures: TgMeasure[];
}

export interface TgSong {
	title: string;
	artist: string;
	album: string;
	author: string;
	copyright: string;
	transcriber: string;
	comments: string;
	channels: TgChannel[];
	headers: TgHeader[];
	tracks: TgTrack[];
}

const TRIPLET_FEEL_NONE = 1;
const DEFAULT_VELOCITY = 95;
const NORMAL_DURATION: TgDuration = { value: 4, dots: 0, enters: 1, times: 1 };

export function durationTicks(duration: TgDuration): number {
	let ticks = WHOLE_TICKS / duration.value;
	if (duration.dots === 1) ticks += ticks / 2;
	else if (duration.dots === 2) ticks += (ticks * 3) / 4;
	return (ticks * duration.times) / duration.enters;
}

export const measureTicks = (header: TgHeader) =>
	(header.numerator * WHOLE_TICKS) / header.denominator;

export async function readTuxGuitar(data: ArrayBuffer): Promise<TgSong> {
	const bytes = new Uint8Array(data);
	const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
	return isZip ? readZip(bytes) : readBinary(bytes);
}

// ---- Zip ----------------------------------------------------------------------------

async function inflate(compressed: Uint8Array): Promise<Uint8Array> {
	const stream = new Blob([compressed as BlobPart])
		.stream()
		.pipeThrough(new DecompressionStream('deflate-raw'));
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.length;
		// A few bad megabytes can unzip to gigabytes and take the tab down with them
		if (total > MAX_UNZIPPED_BYTES) {
			await reader.cancel();
			throw new Error('File unzips to too much data');
		}
		chunks.push(value);
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.length;
	}
	return out;
}

/** Sizes come from the central directory: local headers leave them blank when streamed */
async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let end = bytes.length - 22;
	while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--;
	if (end < 0) throw new Error('Not a zip file');

	const files = new Map<string, Uint8Array>();
	const count = view.getUint16(end + 10, true);
	let entry = view.getUint32(end + 16, true);
	for (let i = 0; i < count; i++) {
		if (view.getUint32(entry, true) !== 0x02014b50) throw new Error('Bad zip entry');
		const method = view.getUint16(entry + 10, true);
		const compressedSize = view.getUint32(entry + 20, true);
		const nameLength = view.getUint16(entry + 28, true);
		const extraLength = view.getUint16(entry + 30, true);
		const commentLength = view.getUint16(entry + 32, true);
		const localHeader = view.getUint32(entry + 42, true);
		const name = new TextDecoder().decode(bytes.subarray(entry + 46, entry + 46 + nameLength));
		entry += 46 + nameLength + extraLength + commentLength;

		const localNameLength = view.getUint16(localHeader + 26, true);
		const localExtraLength = view.getUint16(localHeader + 28, true);
		const start = localHeader + 30 + localNameLength + localExtraLength;
		const raw = bytes.subarray(start, start + compressedSize);
		if (method === 0) files.set(name, raw);
		else if (method === 8) files.set(name, await inflate(raw));
		else throw new Error('Unknown zip compression');
	}
	return files;
}

async function readZip(bytes: Uint8Array): Promise<TgSong> {
	const files = await unzip(bytes);
	const version = files.get('version.txt');
	const content = files.get('content.xml');
	if (!version || !content) throw new Error('Not a TuxGuitar file');
	if (!new TextDecoder().decode(version).startsWith('TuxGuitar_file_format ')) {
		throw new Error('Not a TuxGuitar file');
	}
	return readXml(new TextDecoder().decode(content));
}

// ---- XML ----------------------------------------------------------------------------

const childOf = (el: Element, name: string) =>
	Array.from(el.children).find((child) => child.tagName === name) ?? null;
const childrenOf = (el: Element, name: string) =>
	Array.from(el.children).filter((child) => child.tagName === name);
const has = (el: Element, name: string) => childOf(el, name) !== null;
const text = (el: Element, name: string) => childOf(el, name)?.textContent ?? '';
const int = (value: string | null | undefined) => {
	const n = Number(value);
	if (value === null || value === undefined || value === '' || !Number.isFinite(n)) {
		throw new Error('Expected a number');
	}
	return n;
};
const intChild = (el: Element, name: string) => int(childOf(el, name)?.textContent);

const XML_CLEFS: Record<string, number> = { treble: 1, bass: 2, tenor: 3, alto: 4 };
const XML_TRIPLET_FEEL: Record<string, number> = { none: 1, eighth: 2, sixteenth: 3 };
const XML_STROKES: Record<string, number> = { none: 0, up: 1, down: -1 };
const XML_PICK_STROKES: Record<string, number> = { up: 1, down: -1 };
const XML_HARMONICS: Record<string, number> = {
	'N.H': 1,
	'A.H': 2,
	'T.H': 3,
	'P.H': 4,
	'S.H': 5
};
const XML_TRANSITIONS: Record<string, number> = { none: 0, slide: 1, bend: 2, hammer: 3 };

function readXml(xml: string): TgSong {
	// TuxGuitar refuses these too: nothing it writes has one, and they enable entity bombs
	if (xml.includes('<!DOCTYPE')) throw new Error('Unexpected doctype');
	const doc = new DOMParser().parseFromString(xml, 'application/xml');
	if (doc.querySelector('parsererror')) throw new Error('Invalid XML');
	const root = doc.documentElement;
	const songEl = root.tagName === 'TuxGuitarFile' ? childOf(root, 'TGSong') : null;
	if (!songEl) throw new Error('Not a TuxGuitar file');

	const headers = readXmlHeaders(songEl);
	return {
		title: text(songEl, 'name'),
		artist: text(songEl, 'artist'),
		album: text(songEl, 'album'),
		author: text(songEl, 'author'),
		copyright: text(songEl, 'copyright'),
		transcriber: text(songEl, 'transcriber'),
		comments: text(songEl, 'comments'),
		channels: childrenOf(songEl, 'TGChannel').map((el) => ({
			id: intChild(el, 'id'),
			bank: intChild(el, 'bank'),
			program: intChild(el, 'program'),
			volume: intChild(el, 'volume'),
			balance: intChild(el, 'balance')
		})),
		headers,
		tracks: childrenOf(songEl, 'TGTrack').map((el) => readXmlTrack(el, headers.length))
	};
}

function readXmlHeaders(songEl: Element): TgHeader[] {
	let numerator = 4;
	let denominator = 4;
	let quarterTempo = 120;
	return childrenOf(songEl, 'TGMeasureHeader').map((el) => {
		const signature = childOf(el, 'timeSignature');
		if (signature) {
			numerator = int(signature.getAttribute('numerator'));
			denominator = int(signature.getAttribute('denominator'));
		}
		const tempo = childOf(el, 'tempo');
		if (tempo) {
			const base = tempo.getAttribute('base');
			const dotted = tempo.getAttribute('dotted') === 'true';
			quarterTempo =
				(int(tempo.textContent) * 4 * (dotted ? 1.5 : 1)) / (base === null ? 4 : int(base));
		}
		let alternatives = 0;
		const repeatAlternative = childOf(el, 'repeatAlternative');
		if (repeatAlternative) {
			for (const alternative of childrenOf(repeatAlternative, 'alternative')) {
				alternatives |= 1 << (int(alternative.textContent) - 1);
			}
		}
		const repeatClose = childOf(el, 'repeatClose');
		return {
			numerator,
			denominator,
			quarterTempo,
			repeatOpen: has(el, 'repeatOpen'),
			repeatClose: repeatClose ? int(repeatClose.textContent) : 0,
			alternatives,
			marker: childOf(el, 'marker')?.textContent ?? null,
			tripletFeel: XML_TRIPLET_FEEL[text(el, 'tripletFeel')] ?? TRIPLET_FEEL_NONE
		};
	});
}

function readXmlTrack(el: Element, measureCount: number): TgTrack {
	const color = childOf(el, 'color');
	const soloMute = text(el, 'soloMute');
	const offset = childOf(el, 'offset');
	let clef = 1;
	let keySignature = 0;
	const measures = childrenOf(el, 'TGMeasure').map((measure) => {
		const clefEl = childOf(measure, 'clef');
		if (clefEl) clef = XML_CLEFS[clefEl.textContent ?? ''] ?? clef;
		const keyEl = childOf(measure, 'keySignature');
		if (keyEl) keySignature = int(keyEl.textContent);
		return {
			clef,
			keySignature,
			beats: childrenOf(measure, 'TGBeat').map(readXmlBeat)
		};
	});
	if (measures.length !== measureCount) throw new Error('Unexpected number of measures');
	return {
		name: text(el, 'name'),
		channelId: intChild(el, 'channelId'),
		solo: soloMute === 'solo',
		mute: soloMute === 'mute',
		offset: offset ? int(offset.textContent) : 0,
		color: {
			r: int(color?.getAttribute('R') ?? '0'),
			g: int(color?.getAttribute('G') ?? '0'),
			b: int(color?.getAttribute('B') ?? '0')
		},
		strings: childrenOf(el, 'TGString').map((string) => int(string.textContent)),
		measures
	};
}

function readXmlBeat(el: Element): TgBeat {
	const beat: TgBeat = {
		start: intChild(el, 'preciseStart'),
		voices: childrenOf(el, 'voice').map(readXmlVoice)
	};
	const stroke = childOf(el, 'stroke');
	if (stroke) {
		beat.stroke = {
			direction: XML_STROKES[stroke.getAttribute('direction') ?? 'none'] ?? 0,
			value: int(stroke.getAttribute('value'))
		};
	}
	const pickStroke = childOf(el, 'pickStroke');
	if (pickStroke) beat.pickStroke = XML_PICK_STROKES[pickStroke.textContent ?? ''];
	const chord = childOf(el, 'chord');
	if (chord) {
		beat.chord = {
			name: text(chord, 'name'),
			firstFret: intChild(chord, 'firstFret'),
			frets: childrenOf(chord, 'string').map((string) =>
				string.textContent === '' ? -1 : int(string.textContent)
			)
		};
	}
	const beatText = childOf(el, 'text');
	if (beatText) beat.text = beatText.textContent ?? '';
	return beat;
}

function readXmlVoice(el: Element): TgVoice | null {
	const durationEl = childOf(el, 'duration');
	if (!durationEl) throw new Error('Voice without a duration');
	const dotted = durationEl.getAttribute('dotted');
	const division = childOf(durationEl, 'divisionType');
	const duration = {
		value: int(durationEl.getAttribute('value')),
		dots: dotted === 'dotted' ? 1 : dotted === 'doubleDotted' ? 2 : 0,
		enters: division ? int(division.getAttribute('enters')) : 1,
		times: division ? int(division.getAttribute('times')) : 1
	};
	let velocity = DEFAULT_VELOCITY;
	const notes = childrenOf(el, 'note').map((noteEl) => {
		const velocityAttr = noteEl.getAttribute('velocity');
		if (velocityAttr !== null) velocity = int(velocityAttr);
		return readXmlNote(noteEl, velocity);
	});
	const emptyAttr = el.getAttribute('empty');
	const empty = emptyAttr === null ? notes.length === 0 : emptyAttr === 'true';
	return empty ? null : { duration, notes };
}

const xmlPoints = (el: Element): TgPoint[] =>
	childrenOf(el, 'point').map((point) => ({
		position: int(point.getAttribute('position')),
		value: int(point.getAttribute('value'))
	}));

function readXmlNote(el: Element, velocity: number): TgNote {
	const note: TgNote = {
		value: int(el.getAttribute('value')),
		string: int(el.getAttribute('string')),
		velocity,
		tied: el.getAttribute('tiedNote') === 'true',
		vibrato: has(el, 'vibrato'),
		dead: has(el, 'deadNote'),
		slide: has(el, 'slide'),
		hammer: has(el, 'hammer'),
		ghost: has(el, 'ghostNote'),
		accent: has(el, 'accentuatedNote'),
		heavyAccent: has(el, 'heavyAccentuatedNote'),
		palmMute: has(el, 'palmMute'),
		staccato: has(el, 'staccato'),
		tapping: has(el, 'tapping'),
		slapping: has(el, 'slapping'),
		popping: has(el, 'popping'),
		fadeIn: has(el, 'fadeIn'),
		letRing: has(el, 'letRing')
	};
	const bend = childOf(el, 'bend');
	if (bend) note.bend = xmlPoints(bend);
	const tremoloBar = childOf(el, 'tremoloBar');
	if (tremoloBar) note.tremoloBar = xmlPoints(tremoloBar);
	const harmonic = childOf(el, 'harmonic');
	if (harmonic) {
		note.harmonic = {
			type: XML_HARMONICS[harmonic.getAttribute('type') ?? ''] ?? 1,
			data: int(harmonic.getAttribute('data') ?? '0')
		};
	}
	const grace = childOf(el, 'grace');
	if (grace) {
		note.grace = {
			fret: int(grace.getAttribute('fret')),
			duration: int(grace.getAttribute('duration')),
			dynamic: int(grace.getAttribute('dynamic')),
			transition: XML_TRANSITIONS[grace.getAttribute('transition') ?? 'none'] ?? 0,
			onBeat: grace.getAttribute('onBeat') === 'true',
			dead: grace.getAttribute('dead') === 'true'
		};
	}
	const trill = childOf(el, 'trill');
	if (trill) {
		note.trill = {
			fret: int(trill.getAttribute('fret')),
			duration: int(trill.getAttribute('duration'))
		};
	}
	const picking = childOf(el, 'tremoloPicking');
	if (picking) note.tremoloPicking = int(picking.getAttribute('duration'));
	return note;
}

// ---- Binary, the 1.3 and 1.5 layout ---------------------------------------------------

const BINARY_FORMATS = new Set(['TuxGuitar File Format - 1.3', 'TuxGuitar File Format - 1.5']);
/** 1.3 and 1.5 store a track's transposition from this floor */
const MIN_OFFSET = -24;
const MAX_VOICES = 2;
/** Tremolo bar values are stored shifted up, to keep them positive */
const TREMOLO_BAR_SHIFT = 12;

class BinaryReader {
	#view: DataView;
	#position = 0;

	constructor(bytes: Uint8Array) {
		this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	}
	/** Signed, as TuxGuitar reads it */
	byte() {
		const value = this.#view.getInt8(this.#position);
		this.#position += 1;
		return value;
	}
	unsigned() {
		const value = this.#view.getUint8(this.#position);
		this.#position += 1;
		return value;
	}
	short() {
		const value = this.#view.getInt16(this.#position);
		this.#position += 2;
		return value;
	}
	flags24() {
		return (this.unsigned() << 16) | (this.unsigned() << 8) | this.unsigned();
	}
	#chars(length: number) {
		if (length < 0 || this.#position + length * 2 > this.#view.byteLength) {
			throw new Error('String runs past the end of the file');
		}
		let out = '';
		for (let i = 0; i < length; i++)
			out += String.fromCharCode(this.#view.getUint16(this.#position + i * 2));
		this.#position += length * 2;
		return out;
	}
	shortString() {
		return this.#chars(this.unsigned());
	}
	longString() {
		const length = this.#view.getInt32(this.#position);
		this.#position += 4;
		return this.#chars(length);
	}
}

function readBinary(bytes: Uint8Array): TgSong {
	const data = new BinaryReader(bytes);
	if (!BINARY_FORMATS.has(data.shortString())) throw new Error('Unsupported TuxGuitar version');

	const title = data.shortString();
	const artist = data.shortString();
	const album = data.shortString();
	const author = data.shortString();
	data.shortString(); // date
	const copyright = data.shortString();
	data.shortString(); // writer
	const transcriber = data.shortString();
	const comments = data.longString();

	const channels: TgChannel[] = [];
	for (let i = data.byte(); i > 0; i--) channels.push(readBinaryChannel(data));

	const headers: TgHeader[] = [];
	for (let i = data.short(); i > 0; i--) {
		headers.push(readBinaryHeader(data, headers[headers.length - 1] ?? null));
	}

	const tracks: TgTrack[] = [];
	for (let i = data.byte(); i > 0; i--) tracks.push(readBinaryTrack(data, headers));

	return {
		title,
		artist,
		album,
		author,
		copyright,
		transcriber,
		comments,
		channels,
		headers,
		tracks
	};
}

function readBinaryChannel(data: BinaryReader): TgChannel {
	const id = data.short();
	const bank = data.unsigned();
	const program = data.unsigned();
	const volume = data.unsigned();
	const balance = data.unsigned();
	for (let i = 0; i < 4; i++) data.unsigned(); // chorus, reverb, phaser, tremolo
	data.shortString(); // name
	for (let i = data.short(); i > 0; i--) {
		data.shortString();
		data.longString();
	}
	return { id, bank, program, volume, balance };
}

function readBinaryDuration(data: BinaryReader): TgDuration {
	const flags = data.unsigned();
	const value = data.byte();
	const hasTuplet = (flags & 0x04) !== 0;
	return {
		value,
		dots: flags & 0x01 ? 1 : flags & 0x02 ? 2 : 0,
		enters: hasTuplet ? data.byte() : 1,
		times: hasTuplet ? data.byte() : 1
	};
}

function readBinaryHeader(data: BinaryReader, previous: TgHeader | null): TgHeader {
	const flags = data.unsigned();
	let numerator = previous?.numerator ?? 4;
	let denominator = previous?.denominator ?? 4;
	if (flags & 0x01) {
		numerator = data.byte();
		denominator = readBinaryDuration(data).value;
	}
	const quarterTempo = flags & 0x02 ? data.short() : (previous?.quarterTempo ?? 120);
	const repeatClose = flags & 0x08 ? data.short() : 0;
	const alternatives = flags & 0x10 ? data.unsigned() : 0;
	let marker: string | null = null;
	if (flags & 0x20) {
		marker = data.shortString();
		for (let i = 0; i < 3; i++) data.unsigned(); // color
	}
	return {
		numerator,
		denominator,
		quarterTempo,
		repeatOpen: (flags & 0x04) !== 0,
		repeatClose,
		alternatives,
		marker,
		tripletFeel: flags & 0x40 ? data.byte() : (previous?.tripletFeel ?? TRIPLET_FEEL_NONE)
	};
}

function readBinaryTrack(data: BinaryReader, headers: TgHeader[]): TgTrack {
	const flags = data.unsigned();
	const name = data.shortString();
	const channelId = data.short();

	const measures: TgMeasure[] = [];
	let measureStart = SONG_START_TICKS;
	for (const header of headers) {
		measures.push(readBinaryMeasure(data, measureStart, measures[measures.length - 1] ?? null));
		measureStart += measureTicks(header);
	}

	const strings: number[] = [];
	for (let i = data.byte(); i > 0; i--) strings.push(data.byte());
	const offset = MIN_OFFSET + data.byte();
	const color = { r: data.unsigned(), g: data.unsigned(), b: data.unsigned() };
	if (flags & 0x04) {
		data.short(); // lyrics start
		data.longString(); // lyrics
	}
	return {
		name,
		channelId,
		solo: (flags & 0x01) !== 0,
		mute: (flags & 0x02) !== 0,
		offset,
		color,
		strings,
		measures
	};
}

function readBinaryMeasure(
	data: BinaryReader,
	measureStart: number,
	previous: TgMeasure | null
): TgMeasure {
	const flags = data.unsigned();

	// What carries from one beat to the next within a measure
	const voiceState = Array.from({ length: MAX_VOICES }, () => ({
		start: measureStart,
		flags: 0,
		velocity: DEFAULT_VELOCITY,
		duration: { ...NORMAL_DURATION }
	}));
	let currentStart = measureStart;
	const beats: TgBeat[] = [];
	let beatFlags = 0x01;
	while (beatFlags & 0x01) {
		beatFlags = data.unsigned();
		const later = voiceState.map((v) => v.start).filter((start) => start > currentStart);
		if (later.length > 0) currentStart = Math.min(...later);

		const voices: (TgVoice | null)[] = [];
		for (let i = 0; i < MAX_VOICES; i++) {
			const shift = i * 2;
			const state = voiceState[i];
			if (!(beatFlags & (0x10 << shift))) {
				voices.push(null);
				continue;
			}
			if (beatFlags & (0x20 << shift)) state.flags = data.unsigned();
			if (state.flags & 0x02) state.duration = readBinaryDuration(data);
			const notes: TgNote[] = [];
			if (state.flags & 0x01) {
				let noteFlags = 0x01;
				while (noteFlags & 0x01) {
					noteFlags = data.unsigned();
					notes.push(readBinaryNote(data, noteFlags, state));
				}
			}
			voices.push({ duration: { ...state.duration }, notes });
			state.start += durationTicks(state.duration);
		}

		const beat: TgBeat = { start: currentStart, voices };
		if (beatFlags & 0x02) beat.stroke = { direction: data.byte(), value: data.byte() };
		if (beatFlags & 0x04) {
			const stringCount = data.byte();
			const name = data.shortString();
			const firstFret = data.byte();
			const frets: number[] = [];
			for (let i = 0; i < stringCount; i++) frets.push(data.byte());
			beat.chord = { name, firstFret, frets };
		}
		if (beatFlags & 0x08) beat.text = data.shortString();
		beats.push(beat);
	}

	return {
		clef: flags & 0x01 ? data.byte() : (previous?.clef ?? 1),
		keySignature: flags & 0x02 ? data.byte() : (previous?.keySignature ?? 0),
		beats
	};
}

function readBinaryPoints(data: BinaryReader, shift: number): TgPoint[] {
	const points: TgPoint[] = [];
	for (let i = data.byte(); i > 0; i--) {
		const position = data.byte();
		points.push({ position, value: data.byte() - shift });
	}
	return points;
}

function readBinaryNote(data: BinaryReader, flags: number, state: { velocity: number }): TgNote {
	const value = data.byte();
	const string = data.byte();
	if (flags & 0x08) state.velocity = data.byte();
	const note: TgNote = { value, string, velocity: state.velocity, tied: (flags & 0x02) !== 0 };
	if (!(flags & 0x04)) return note;

	const effects = data.flags24();
	if (effects & 0x000001) note.bend = readBinaryPoints(data, 0);
	if (effects & 0x000002) note.tremoloBar = readBinaryPoints(data, TREMOLO_BAR_SHIFT);
	if (effects & 0x000004) {
		const type = data.byte();
		note.harmonic = { type, data: type === 1 ? 0 : data.byte() };
	}
	if (effects & 0x000008) {
		const graceFlags = data.unsigned();
		note.grace = {
			dead: (graceFlags & 0x01) !== 0,
			onBeat: (graceFlags & 0x02) !== 0,
			fret: data.byte(),
			duration: data.byte(),
			dynamic: data.byte(),
			transition: data.byte()
		};
	}
	if (effects & 0x000010) note.trill = { fret: data.byte(), duration: data.byte() };
	if (effects & 0x000020) note.tremoloPicking = data.byte();
	note.vibrato = (effects & 0x000040) !== 0;
	note.dead = (effects & 0x000080) !== 0;
	note.slide = (effects & 0x000100) !== 0;
	note.hammer = (effects & 0x000200) !== 0;
	note.ghost = (effects & 0x000400) !== 0;
	note.accent = (effects & 0x000800) !== 0;
	note.heavyAccent = (effects & 0x001000) !== 0;
	note.palmMute = (effects & 0x002000) !== 0;
	note.staccato = (effects & 0x004000) !== 0;
	note.tapping = (effects & 0x008000) !== 0;
	note.slapping = (effects & 0x010000) !== 0;
	note.popping = (effects & 0x020000) !== 0;
	note.fadeIn = (effects & 0x040000) !== 0;
	note.letRing = (effects & 0x080000) !== 0;
	return note;
}
