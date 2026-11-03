import http from 'node:http';
import type { Page } from '@playwright/test';

export function makeWav(seconds: number, sampleRate = 8000): Buffer {
	const numSamples = seconds * sampleRate;
	const dataSize = numSamples * 2;
	const buf = Buffer.alloc(44 + dataSize);
	buf.write('RIFF', 0);
	buf.writeUInt32LE(36 + dataSize, 4);
	buf.write('WAVE', 8);
	buf.write('fmt ', 12);
	buf.writeUInt32LE(16, 16);
	buf.writeUInt16LE(1, 20);
	buf.writeUInt16LE(1, 22);
	buf.writeUInt32LE(sampleRate, 24);
	buf.writeUInt32LE(sampleRate * 2, 28);
	buf.writeUInt16LE(2, 32);
	buf.writeUInt16LE(16, 34);
	buf.write('data', 36);
	buf.writeUInt32LE(dataSize, 40);
	for (let i = 0; i < numSamples; i++) {
		buf.writeInt16LE(Math.round(Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 8000), 44 + i * 2);
	}
	return buf;
}

export function serveWav(wav: Buffer): Promise<{ port: number; close: () => void }> {
	return new Promise((resolve) => {
		const server = http
			.createServer((req, res) => {
				const m = req.headers.range ? /bytes=(\d+)-(\d*)/.exec(req.headers.range) : null;
				if (m) {
					const start = parseInt(m[1], 10);
					const end = m[2] ? parseInt(m[2], 10) : wav.length - 1;
					res.writeHead(206, {
						'Content-Type': 'audio/wav',
						'Content-Range': `bytes ${start}-${end}/${wav.length}`,
						'Accept-Ranges': 'bytes',
						'Content-Length': end - start + 1
					});
					res.end(wav.subarray(start, end + 1));
				} else {
					res.writeHead(200, {
						'Content-Type': 'audio/wav',
						'Accept-Ranges': 'bytes',
						'Content-Length': wav.length
					});
					res.end(wav);
				}
			})
			.listen(0, () => {
				const address = server.address();
				const port = typeof address === 'object' && address ? address.port : 0;
				resolve({ port, close: () => server.close() });
			});
	});
}

/**
 * Point the media element at the local server while reporting the original signed
 * URL back, so wavesurfer's "same URL, no need to reload" check behaves as it does
 * in production. Chromium aborts media requests under Playwright interception, so
 * this has to happen in-page.
 */
export async function serveSongAudioLocally(page: Page, port: number) {
	await page.addInitScript(
		({ port }) => {
			const proto = HTMLMediaElement.prototype;
			const src = Object.getOwnPropertyDescriptor(proto, 'src')!;
			const currentSrc = Object.getOwnPropertyDescriptor(proto, 'currentSrc')!;
			const signed = new WeakMap<HTMLMediaElement, string>();
			const reported = (el: HTMLMediaElement) =>
				el.hasAttribute('src') ? signed.get(el) : undefined;
			Object.defineProperty(proto, 'src', {
				configurable: true,
				get(this: HTMLMediaElement) {
					return reported(this) ?? src.get!.call(this);
				},
				set(this: HTMLMediaElement, value: string) {
					if (value.includes('/storage/v1/object/sign/song-audio/')) {
						signed.set(this, value);
						src.set!.call(this, `http://localhost:${port}/audio.wav`);
					} else {
						signed.delete(this);
						src.set!.call(this, value);
					}
				}
			});
			Object.defineProperty(proto, 'currentSrc', {
				configurable: true,
				get(this: HTMLMediaElement) {
					return reported(this) ?? currentSrc.get!.call(this);
				}
			});
		},
		{ port }
	);
}

/** Waveform peaks for a generated variant, so the player needn't decode the file */
export const FAKE_PEAKS = Array.from({ length: 100 }, (_, i) => Math.abs(Math.sin(i / 5)));
