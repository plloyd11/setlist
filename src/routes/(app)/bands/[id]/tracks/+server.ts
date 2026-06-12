import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// The band audio workspace moved from /tracks to /demos — keep old
// bookmarks and shared links working (preserves ?folder= etc.).
export const GET: RequestHandler = ({ params, url }) => {
	throw redirect(301, `/bands/${params.id}/demos${url.search}`);
};
