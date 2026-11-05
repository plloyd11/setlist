import { PUBLIC_TONE3000_CLIENT_ID } from '$app/env/public';

/**
 * TONE3000 (tone3000.com), the big library of NAM captures and IRs, through its Select
 * flow: the musician browses and picks in TONE3000's own window, and gets back the
 * tone they picked. OAuth with PKCE, entirely in the browser. The publishable key is
 * public by design, and the tokens stay in memory only as long as the pick does.
 *
 * API: https://www.tone3000.com/api. Its terms ask for "Powered by TONE3000", creator
 * names and licenses kept with every file, and downloads only when someone asks.
 */

export const T3K_ORIGIN = 'https://www.tone3000.com';
/** Where TONE3000 sends the window back to: register it with the key */
export const T3K_CALLBACK_PATH = '/auth/tone3000';
/** How the callback page reaches the page that opened it */
export const T3K_MESSAGE = 'setlist:tone3000-callback';
/** For when the browser cut the window's tie to its opener on the way */
export const T3K_CHANNEL = 'setlist-tone3000';

export const tone3000Enabled = !!PUBLIC_TONE3000_CLIENT_ID;

/** What's being browsed: NAM captures (A2 only) or cab IRs */
export type T3kKind = 'nam' | 'ir';

export interface T3kUser {
	username: string;
	/** Set only for verified creators */
	display_name: string | null;
	avatar_url: string | null;
	url: string;
}

export interface T3kTone {
	id: number;
	title: string;
	url: string;
	gear: string;
	format: string;
	license: string;
	images: string[] | null;
	user: T3kUser;
}

export interface T3kModel {
	id: number;
	name: string;
	model_url: string;
	size: string;
}

export interface T3kCallback {
	code: string | null;
	state: string | null;
	error: string | null;
	toneId: string | null;
	canceled: boolean;
}

export class Tone3000Error extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'Tone3000Error';
	}
}

const GEAR_LABELS: Record<string, string> = {
	amp: 'Amp head',
	'amp-cab': 'Amp + cab',
	'full-rig': 'Amp + cab',
	pedal: 'Pedal',
	outboard: 'Outboard',
	cab: 'Cab',
	space: 'Space',
	experimental: 'Experimental'
};

const FORMAT_LABELS: Record<string, string> = { nam: 'NAM', ir: 'IR' };

const LICENSE_LABELS: Record<string, string> = {
	t3k: 'TONE3000 license',
	'cc-by': 'CC BY',
	'cc-by-sa': 'CC BY-SA',
	'cc-by-nc': 'CC BY-NC',
	'cc-by-nc-sa': 'CC BY-NC-SA',
	'cc-by-nd': 'CC BY-ND',
	'cc-by-nc-nd': 'CC BY-NC-ND',
	cco: 'CC0'
};

export const gearLabel = (gear: string) => GEAR_LABELS[gear] ?? gear;
export const formatLabel = (format: string) => FORMAT_LABELS[format] ?? format;
export const licenseLabel = (license: string) => LICENSE_LABELS[license] ?? license;

/** Verified creators have a display name; everyone has a username */
export const creatorName = (user: T3kUser) => user.display_name || user.username;

/** Links and pictures from the API are only used if they're https */
export function httpsUrl(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	try {
		return new URL(value).protocol === 'https:' ? value : null;
	} catch {
		return null;
	}
}

function base64url(bytes: Uint8Array): string {
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function randomString(bytes: number): string {
	return base64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function challengeFor(verifier: string): Promise<string> {
	const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return base64url(new Uint8Array(hash));
}

export function redirectUri(): string {
	return `${location.origin}${T3K_CALLBACK_PATH}`;
}

/** What TONE3000 sent the window back with, or null if this isn't a callback */
export function readCallback(url: URL): T3kCallback | null {
	const params = url.searchParams;
	const canceled = params.get('canceled') === 'true';
	if (!params.has('code') && !params.has('error') && !canceled) return null;
	return {
		code: params.get('code'),
		state: params.get('state'),
		error: params.get('error'),
		toneId: params.get('tone_id'),
		canceled
	};
}

function catalogParams(kind: T3kKind): Record<string, string> {
	return kind === 'nam'
		? // A2 captures only: the newer, slimmable architecture
			{ format: 'nam', architecture: '2' }
		: { format: 'ir', gears: 'cab' };
}

function authorizeUrl(kind: T3kKind, challenge: string, state: string): string {
	const url = new URL('/api/v1/oauth/authorize', T3K_ORIGIN);
	const params: Record<string, string> = {
		client_id: PUBLIC_TONE3000_CLIENT_ID ?? '',
		redirect_uri: redirectUri(),
		response_type: 'code',
		code_challenge: challenge,
		code_challenge_method: 'S256',
		state,
		prompt: 'select_tone',
		// Lets them hear a tone before picking it, and close the window from inside
		preview: 'true',
		menubar: 'true',
		...catalogParams(kind)
	};
	for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
	return url.toString();
}

function openWindow(): Window | null {
	const width = 480;
	const height = 720;
	const left = Math.round(window.screenX + (window.outerWidth - width) / 2);
	const top = Math.round(window.screenY + (window.outerHeight - height) / 2);
	return window.open(
		'',
		'tone3000',
		`popup,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
	);
}

interface Tokens {
	access: string;
	refresh: string;
	/** ms since the epoch */
	expiresAt: number;
}

async function requestTokens(body: Record<string, string>): Promise<Tokens> {
	const res = await fetch(`${T3K_ORIGIN}/api/v1/oauth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ ...body, client_id: PUBLIC_TONE3000_CLIENT_ID ?? '' })
	});
	if (!res.ok) throw new Tone3000Error("Couldn't sign in to TONE3000. Try again.");
	const data = (await res.json()) as {
		access_token: string;
		refresh_token: string;
		expires_in: number;
	};
	return {
		access: data.access_token,
		refresh: data.refresh_token,
		expiresAt: Date.now() + data.expires_in * 1000
	};
}

/** Signed-in calls to TONE3000, for one pick's worth of browsing and downloading */
export class T3kSession {
	#tokens: Tokens;
	#refreshing: Promise<Tokens> | null = null;

	constructor(tokens: Tokens) {
		this.#tokens = tokens;
	}

	async #refresh(): Promise<string> {
		this.#refreshing ??= requestTokens({
			grant_type: 'refresh_token',
			refresh_token: this.#tokens.refresh
		})
			.catch(() => {
				throw new Tone3000Error('TONE3000 signed you out. Browse again to carry on.');
			})
			.finally(() => {
				this.#refreshing = null;
			});
		this.#tokens = await this.#refreshing;
		return this.#tokens.access;
	}

	async #token(): Promise<string> {
		// A minute's margin, so a token can't run out mid-download
		return Date.now() > this.#tokens.expiresAt - 60_000 ? this.#refresh() : this.#tokens.access;
	}

	/** Paths only: whatever the API hands back, the token goes nowhere but TONE3000 */
	async #fetch(path: string): Promise<Response> {
		const url = `${T3K_ORIGIN}${path}`;
		let res = await fetch(url, { headers: { Authorization: `Bearer ${await this.#token()}` } });
		if (res.status === 401) {
			res = await fetch(url, { headers: { Authorization: `Bearer ${await this.#refresh()}` } });
		}
		if (res.status === 429) throw new Tone3000Error('TONE3000 is busy. Try again in a minute.');
		if (!res.ok) throw new Tone3000Error("Couldn't get that from TONE3000. Try again.");
		return res;
	}

	async tone(id: string, kind: T3kKind): Promise<T3kTone> {
		const query = kind === 'nam' ? '?architecture=2' : '';
		const res = await this.#fetch(`/api/v1/tones/${encodeURIComponent(id)}${query}`);
		return (await res.json()) as T3kTone;
	}

	async models(toneId: string, kind: T3kKind): Promise<T3kModel[]> {
		const query = new URLSearchParams({ tone_id: toneId, page_size: '100' });
		if (kind === 'nam') query.set('architecture', '2');
		const res = await this.#fetch(`/api/v1/models?${query}`);
		return ((await res.json()) as { data: T3kModel[] }).data;
	}

	async file(model: T3kModel): Promise<ArrayBuffer> {
		const url = new URL(model.model_url, T3K_ORIGIN);
		const res = await this.#fetch(url.pathname + url.search);
		return res.arrayBuffer();
	}
}

/**
 * Opens TONE3000's picker in its own window and waits for the pick. Call it straight
 * from a click: the window opens before anything is awaited, so it isn't blocked.
 *
 * Resolves with the picked tone and a session to fetch it with, or null when the
 * window is closed (or the signal aborts) without a pick. `onReturn` fires the moment
 * the window comes back, before the sign-in finishes, so the UI can show it's loading.
 */
export function selectTone(
	kind: T3kKind,
	signal: AbortSignal,
	onReturn: () => void
): Promise<{ session: T3kSession; toneId: string } | null> {
	const popup = openWindow();
	if (!popup) {
		return Promise.reject(
			new Tone3000Error(
				'The TONE3000 window was blocked. Allow pop-ups for this site, then try again.'
			)
		);
	}

	const verifier = randomString(32);
	const state = randomString(16);
	void challengeFor(verifier).then((challenge) => {
		if (!popup.closed) popup.location.href = authorizeUrl(kind, challenge, state);
	});

	return new Promise((resolve, reject) => {
		const channel = new BroadcastChannel(T3K_CHANNEL);
		let returned = false;
		let watch: ReturnType<typeof setInterval> | undefined;

		const finish = () => {
			window.removeEventListener('message', onMessage);
			channel.close();
			clearInterval(watch);
			signal.removeEventListener('abort', onAbort);
		};

		const onCallback = async (data: unknown) => {
			const callback = data as (T3kCallback & { type?: string }) | null;
			// Only this pick's answer counts: the state is the proof
			if (returned || callback?.type !== T3K_MESSAGE || callback.state !== state) return;
			returned = true;
			finish();
			onReturn();
			if (callback.error) {
				reject(
					new Tone3000Error(
						callback.error === 'access_denied'
							? 'TONE3000 access was declined.'
							: "TONE3000 couldn't connect. Try again."
					)
				);
				return;
			}
			// Signed in, then closed without picking
			if (!callback.code || !callback.toneId) {
				resolve(null);
				return;
			}
			try {
				const tokens = await requestTokens({
					grant_type: 'authorization_code',
					code: callback.code,
					code_verifier: verifier,
					redirect_uri: redirectUri()
				});
				resolve({ session: new T3kSession(tokens), toneId: callback.toneId });
			} catch (e) {
				reject(e);
			}
		};

		const onMessage = (event: MessageEvent) => {
			if (event.origin === location.origin) void onCallback(event.data);
		};

		const onAbort = () => {
			finish();
			popup.close();
			resolve(null);
		};

		window.addEventListener('message', onMessage);
		channel.onmessage = (event) => void onCallback(event.data);
		signal.addEventListener('abort', onAbort);
		// Closed by hand: give a message already on its way a moment to land
		watch = setInterval(() => {
			if (!popup.closed || returned) return;
			clearInterval(watch);
			setTimeout(() => {
				if (returned) return;
				finish();
				resolve(null);
			}, 500);
		}, 400);
	});
}
