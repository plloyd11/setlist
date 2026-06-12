import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ params, url }) => {
	throw redirect(301, `/bands/${params.id}/demos/${params.trackId}${url.search}`);
};
