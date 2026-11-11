import { HIGH_CUT, LOW_CUT, type RigMode } from './rig.svelte.js';

/** How the rig's readings are written, the same in the practice panel and on the Rig page */

export const MODE_LABELS: Record<RigMode, string> = { amp: 'Real amp', nam: 'NAM' };

/** The meters run from here up to 0 dBFS */
export const METER_FLOOR_DB = -60;

export function formatDb(db: number): string {
	return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
}

export function formatLowCut(hz: number): string {
	return hz <= LOW_CUT.min ? 'Off' : `${Math.round(hz)} Hz`;
}

export function formatHighCut(hz: number): string {
	return hz >= HIGH_CUT.max ? 'Off' : `${(hz / 1000).toFixed(1)} kHz`;
}

export function formatLevel(level: number): string {
	return `${Math.round(level * 100)}%`;
}

/** First IR's share, then the second's: "70 / 30" leans on the first */
export function formatBlend(blend: number): string {
	const second = Math.round(blend * 100);
	return `${100 - second} / ${second}`;
}

export function formatSampleRate(hz: number): string {
	return `${Number((hz / 1000).toFixed(1))} kHz`;
}

export function formatFileSize(bytes: number): string {
	if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
	return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** Where a level sits along a meter, 0 to 100 */
export function meterPercent(db: number): number {
	if (!Number.isFinite(db)) return 0;
	return Math.min(100, Math.max(0, ((db - METER_FLOOR_DB) / -METER_FLOOR_DB) * 100));
}
