/**
 * Client-side audio compression for uploads.
 *
 * The audio buckets cap files at 50MB, and uploads are direct-to-storage
 * (Netlify's function body limit rules out proxying), so there is no server
 * hop where transcoding could happen — big files must shrink in the browser
 * before the PUT. Lossless formats (WAV/AIFF/FLAC) are always re-encoded to
 * MP3 (FLAC/AIFF aren't even on the bucket MIME allowlists); already-lossy
 * files are re-encoded only when they exceed the bucket limit. Encoding runs
 * in a Web Worker (mp3Encoder.worker.ts) on the AudioBuffer the upload flow
 * already decoded for waveform peaks.
 */
import { MAX_AUDIO_FILE_SIZE, fileExt } from './audioUpload';

export const MP3_BITRATE_KBPS = 192;

/** Pre-compression cap. 250MB of PCM is ~24 min of CD-quality stereo, which
 * encodes to ~34MB at 192kbps — comfortably under the 50MB bucket limit —
 * while keeping the decoded Float32 data small enough to hold in memory. */
export const MAX_SOURCE_FILE_SIZE = 250 * 1024 * 1024;

const LOSSLESS_EXTS = new Set(['wav', 'aiff', 'aif', 'flac']);
const LOSSLESS_MIMES = new Set([
	'audio/wav',
	'audio/x-wav',
	'audio/wave',
	'audio/flac',
	'audio/x-flac',
	'audio/aiff',
	'audio/x-aiff'
]);

export function isLosslessAudio(f: File): boolean {
	return LOSSLESS_EXTS.has(fileExt(f)) || LOSSLESS_MIMES.has(f.type);
}

/** Lossless is always worth shrinking; lossy only when it can't fit the bucket. */
export function needsCompression(f: File): boolean {
	return isLosslessAudio(f) || f.size > MAX_AUDIO_FILE_SIZE;
}

export function mp3FileName(originalName: string): string {
	const base = originalName.replace(/\.[^.]+$/, '');
	return `${base || originalName}.mp3`;
}

// MPEG1 Layer III rates — the only ones valid at 192kbps. Device contexts are
// effectively always 44.1/48kHz, so the resample fallback is rarely taken.
const MPEG1_SAMPLE_RATES = new Set([32000, 44100, 48000]);

/**
 * Encode an AudioBuffer to a 192kbps MP3 Blob in a Web Worker. Channels
 * beyond stereo are dropped. Abort via `signal` terminates the worker.
 */
export async function compressToMp3(
	buffer: AudioBuffer,
	{ onprogress, signal }: { onprogress?: (percent: number) => void; signal?: AbortSignal } = {}
): Promise<Blob> {
	const source = MPEG1_SAMPLE_RATES.has(buffer.sampleRate) ? buffer : await resampleTo44100(buffer);

	// Copy the channel data: transferring an AudioBuffer's own backing stores
	// detaches them (and some engines refuse), so slice and transfer the copies
	const channels: Float32Array[] = [];
	for (let c = 0; c < Math.min(source.numberOfChannels, 2); c++) {
		channels.push(source.getChannelData(c).slice());
	}

	return new Promise<Blob>((resolve, reject) => {
		const worker = new Worker(new URL('./mp3Encoder.worker.ts', import.meta.url), {
			type: 'module'
		});
		const fail = (err: Error) => {
			worker.terminate();
			reject(err);
		};
		signal?.addEventListener('abort', () => fail(new DOMException('Cancelled', 'AbortError')));
		worker.onerror = () => fail(new Error('Audio compression failed'));
		worker.onmessage = (e: MessageEvent) => {
			const msg = e.data as
				| { type: 'progress'; percent: number }
				| { type: 'done'; blob: Blob }
				| { type: 'error'; message: string };
			if (msg.type === 'progress') {
				onprogress?.(msg.percent);
			} else if (msg.type === 'done') {
				worker.terminate();
				resolve(msg.blob);
			} else {
				fail(new Error(msg.message || 'Audio compression failed'));
			}
		};
		worker.postMessage(
			{ channels, sampleRate: source.sampleRate, kbps: MP3_BITRATE_KBPS },
			channels.map((c) => c.buffer)
		);
	});
}

function resampleTo44100(buffer: AudioBuffer): Promise<AudioBuffer> {
	const ctx = new OfflineAudioContext(
		Math.min(buffer.numberOfChannels, 2),
		Math.ceil(buffer.duration * 44100),
		44100
	);
	const src = ctx.createBufferSource();
	src.buffer = buffer;
	src.connect(ctx.destination);
	src.start();
	return ctx.startRendering();
}
