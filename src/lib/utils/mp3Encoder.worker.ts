/**
 * Web Worker that encodes decoded PCM (Float32 channel data from an
 * AudioBuffer) to MP3 with lamejs. Encoding a multi-minute file is seconds of
 * pure CPU, so it runs off the main thread; the channel buffers arrive as
 * transferables to avoid copying tens of MB through structured clone.
 *
 * In:  { channels: Float32Array[] (1-2), sampleRate: number, kbps: number }
 * Out: { type: 'progress', percent: number }
 *    | { type: 'done', blob: Blob }
 *    | { type: 'error', message: string }
 */
import { Mp3Encoder } from '@breezystack/lamejs';

// lamejs consumes 1152-sample MP3 frames; batching many frames per call keeps
// the progress messages cheap relative to the encode work
const CHUNK_SAMPLES = 1152 * 64;

onmessage = (e: MessageEvent) => {
	const { channels, sampleRate, kbps } = e.data as {
		channels: Float32Array[];
		sampleRate: number;
		kbps: number;
	};

	try {
		const left = channels[0];
		const right = channels.length > 1 ? channels[1] : null;
		const encoder = new Mp3Encoder(right ? 2 : 1, sampleRate, kbps);
		// lamejs allocates from plain ArrayBuffers; the cast satisfies BlobPart
		const parts: Uint8Array<ArrayBuffer>[] = [];
		const leftChunk = new Int16Array(CHUNK_SAMPLES);
		const rightChunk = right ? new Int16Array(CHUNK_SAMPLES) : null;

		for (let offset = 0; offset < left.length; offset += CHUNK_SAMPLES) {
			const size = Math.min(CHUNK_SAMPLES, left.length - offset);
			toInt16(left, offset, size, leftChunk);
			if (right && rightChunk) toInt16(right, offset, size, rightChunk);
			const encoded = encoder.encodeBuffer(
				leftChunk.subarray(0, size),
				rightChunk?.subarray(0, size)
			);
			if (encoded.length > 0) parts.push(encoded as Uint8Array<ArrayBuffer>);
			postMessage({ type: 'progress', percent: ((offset + size) / left.length) * 100 });
		}

		const tail = encoder.flush();
		if (tail.length > 0) parts.push(tail as Uint8Array<ArrayBuffer>);
		postMessage({ type: 'done', blob: new Blob(parts, { type: 'audio/mpeg' }) });
	} catch (err) {
		postMessage({
			type: 'error',
			message: err instanceof Error ? err.message : 'Audio compression failed'
		});
	}
};

function toInt16(src: Float32Array, offset: number, size: number, out: Int16Array) {
	for (let i = 0; i < size; i++) {
		const s = Math.max(-1, Math.min(1, src[offset + i]));
		out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
	}
}
