/**
 * Client-side pieces of the chart/tab upload flow (song_files). Shares the
 * generic signed-URL PUT with audioUpload.ts; validation here is
 * extension-based because Guitar Pro files have no registered MIME type —
 * browsers report them as empty or application/octet-stream.
 */

export const MAX_CHART_FILE_SIZE = 25 * 1024 * 1024; // matches the bucket file_size_limit

export const CHART_EXTENSIONS = ['pdf', 'doc', 'docx', 'gp', 'gp3', 'gp4', 'gp5', 'gpx'] as const;

export const CHART_ACCEPT = CHART_EXTENSIONS.map((ext) => `.${ext}`).join(',');

// Canonical content-type per extension — the browser-reported type is
// ignored; we set this explicitly on the signed-URL PUT so the bucket
// allowlist sees a value we control.
const EXT_MIME: Record<string, string> = {
	pdf: 'application/pdf',
	doc: 'application/msword',
	docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	gp: 'application/octet-stream',
	gp3: 'application/octet-stream',
	gp4: 'application/octet-stream',
	gp5: 'application/octet-stream',
	gpx: 'application/octet-stream'
};

export function resolveChartMimeType(f: File): string | null {
	const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
	return EXT_MIME[ext] ?? null;
}
