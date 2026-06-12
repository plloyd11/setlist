import { browser } from '$app/environment';

// Variant choice is song-scoped, not setlist-scoped — "no guitar" is a
// property of how this user rehearses that song, wherever it appears.
// Shared by rehearse mode and the per-song practice page so a choice made
// in one carries over to the other.
const VARIANT_STORAGE_KEY = 'rehearse:variants';

export function loadVariantChoices(): Record<string, string> {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(VARIANT_STORAGE_KEY);
		if (raw) return JSON.parse(raw);
	} catch {
		// Corrupt/blocked storage just means no remembered choices
	}
	return {};
}

export function saveVariantChoices(choices: Record<string, string>) {
	if (!browser) return;
	try {
		localStorage.setItem(VARIANT_STORAGE_KEY, JSON.stringify(choices));
	} catch {
		// Quota/blocked storage — selection still applies for this session
	}
}

export function getRememberedVariant(songId: string): string | undefined {
	return loadVariantChoices()[songId];
}

export function rememberVariant(songId: string, variantId: string) {
	saveVariantChoices({ ...loadVariantChoices(), [songId]: variantId });
}
