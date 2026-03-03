import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import { adminClient } from './supabase-admin';

/**
 * Create a song via admin API and navigate the browser to /songs.
 * Uses service-role client to bypass RLS.
 */
export async function createSong(
	page: Page,
	userId: string,
	overrides?: Record<string, unknown>
) {
	const song = {
		user_id: userId,
		title: faker.music.songName(),
		duration_seconds: faker.number.int({ min: 60, max: 600 }),
		notes: faker.lorem.sentence(),
		...overrides
	};

	const { data, error } = await adminClient.from('songs').insert(song).select().single();
	if (error) throw new Error(`Factory createSong failed: ${error.message}`);

	await page.goto('/songs');
	return data;
}

/**
 * Create a setlist via admin API and navigate the browser to the setlist page.
 * Uses service-role client to bypass RLS.
 */
export async function createSetlist(
	page: Page,
	userId: string,
	overrides?: Record<string, unknown>
) {
	const setlist = {
		user_id: userId,
		name: `${faker.word.adjective()} ${faker.word.noun()} Set`,
		gig_date: faker.date.future().toISOString().split('T')[0],
		venue: faker.location.city(),
		target_seconds: faker.number.int({ min: 1800, max: 7200 }),
		transition_seconds: faker.number.int({ min: 0, max: 30 }),
		...overrides
	};

	const { data, error } = await adminClient.from('setlists').insert(setlist).select().single();
	if (error) throw new Error(`Factory createSetlist failed: ${error.message}`);

	await page.goto(`/setlists/${data.id}`);
	return data;
}

/**
 * Create a band via admin API with the owner as first member, then navigate to the band page.
 * Uses service-role client to bypass RLS.
 */
export async function createBand(
	page: Page,
	userId: string,
	overrides?: Record<string, unknown>
) {
	const band = {
		owner_id: userId,
		name: `${faker.music.genre()} ${faker.animal.type()}s`,
		...overrides
	};

	const { data, error } = await adminClient.from('bands').insert(band).select().single();
	if (error) throw new Error(`Factory createBand failed: ${error.message}`);

	// Add owner as band member
	const { error: memberError } = await adminClient
		.from('band_members')
		.insert({ band_id: data.id, user_id: userId, role: 'owner' });
	if (memberError) throw new Error(`Factory createBand member insert failed: ${memberError.message}`);

	await page.goto(`/bands/${data.id}`);
	return data;
}
