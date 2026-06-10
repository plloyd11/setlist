/**
 * Client-side audio metadata extraction for track uploads.
 *
 * Peaks are computed once at upload time and stored on the version row so
 * listeners can render the waveform without downloading/decoding the full
 * audio file. Best-effort: decode failures degrade to a null result and the
 * player falls back to decoding the audio itself.
 */

const PEAK_BUCKETS = 1500;

export interface AudioMetadata {
	durationSeconds: number | null;
	peaks: number[] | null;
}

export async function extractAudioMetadata(file: File): Promise<AudioMetadata> {
	try {
		const arrayBuffer = await file.arrayBuffer();
		const ctx = new AudioContext();
		try {
			const buffer = await ctx.decodeAudioData(arrayBuffer);
			return { durationSeconds: buffer.duration, peaks: computePeaks(buffer) };
		} finally {
			void ctx.close();
		}
	} catch {
		// Codec not decodable by WebAudio (some AAC/ADTS variants) — an <audio>
		// element can often still read duration from metadata.
		return { durationSeconds: await durationFromElement(file), peaks: null };
	}
}

/** Max-abs downsample of channel 0 into PEAK_BUCKETS values normalized 0-1. */
function computePeaks(buffer: AudioBuffer): number[] | null {
	const samples = buffer.getChannelData(0);
	if (samples.length === 0) return null;

	const buckets = Math.min(PEAK_BUCKETS, samples.length);
	const bucketSize = samples.length / buckets;
	const peaks = new Array<number>(buckets);
	let max = 0;

	for (let i = 0; i < buckets; i++) {
		const start = Math.floor(i * bucketSize);
		const end = Math.min(Math.floor((i + 1) * bucketSize), samples.length);
		let peak = 0;
		for (let j = start; j < end; j++) {
			const abs = Math.abs(samples[j]);
			if (abs > peak) peak = abs;
		}
		peaks[i] = peak;
		if (peak > max) max = peak;
	}

	if (max === 0) return null;
	// Normalize so the waveform fills its height; 3 decimals keeps the stored
	// JSON ~10KB (well under the Netlify form-action body limit).
	for (let i = 0; i < buckets; i++) {
		peaks[i] = Math.round((peaks[i] / max) * 1000) / 1000;
	}
	return peaks;
}

function durationFromElement(file: File): Promise<number | null> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const audio = new Audio();
		audio.preload = 'metadata';
		audio.onloadedmetadata = () => {
			URL.revokeObjectURL(url);
			resolve(Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null);
		};
		audio.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(null);
		};
		audio.src = url;
	});
}
