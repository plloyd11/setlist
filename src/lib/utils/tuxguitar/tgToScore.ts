import type { model as AlphaTabModel, Settings } from '@coderline/alphatab';
import {
	SONG_START_TICKS,
	WHOLE_TICKS,
	durationTicks,
	measureTicks,
	type TgBeat,
	type TgChannel,
	type TgMeasure,
	type TgNote,
	type TgSong,
	type TgTrack,
	type TgVoice
} from './readTg.js';

type Model = typeof AlphaTabModel;

const PERCUSSION_BANK = 128;
const PERCUSSION_CHANNEL = 9;
const CHANNEL_COUNT = 16;
const VOICES = [0, 1];
const REST_VALUES = [1, 2, 4, 8, 16, 32, 64];
/** alphaTab bends run 0 to 60 along the note; TuxGuitar's run 0 to 12 */
const BEND_POSITION_SCALE = 5;
/** TuxGuitar stores the whammy bar in semitones, alphaTab in quarter tones. Bends match already. */
const WHAMMY_VALUE_SCALE = 2;
/** alphaTab's strums are in ticks of a 480-per-quarter clock, TuxGuitar's a note value */
const STRUM_TICKS_PER_WHOLE = 1920;

/** The fret a harmonic sounds at, in alphaTab's terms. Same table as its Guitar Pro import. */
function harmonicValue(deltaFret: number): number {
	const values: Record<number, number> = {
		2: 2.4,
		3: 3.2,
		4: 4,
		5: 5,
		7: 7,
		8: 8.2,
		9: 9,
		10: 9.6,
		12: 12,
		14: 14.7,
		15: 14.7,
		16: 16,
		17: 17,
		19: 19,
		21: 21.7,
		22: 21.7,
		24: 24
	};
	return values[deltaFret] ?? 12;
}

/** Velocity steps of 16 from 15, up to alphaTab's PPP (0) to FFF (7) */
const toDynamics = (velocity: number) =>
	Math.min(7, Math.max(0, Math.ceil(velocity / 16) - 1)) as AlphaTabModel.DynamicValue;

function addRests(model: Model, voice: AlphaTabModel.Voice, ticks: number) {
	let left = ticks;
	for (const value of REST_VALUES) {
		const length = WHOLE_TICKS / value;
		while (left >= length) {
			const rest = new model.Beat();
			rest.duration = value as AlphaTabModel.Duration;
			voice.addBeat(rest);
			left -= length;
		}
	}
}

function addGrace(
	model: Model,
	voice: AlphaTabModel.Voice,
	note: AlphaTabModel.Note,
	source: TgNote
) {
	const grace = source.grace!;
	const graceBeat = new model.Beat();
	const graceNote = new model.Note();
	graceNote.string = note.string;
	graceNote.fret = grace.fret;
	graceNote.isDead = grace.dead;
	graceNote.dynamics = toDynamics(grace.dynamic);
	graceBeat.dynamics = graceNote.dynamics;
	graceBeat.duration = (
		grace.duration === 1 ? 64 : grace.duration === 3 ? 16 : 32
	) as AlphaTabModel.Duration;
	graceBeat.graceType = grace.onBeat ? model.GraceType.OnBeat : model.GraceType.BeforeBeat;
	if (grace.transition === 1) {
		graceNote.slideOutType = model.SlideOutType.Legato;
		graceNote.slideTarget = note;
	} else if (grace.transition === 3) {
		graceNote.isHammerPullOrigin = true;
	}
	voice.addGraceBeat(graceBeat);
	graceBeat.addNote(graceNote);
}

function addNote(
	model: Model,
	voice: AlphaTabModel.Voice,
	beat: AlphaTabModel.Beat,
	source: TgNote,
	stringCount: number,
	percussion: boolean
) {
	const note = new model.Note();
	if (percussion) {
		// On a drum track the "fret" is the drum's MIDI key
		note.percussionArticulation = source.value;
	} else {
		// TuxGuitar numbers strings from the highest, alphaTab from the lowest
		if (source.string < 1 || source.string > stringCount) return;
		note.string = stringCount - source.string + 1;
		note.fret = source.value;
	}
	note.isTieDestination = source.tied;
	note.dynamics = toDynamics(source.velocity);
	beat.dynamics = note.dynamics;
	note.isDead = !!source.dead;
	note.isGhost = !!source.ghost;
	note.isPalmMute = !!source.palmMute;
	note.isStaccato = !!source.staccato;
	note.isLetRing = !!source.letRing;
	note.isHammerPullOrigin = !!source.hammer;
	if (source.vibrato) note.vibrato = model.VibratoType.Slight;
	if (source.slide) note.slideOutType = model.SlideOutType.Shift;
	if (source.heavyAccent) note.accentuated = model.AccentuationType.Heavy;
	else if (source.accent) note.accentuated = model.AccentuationType.Normal;
	if (source.tapping) beat.tap = true;
	if (source.slapping) beat.slap = true;
	if (source.popping) beat.pop = true;
	if (source.fadeIn) beat.fade = model.FadeType.FadeIn;

	beat.addNote(note);

	for (const point of source.bend ?? []) {
		note.addBendPoint(new model.BendPoint(point.position * BEND_POSITION_SCALE, point.value));
	}
	for (const point of source.tremoloBar ?? []) {
		beat.addWhammyBarPoint(
			new model.BendPoint(point.position * BEND_POSITION_SCALE, point.value * WHAMMY_VALUE_SCALE)
		);
	}
	if (source.tremoloPicking) {
		const picking = new model.TremoloPickingEffect();
		picking.marks = source.tremoloPicking === 8 ? 1 : source.tremoloPicking === 16 ? 2 : 3;
		beat.tremoloPicking = picking;
	}
	if (percussion) return;

	if (source.harmonic) {
		const { type, data } = source.harmonic;
		const types: Record<number, AlphaTabModel.HarmonicType> = {
			1: model.HarmonicType.Natural,
			2: model.HarmonicType.Artificial,
			3: model.HarmonicType.Tap,
			4: model.HarmonicType.Pinch,
			5: model.HarmonicType.Semi
		};
		note.harmonicType = types[type] ?? model.HarmonicType.Natural;
		note.harmonicValue = harmonicValue(type === 1 ? source.value : type === 3 ? data : 12);
	}
	if (source.trill) {
		note.trillValue = source.trill.fret + note.stringTuning;
		note.trillSpeed = source.trill.duration as AlphaTabModel.Duration;
	}
	if (source.grace) addGrace(model, voice, note, source);
}

function addChord(
	model: Model,
	staff: AlphaTabModel.Staff,
	beat: AlphaTabModel.Beat,
	source: NonNullable<TgBeat['chord']>
) {
	const id = `${source.name}:${source.firstFret}:${source.frets.join(',')}`;
	if (!staff.hasChord(id)) {
		const chord = new model.Chord();
		chord.name = source.name;
		chord.firstFret = source.firstFret;
		chord.strings = source.frets;
		staff.addChord(id, chord);
	}
	beat.chordId = id;
}

function addBeat(
	model: Model,
	staff: AlphaTabModel.Staff,
	voice: AlphaTabModel.Voice,
	source: TgBeat,
	sourceVoice: TgVoice,
	isFirstVoice: boolean,
	stringCount: number,
	percussion: boolean
) {
	const beat = new model.Beat();
	const { value, dots, enters, times } = sourceVoice.duration;
	beat.duration = value as AlphaTabModel.Duration;
	beat.dots = dots;
	if (enters !== 1 || times !== 1) {
		beat.tupletNumerator = enters;
		beat.tupletDenominator = times;
	}
	voice.addBeat(beat);

	// These belong to the whole beat in TuxGuitar, so they go on one voice here
	if (isFirstVoice) {
		if (source.text) beat.text = source.text;
		if (source.stroke && source.stroke.direction !== 0) {
			beat.brushType =
				source.stroke.direction > 0 ? model.BrushType.BrushUp : model.BrushType.BrushDown;
			beat.brushDuration = STRUM_TICKS_PER_WHOLE / source.stroke.value;
		}
		if (source.pickStroke) {
			beat.pickStroke = source.pickStroke > 0 ? model.PickStroke.Up : model.PickStroke.Down;
		}
		if (source.chord) addChord(model, staff, beat, source.chord);
	}
	for (const note of sourceVoice.notes) {
		addNote(model, voice, beat, note, stringCount, percussion);
	}
}

function addVoice(
	model: Model,
	staff: AlphaTabModel.Staff,
	bar: AlphaTabModel.Bar,
	measure: TgMeasure,
	voiceIndex: number,
	measureStart: number,
	stringCount: number,
	percussion: boolean
) {
	const voice = new model.Voice();
	bar.addVoice(voice);
	let cursor = measureStart;
	for (const beat of measure.beats) {
		const source = beat.voices[voiceIndex];
		if (!source) continue;
		// TuxGuitar places beats by time, alphaTab by order, so silence has to be written out
		if (beat.start > cursor) addRests(model, voice, beat.start - cursor);
		const isFirstVoice = beat.voices.findIndex(Boolean) === voiceIndex;
		addBeat(model, staff, voice, beat, source, isFirstVoice, stringCount, percussion);
		cursor = Math.max(cursor, beat.start) + durationTicks(source.duration);
	}
	if (voice.beats.length === 0) {
		const placeholder = new model.Beat();
		placeholder.isEmpty = true;
		voice.addBeat(placeholder);
	}
}

function addTrack(
	model: Model,
	score: AlphaTabModel.Score,
	source: TgTrack,
	channel: TgChannel | undefined,
	measureStarts: number[],
	midiChannels: () => { primary: number; secondary: number }
) {
	const percussion = channel?.bank === PERCUSSION_BANK;
	const track = new model.Track();
	track.ensureStaveCount(1);
	score.addTrack(track);
	track.name = source.name;
	track.color = new model.Color(source.color.r, source.color.g, source.color.b);

	const info = track.playbackInfo;
	info.program = channel?.program ?? 25;
	info.bank = channel?.bank ?? 0;
	info.volume = Math.round(((channel?.volume ?? 127) * 16) / 127);
	info.balance = Math.round(((channel?.balance ?? 64) * 16) / 127);
	info.isSolo = source.solo;
	info.isMute = source.mute;
	if (percussion) {
		info.primaryChannel = info.secondaryChannel = PERCUSSION_CHANNEL;
	} else {
		const { primary, secondary } = midiChannels();
		info.primaryChannel = primary;
		info.secondaryChannel = secondary;
	}

	const staff = track.staves[0];
	if (percussion) {
		staff.isPercussion = true;
		staff.showTablature = false;
	} else {
		staff.stringTuning.tunings = source.strings;
		// alphaTab subtracts this from the pitch, TuxGuitar adds its offset
		staff.transpositionPitch = -source.offset;
		// Guitar parts are written an octave above how they sound
		if (info.program >= 24 && info.program <= 39) staff.displayTranspositionPitch = -12;
	}

	const clefs: Record<number, AlphaTabModel.Clef> = {
		1: model.Clef.G2,
		2: model.Clef.F4,
		3: model.Clef.C4,
		4: model.Clef.C3
	};
	// Every bar of a staff has to carry the same voices, and most tabs only use the first
	const voiceCount = source.measures.some((m) => m.beats.some((b) => b.voices[1]?.notes.length))
		? 2
		: 1;
	source.measures.forEach((measure, i) => {
		const bar = new model.Bar();
		bar.clef = percussion ? model.Clef.Neutral : (clefs[measure.clef] ?? model.Clef.G2);
		// TuxGuitar counts flats as 8 to 14, alphaTab as -1 to -7
		bar.keySignature = (
			measure.keySignature > 7 ? 7 - measure.keySignature : measure.keySignature
		) as AlphaTabModel.KeySignature;
		staff.addBar(bar);
		for (const voiceIndex of VOICES.slice(0, voiceCount)) {
			addVoice(
				model,
				staff,
				bar,
				measure,
				voiceIndex,
				measureStarts[i],
				source.strings.length,
				percussion
			);
		}
	});
}

/** Build alphaTab's score from a .tg song, the way its own importers do for other formats */
export function tgToScore(song: TgSong, model: Model, settings: Settings): AlphaTabModel.Score {
	if (song.headers.length === 0 || song.tracks.length === 0) throw new Error('Nothing to play');

	const score = new model.Score();
	score.title = song.title;
	score.artist = song.artist;
	score.album = song.album;
	score.music = song.author;
	score.copyright = song.copyright;
	score.tab = song.transcriber;
	score.notices = song.comments;

	const measureStarts: number[] = [];
	let start = SONG_START_TICKS;
	let tempo = 0;
	for (const header of song.headers) {
		const bar = new model.MasterBar();
		bar.timeSignatureNumerator = header.numerator;
		bar.timeSignatureDenominator = header.denominator;
		bar.isRepeatStart = header.repeatOpen;
		// alphaTab counts plays, TuxGuitar counts repeats
		if (header.repeatClose > 0) bar.repeatCount = header.repeatClose + 1;
		bar.alternateEndings = header.alternatives;
		if (header.marker !== null) {
			const section = new model.Section();
			section.text = header.marker;
			section.marker = '';
			bar.section = section;
		}
		if (header.tripletFeel === 2) bar.tripletFeel = model.TripletFeel.Triplet8th;
		else if (header.tripletFeel === 3) bar.tripletFeel = model.TripletFeel.Triplet16th;
		if (header.quarterTempo !== tempo) {
			tempo = header.quarterTempo;
			bar.tempoAutomations.push(model.Automation.buildTempoAutomation(false, 0, tempo, 2));
		}
		score.addMasterBar(bar);
		measureStarts.push(start);
		start += measureTicks(header);
	}

	// Each pitched track gets a channel for notes and one for effects, around the drums'
	let next = 0;
	const nextChannel = () => {
		if (next === PERCUSSION_CHANNEL) next++;
		const channel = next % CHANNEL_COUNT;
		next = (next + 1) % CHANNEL_COUNT;
		return channel;
	};
	const midiChannels = () => ({ primary: nextChannel(), secondary: nextChannel() });

	for (const track of song.tracks) {
		const channel = song.channels.find((c) => c.id === track.channelId);
		addTrack(model, score, track, channel, measureStarts, midiChannels);
	}

	score.finish(settings);
	return score;
}
