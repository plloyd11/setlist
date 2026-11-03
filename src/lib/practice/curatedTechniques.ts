/**
 * The curated starter library: general practice methods, written for this app. Lessons
 * live here rather than in the database so they can be reviewed and versioned like code.
 * Starting one copies its drills into the musician's own exercises. A lesson written by
 * Claude has this same shape and is saved on the skill itself.
 */
export type Instrument = 'guitar' | 'bass' | 'keys' | 'drums' | 'vocals' | 'other';

export const INSTRUMENTS: { value: Instrument; label: string }[] = [
	{ value: 'guitar', label: 'Guitar' },
	{ value: 'bass', label: 'Bass' },
	{ value: 'keys', label: 'Keys' },
	{ value: 'drums', label: 'Drums' },
	{ value: 'vocals', label: 'Vocals' },
	{ value: 'other', label: 'Something else' }
];

export interface Lesson {
	summary: string;
	why: string;
	steps: string[];
	mistakes: string[];
}

export interface Drill {
	title: string;
	minutes: number;
	how: string;
}

export interface CuratedTechnique extends Lesson {
	key: string;
	title: string;
	/** Empty means it's for everyone */
	instruments: Instrument[];
	goalBpm: number | null;
	drills: Drill[];
}

export const CURATED_TECHNIQUES: CuratedTechnique[] = [
	{
		key: 'playing-in-time',
		title: 'Playing in time',
		instruments: [],
		goalBpm: null,
		summary: 'Lock to a click, then learn to feel the time between the clicks.',
		why: 'Solid time makes a band sound good before anything else does, and it is the skill every other technique sits on.',
		steps: [
			'Set the metronome slow enough that you can hear the gap between clicks, around 60 BPM.',
			'Count out loud in eighth notes while you play, so you feel the subdivision and not just the beat.',
			'Now treat the click as beats 2 and 4 only. The space is bigger, so any drift shows up fast.',
			'Record yourself for a minute and listen back. Your ears are more honest while you are not playing.'
		],
		mistakes: [
			'Speeding up the moment something feels easy. Stay put until it feels boring.',
			'Following the click instead of playing with it. If you are reacting, you are already late.'
		],
		drills: [
			{
				title: 'Subdivide out loud',
				minutes: 3,
				how: 'Play one note or chord in eighth notes at 60 BPM while counting "1 and 2 and". Then try triplets.'
			},
			{
				title: 'Click on 2 and 4',
				minutes: 3,
				how: 'Set the metronome to half your tempo and hear each click as beats 2 and 4. Play a simple groove against it.'
			}
		]
	},
	{
		key: 'alternate-picking',
		title: 'Alternate picking',
		instruments: ['guitar'],
		goalBpm: 140,
		summary: 'Strict down-up motion that stays even and clean as it gets faster.',
		why: 'It keeps your hand moving the same way however many notes you play, which is what makes fast lines even.',
		steps: [
			'Hold the pick loosely and keep the motion small, from the wrist rather than the arm.',
			'Pick a single string in strict down-up sixteenths, slowly, and listen for the downs and ups sounding equal.',
			'Add a four-note fretting pattern and keep the pick direction unbroken.',
			'Raise the tempo in small steps only when three clean passes in a row feel easy.'
		],
		mistakes: [
			'Tensing up to go faster. Speed comes from less motion, not more effort.',
			'Letting the two hands drift apart. If the notes smear, slow down until they line up again.'
		],
		drills: [
			{
				title: 'One-string tremolo',
				minutes: 2,
				how: 'Sixteenth notes on one fretted note. Stay relaxed and even, and move across strings every four bars.'
			},
			{
				title: 'Chromatic 1-2-3-4',
				minutes: 3,
				how: 'Frets 1-2-3-4 on each string, strict alternate picking, then move up one fret and come back.'
			}
		]
	},
	{
		key: 'legato',
		title: 'Hammer-ons and pull-offs',
		instruments: ['guitar', 'bass'],
		goalBpm: 120,
		summary: 'Notes that sound even without the pick, from a strong and accurate fretting hand.',
		why: 'It gives lines a smoother voice and builds strength and control in the fretting hand.',
		steps: [
			'Hammer from the fingertip, close to the fret, using speed more than force.',
			'On a pull-off, pluck the string slightly sideways as your finger leaves, so the next note speaks.',
			'Mute the strings you are not using with your other fingers and picking hand.',
			'Check that hammered notes match picked notes in volume. Alternate between them to compare.'
		],
		mistakes: [
			'Lifting straight up on a pull-off, which leaves the next note weak.',
			'Squeezing harder as you tire. Stop and shake out rather than pressing through it.'
		],
		drills: [
			{
				title: 'Two-finger trills',
				minutes: 2,
				how: 'Trill between two fingers on one string for 20 seconds each pair, keeping every note the same volume.'
			},
			{
				title: 'Three-note runs',
				minutes: 3,
				how: 'Pick the first note, then hammer the next two. Reverse it with pull-offs on the way back down.'
			}
		]
	},
	{
		key: 'string-bending',
		title: 'Bending in tune',
		instruments: ['guitar'],
		goalBpm: null,
		summary: 'Land every bend on the pitch you meant, by ear.',
		why: 'A bend that lands flat is the fastest way to sound unsure, and a good one is the most vocal thing a guitar can do.',
		steps: [
			'Play the target note first, two frets up, so it is in your ear.',
			'Bend up to it using two or three fingers together, with the push coming from a rotating wrist.',
			'Compare the two pitches, and only then move to a different string or fret.',
			'Add vibrato once the note is there, keeping the pitch from falling below the target.'
		],
		mistakes: [
			'Bending with one finger alone, which tires quickly and wobbles.',
			'Stopping short on higher strings. They need more push than they feel like they do.'
		],
		drills: [
			{
				title: 'Target and bend',
				minutes: 3,
				how: 'Fret the target note, then bend up to it from two frets below. Repeat on strings 1 to 3 across the neck.'
			},
			{
				title: 'Slow vibrato',
				minutes: 2,
				how: 'Hold a bent note and add wide, slow vibrato to the metronome, one movement per beat.'
			}
		]
	},
	{
		key: 'chord-changes',
		title: 'Clean chord changes',
		instruments: ['guitar'],
		goalBpm: 100,
		summary: 'Move between shapes on time, without the gap before the next chord.',
		why: 'Most rhythm playing lives or dies on the changes, not the shapes.',
		steps: [
			'Pick the two chords you find hardest to move between. Look for any finger that can stay put or slide.',
			'Change between them in slow motion, watching which fingers arrive last.',
			'Strum on beat 1 only and use the rest of the bar to get there early.',
			'Shorten the time you allow until the change fits in the last beat of the bar.'
		],
		mistakes: [
			'Slowing down the strum to wait for the fingers. Keep the hand moving and let the change catch up.',
			'Lifting all your fingers high off the neck between shapes.'
		],
		drills: [
			{
				title: 'One-minute changes',
				minutes: 2,
				how: 'Count how many clean changes between two chords you get in a minute. Write it down and beat it next time.'
			},
			{
				title: 'Beat 1 strum',
				minutes: 3,
				how: 'Strum each chord once on beat 1 at 60 BPM, then on 1 and 3, then all four beats.'
			}
		]
	},
	{
		key: 'finger-alternation',
		title: 'Fingerstyle alternation',
		instruments: ['bass'],
		goalBpm: 120,
		summary: 'Even tone and volume from both plucking fingers.',
		why: 'A bass line carries the groove, and an uneven plucking hand makes a groove lumpy.',
		steps: [
			'Rest your thumb and pluck through the string towards the next one, using index and middle in turn.',
			'Play steady eighth notes on one note and listen for a difference between the two fingers.',
			'Change strings without skipping the alternation, or plan a rake if you use one, consistently.',
			'Keep the plucking position and volume the same as you move across the strings.'
		],
		mistakes: [
			'Leading with the same finger every time, which often leaves the other one weaker.',
			'Plucking harder to get more sound rather than letting the amp do it.'
		],
		drills: [
			{
				title: 'Even eighths',
				minutes: 3,
				how: 'Eighth notes on one open string at a slow tempo, starting with each finger in turn. Listen for a match.'
			},
			{
				title: 'Octave walk',
				minutes: 2,
				how: 'Alternate between a note and its octave, keeping both fingers and both pitches the same volume.'
			}
		]
	},
	{
		key: 'bass-muting',
		title: 'Muting and note length',
		instruments: ['bass'],
		goalBpm: null,
		summary: 'Control exactly when a note stops, and keep the other strings quiet.',
		why: 'Where a note ends shapes the groove as much as where it starts, and stray ringing muddies a mix.',
		steps: [
			'Release pressure with your fretting hand to stop a note without lifting off the string.',
			'Let your plucking thumb move with your hand to keep the lower strings quiet.',
			'Play a simple line with long notes, then short ones, and hear how the feel changes.',
			'Match the note lengths to the kick drum of a song you know.'
		],
		mistakes: [
			'Letting open strings ring when you shift.',
			'Treating length as an afterthought. Decide it the way you decide the note.'
		],
		drills: [
			{
				title: 'Long and short',
				minutes: 3,
				how: 'Play a four-note line with every note held full value, then cut each one in half, then back again.'
			}
		]
	},
	{
		key: 'singles-and-doubles',
		title: 'Single and double strokes',
		instruments: ['drums'],
		goalBpm: 140,
		summary: 'Even hands at any volume, starting from the rudiments almost everything uses.',
		why: 'They are the base of fills and grooves, and they expose any difference between your hands.',
		steps: [
			'Start on a pad or snare at a comfortable tempo, with relaxed grip and rebound.',
			'Play singles and listen for the stronger hand. Aim to make both sound like one hand.',
			'Play doubles, making the second stroke as strong as the first by using the fingers.',
			'Move between singles and doubles without any change in spacing.'
		],
		mistakes: [
			'A weak second stroke in doubles, which turns them into a flam-like stumble.',
			'Squeezing the stick and fighting the rebound.'
		],
		drills: [
			{
				title: 'Singles ladder',
				minutes: 2,
				how: 'Single strokes in eighths, then triplets, then sixteenths, four bars each at a fixed tempo.'
			},
			{
				title: 'Doubles, slow to fast',
				minutes: 3,
				how: 'Double strokes at a tempo where every stroke is equal. Raise it by 4 BPM after three clean passes.'
			}
		]
	},
	{
		key: 'paradiddles',
		title: 'Paradiddles',
		instruments: ['drums'],
		goalBpm: 120,
		summary: 'A sticking that moves your lead hand and opens up the kit.',
		why: 'It changes which hand leads with no gap in the notes, so it turns straight into grooves and fills.',
		steps: [
			'Play the pattern slowly: right, left, right, right, then left, right, left, left.',
			'Accent the first note of each group and keep the others low.',
			'Move the accented notes to a tom or the rim while the rest stay on the snare.',
			'Put the right hand on the hi-hat and use it as a groove with the kick on 1 and 3.'
		],
		mistakes: [
			'Rushing the double at the end of each group.',
			'Letting the accents creep into the quiet notes.'
		],
		drills: [
			{
				title: 'Accented paradiddles',
				minutes: 3,
				how: 'Sixteenth-note paradiddles with an accent on each group of four. Keep the quiet notes low and even.'
			},
			{
				title: 'Paradiddle groove',
				minutes: 3,
				how: 'Right hand on hi-hat, left on snare with the backbeat accented, and kick on 1 and 3.'
			}
		]
	},
	{
		key: 'kick-independence',
		title: 'Kick independence',
		instruments: ['drums'],
		goalBpm: 110,
		summary: 'Keep a steady hat and snare while the kick pattern changes underneath.',
		why: 'It stops your limbs dragging each other around, which is what makes a groove sit.',
		steps: [
			'Lock in eighth notes on the hat and a backbeat on 2 and 4.',
			'Add the kick on 1 and 3, then move one kick at a time onto the offbeats.',
			'Stop whenever the hat stutters. That shows which kick placement to isolate.',
			'Repeat with the hat in quarter notes, then sixteenths.'
		],
		mistakes: [
			'Letting the hat follow the kick rhythm.',
			'Changing several things at once. Change one note per pass.'
		],
		drills: [
			{
				title: 'One moving kick',
				minutes: 4,
				how: 'Hold the groove and move a single kick through all eight eighth-note slots, four bars each.'
			}
		]
	},
	{
		key: 'finger-independence',
		title: 'Finger independence',
		instruments: ['keys'],
		goalBpm: 100,
		summary: 'Even touch and control in every finger, including the weaker fourth and fifth.',
		why: 'Fast passages and voiced chords both depend on fingers that can act separately.',
		steps: [
			'Sit with a relaxed wrist and curved fingers. Play a five-finger pattern, slowly and evenly.',
			'Hold down some notes silently while others play, starting with the thumb and little finger.',
			'Play the pattern with accents moved to a different finger each time.',
			'Do each hand alone, then together, then in contrary motion.'
		],
		mistakes: [
			'Lifting the wrist to help a weak finger.',
			'Practising only the stronger hand because it sounds better.'
		],
		drills: [
			{
				title: 'Moving accent',
				minutes: 3,
				how: 'Five-finger pattern up and down, accenting a different finger each pass, in each hand.'
			},
			{
				title: 'Held notes',
				minutes: 3,
				how: 'Hold fingers 1 and 5 down silently and play 2-3-4 in turn, then swap which fingers hold.'
			}
		]
	},
	{
		key: 'chord-inversions',
		title: 'Chord inversions',
		instruments: ['keys'],
		goalBpm: null,
		summary: 'Move between chords by the shortest path rather than jumping up the keyboard.',
		why: 'Good voice leading is what makes keys parts sit in a band instead of crowding it.',
		steps: [
			'Play a major triad in root position, first inversion and second inversion, up and down.',
			'Take a four-chord progression and play it keeping each note as close as possible to the last.',
			'Keep common notes held and move the others by step.',
			'Repeat in a key you find harder, without looking down if you can.'
		],
		mistakes: [
			'Playing every chord in root position, which makes parts jump around.',
			'Sitting in the same range as the guitar or the vocal.'
		],
		drills: [
			{
				title: 'Inversions up and down',
				minutes: 3,
				how: 'Every major and minor triad through its three inversions, one key per minute.'
			},
			{
				title: 'Smallest move',
				minutes: 3,
				how: 'Play a progression from a song you know with as little hand movement as possible between chords.'
			}
		]
	},
	{
		key: 'breath-support',
		title: 'Breath support',
		instruments: ['vocals'],
		goalBpm: null,
		summary: 'Steady airflow, so long phrases do not run out or tighten up.',
		why: 'Pitch, tone and stamina on a gig all improve when the breath is doing the work.',
		steps: [
			'Stand tall and breathe low, feeling your ribs and belly widen rather than your shoulders rising.',
			'Let air out on a steady "sss" and time how long it stays even.',
			'Move to a gentle hum, keeping the same steady flow.',
			'Sing a phrase from a song, planning where you will breathe before you start.'
		],
		mistakes: [
			'Lifting the shoulders to breathe in.',
			'Pushing harder on high notes instead of keeping the air steady. Stop if you feel any strain.'
		],
		drills: [
			{
				title: 'Timed sss',
				minutes: 2,
				how: 'Breathe low, then let out a steady "sss" as long as it stays even. Rest, and repeat three times.'
			},
			{
				title: 'Lip trills',
				minutes: 3,
				how: 'Trill your lips on a comfortable pitch, sliding up and down gently. It warms up without pressure.'
			}
		]
	},
	{
		key: 'pitch-matching',
		title: 'Pitch matching',
		instruments: ['vocals'],
		goalBpm: null,
		summary: 'Hear a note, then land on it first time, without sliding up to it.',
		why: 'Landing cleanly is what makes harmonies lock and melodies sound confident.',
		steps: [
			'Play a note on an instrument or a backing mix and listen before you sing it.',
			'Sing it softly on "oo", and hold it long enough to hear whether it matches.',
			'Move to scale steps and simple intervals, always hearing the note in your head first.',
			'Practise the harmony line of a song against the full mix, then against a mix without it.'
		],
		mistakes: [
			'Scooping up into each note.',
			'Singing too loudly to hear yourself against the reference.'
		],
		drills: [
			{
				title: 'Match and hold',
				minutes: 3,
				how: 'Play a note, hear it, sing it softly for four beats. Move by step through a comfortable range.'
			}
		]
	}
];

export function curatedFor(instrument: string | null): CuratedTechnique[] {
	if (!instrument || instrument === 'other') return CURATED_TECHNIQUES;
	return CURATED_TECHNIQUES.filter(
		(t) => t.instruments.length === 0 || t.instruments.includes(instrument as Instrument)
	);
}

export function curatedByKey(key: string | null): CuratedTechnique | null {
	return CURATED_TECHNIQUES.find((t) => t.key === key) ?? null;
}
