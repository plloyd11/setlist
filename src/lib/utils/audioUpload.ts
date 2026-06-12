/**
 * Shared pieces of the client-side direct-to-storage audio upload flow,
 * used by both the band track uploader and the song audio manager.
 */

export const MAX_AUDIO_FILE_SIZE = 50 * 1024 * 1024; // matches the bucket file_size_limit

// Accepted *input* types. Lossless formats (wav/aiff/flac) never reach the
// bucket as-is — they're transcoded to MP3 client-side first (audioCompress.ts),
// which is also why flac/aiff can be accepted despite missing from the bucket
// MIME allowlists.
export const ACCEPTED_AUDIO_TYPES = [
	'audio/mpeg',
	'audio/mp4',
	'audio/x-m4a',
	'audio/m4a',
	'audio/aac',
	'audio/wav',
	'audio/x-wav',
	'audio/wave',
	'audio/ogg',
	'audio/flac',
	'audio/x-flac',
	'audio/aiff',
	'audio/x-aiff'
];

// Browsers sometimes report no/odd MIME types for m4a — fall back to extension
const EXT_MIME: Record<string, string> = {
	mp3: 'audio/mpeg',
	m4a: 'audio/mp4',
	aac: 'audio/aac',
	wav: 'audio/wav',
	ogg: 'audio/ogg',
	flac: 'audio/flac',
	aiff: 'audio/aiff',
	aif: 'audio/aiff'
};

export function fileExt(f: File): string {
	return f.name.split('.').pop()?.toLowerCase() ?? '';
}

export function resolveAudioMimeType(f: File): string | null {
	if (ACCEPTED_AUDIO_TYPES.includes(f.type)) return f.type;
	return EXT_MIME[fileExt(f)] ?? null;
}

/**
 * PUT a file to a signed upload URL with progress reporting. `onxhr` hands
 * the caller the live request so it can abort() on user cancel.
 */
export function putWithProgress(
	url: string,
	f: File,
	contentType: string,
	{
		onprogress,
		onxhr
	}: { onprogress?: (percent: number) => void; onxhr?: (xhr: XMLHttpRequest) => void } = {}
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		onxhr?.(xhr);
		xhr.open('PUT', url);
		xhr.setRequestHeader('content-type', contentType);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onprogress?.((e.loaded / e.total) * 100);
		};
		xhr.onload = () =>
			xhr.status >= 200 && xhr.status < 300
				? resolve()
				: reject(new Error(`Upload failed (${xhr.status})`));
		xhr.onerror = () => reject(new Error('Upload failed'));
		xhr.onabort = () => reject(new Error('Upload cancelled'));
		xhr.send(f);
	});
}
