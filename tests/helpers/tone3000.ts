import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Route } from '@playwright/test';

/**
 * TONE3000, faked at the network for the rig's tests: its authorize page answers
 * straight back to the callback, as it does once someone picks a tone, and its API
 * serves the fixtures. Route it with `context.route(`${T3K}/**`, fake.handle)`.
 */

const IR_FIXTURE = path.resolve('tests/fixtures/sample.wav');
const MODEL_FIXTURE = path.resolve('tests/fixtures/sample.nam');

export const T3K = 'https://www.tone3000.com';
const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': '*',
	'access-control-allow-methods': '*'
};

/** Just enough of TONE3000: the Select flow, a tone of two A2 captures, and a cab IR */
export function fakeTone3000() {
	const tones = {
		'42': {
			id: 42,
			title: 'Plexi Test',
			url: `${T3K}/tones/plexi-test-42`,
			gear: 'amp',
			format: 'nam',
			license: 'cc-by',
			images: [],
			user: {
				username: 'testcreator',
				display_name: 'Test Creator',
				avatar_url: null,
				url: `${T3K}/testcreator`
			}
		},
		'77': {
			id: 77,
			title: 'V30 Test',
			url: `${T3K}/tones/v30-test-77`,
			gear: 'cab',
			format: 'ir',
			license: 'cco',
			images: null,
			user: { username: 'Cab Maker', display_name: null, avatar_url: null, url: `${T3K}/cabmaker` }
		}
	};
	const models = {
		'42': [
			{ id: 501, name: 'Crunch', size: 'standard', model_url: `${T3K}/api/v1/models/501/download` },
			{ id: 502, name: 'Lead', size: 'standard', model_url: `${T3K}/api/v1/models/502/download` }
		],
		'77': [
			{ id: 701, name: 'SM57', size: 'standard', model_url: `${T3K}/api/v1/models/701/download` }
		]
	};
	const files: Record<string, Buffer> = {
		'501': readFileSync(MODEL_FIXTURE),
		'502': readFileSync(MODEL_FIXTURE),
		'701': readFileSync(IR_FIXTURE)
	};

	const fake = {
		/** Leave the picker open, as if they're still browsing */
		holdPicker: false,
		authorized: [] as URLSearchParams[],
		tokenRequests: [] as URLSearchParams[],
		toneQueries: new Map<string, URLSearchParams>(),
		downloadAuth: [] as (string | undefined)[],
		handle: async (route: Route) => {
			const request = route.request();
			const url = new URL(request.url());
			if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

			if (url.pathname === '/api/v1/oauth/authorize') {
				fake.authorized.push(url.searchParams);
				if (fake.holdPicker) {
					return route.fulfill({ contentType: 'text/html', body: '<h1>TONE3000</h1>' });
				}
				const kind = url.searchParams.get('format');
				const back = new URL(url.searchParams.get('redirect_uri')!);
				back.searchParams.set('code', `code-${kind}`);
				back.searchParams.set('state', url.searchParams.get('state')!);
				back.searchParams.set('tone_id', kind === 'ir' ? '77' : '42');
				return route.fulfill({ status: 302, headers: { location: back.toString() } });
			}
			if (url.pathname === '/api/v1/oauth/token') {
				fake.tokenRequests.push(new URLSearchParams(request.postData() ?? ''));
				return route.fulfill({
					headers: CORS,
					json: {
						access_token: 'access-1',
						refresh_token: 'refresh-1',
						token_type: 'bearer',
						expires_in: 3600,
						scope: 'read'
					}
				});
			}
			const tone = url.pathname.match(/^\/api\/v1\/tones\/(\d+)$/)?.[1];
			if (tone && tone in tones) {
				return route.fulfill({ headers: CORS, json: tones[tone as keyof typeof tones] });
			}
			if (url.pathname === '/api/v1/models') {
				fake.toneQueries.set(url.pathname, url.searchParams);
				const list = models[url.searchParams.get('tone_id') as keyof typeof models] ?? [];
				return route.fulfill({
					headers: CORS,
					json: { data: list, page: 1, page_size: 100, total: list.length, total_pages: 1 }
				});
			}
			const download = url.pathname.match(/^\/api\/v1\/models\/(\d+)\/download$/)?.[1];
			if (download && files[download]) {
				fake.downloadAuth.push((await request.headerValue('authorization')) ?? undefined);
				return route.fulfill({ headers: CORS, body: files[download] });
			}
			return route.fulfill({ status: 404, headers: CORS, json: { error: 'not_found' } });
		}
	};
	return fake;
}
