import { faker } from '@faker-js/faker';
import type { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { adminClient } from './supabase-admin';

const TRACK_FIXTURE = path.resolve('tests/fixtures/sample.wav');
const PDF_FIXTURE = path.resolve('tests/fixtures/sample.pdf');

/**
 * Create a song via admin API and navigate the browser to /songs.
 * Uses service-role client to bypass RLS.
 */
export async function createSong(page: Page, userId: string, overrides?: Record<string, unknown>) {
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
export async function createBand(page: Page, userId: string, overrides?: Record<string, unknown>) {
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
	if (memberError)
		throw new Error(`Factory createBand member insert failed: ${memberError.message}`);

	await page.goto(`/bands/${data.id}`);
	return data;
}

/**
 * Create a track folder via admin API (bypasses RLS and the RPC depth cap —
 * fixtures only). Does not navigate. Nest with overrides: { parent_id }.
 */
export async function createTrackFolder(
	bandId: string,
	userId: string,
	overrides?: Record<string, unknown>
) {
	const folder = {
		band_id: bandId,
		name: `${faker.word.adjective()} ${faker.word.noun()} ${faker.string.alphanumeric(4)}`,
		created_by: userId,
		...overrides
	};

	const { data, error } = await adminClient.from('track_folders').insert(folder).select().single();
	if (error) throw new Error(`Factory createTrackFolder failed: ${error.message}`);

	return data;
}

/**
 * Create a track with one version via admin API: uploads the audio fixture to
 * the 'tracks' storage bucket and inserts the tracks + track_versions rows.
 * Does not navigate. Storage objects don't cascade with DB rows — call
 * cleanupTrackAudio(bandId) in teardown. Place inside a folder with
 * overrides: { folder_id }.
 */
export async function createTrackData(
	bandId: string,
	userId: string,
	overrides?: Record<string, unknown>
) {
	const storagePath = `bands/${bandId}/tracks/${crypto.randomUUID()}.wav`;
	const fileBuffer = fs.readFileSync(TRACK_FIXTURE);

	const { error: uploadError } = await adminClient.storage
		.from('tracks')
		.upload(storagePath, fileBuffer, { contentType: 'audio/wav' });
	if (uploadError) throw new Error(`Factory createTrackData upload failed: ${uploadError.message}`);

	const track = {
		band_id: bandId,
		title: `${faker.word.adjective()} ${faker.word.noun()} demo`,
		created_by: userId,
		...overrides
	};

	const { data, error } = await adminClient.from('tracks').insert(track).select().single();
	if (error) throw new Error(`Factory createTrackData failed: ${error.message}`);

	const { data: version, error: versionError } = await adminClient
		.from('track_versions')
		.insert({
			track_id: data.id,
			version_number: 1,
			storage_path: storagePath,
			file_name: 'sample.wav',
			mime_type: 'audio/wav',
			file_size_bytes: fileBuffer.length,
			duration_seconds: 1,
			waveform_peaks: Array.from({ length: 100 }, (_, i) => Math.abs(Math.sin(i / 5))),
			uploaded_by: userId
		})
		.select()
		.single();
	if (versionError)
		throw new Error(`Factory createTrackData version failed: ${versionError.message}`);

	return { ...data, version };
}

/**
 * Create a song audio variant via admin API: uploads the audio fixture to the
 * private 'song-audio' storage bucket and inserts the song_audio row. Does
 * not navigate. Storage objects don't cascade with DB rows — call
 * cleanupSongAudio(songId) in teardown. Label with overrides: { label }.
 */
export async function createSongAudio(songId: string, overrides?: Record<string, unknown>) {
	const storagePath = `songs/${songId}/${crypto.randomUUID()}.wav`;
	const fileBuffer = fs.readFileSync(TRACK_FIXTURE);

	const { error: uploadError } = await adminClient.storage
		.from('song-audio')
		.upload(storagePath, fileBuffer, { contentType: 'audio/wav' });
	if (uploadError) throw new Error(`Factory createSongAudio upload failed: ${uploadError.message}`);

	const { data, error } = await adminClient
		.from('song_audio')
		.insert({
			song_id: songId,
			label: null,
			storage_path: storagePath,
			file_name: 'sample.wav',
			mime_type: 'audio/wav',
			file_size_bytes: fileBuffer.length,
			duration_seconds: 1,
			waveform_peaks: Array.from({ length: 100 }, (_, i) => Math.abs(Math.sin(i / 5))),
			...overrides
		})
		.select()
		.single();
	if (error) throw new Error(`Factory createSongAudio failed: ${error.message}`);

	return data;
}

/**
 * Create a song chart/tab via admin API: uploads the PDF fixture to the
 * private 'song-files' storage bucket and inserts the song_files row. Does
 * not navigate. Storage objects don't cascade with DB rows — call
 * cleanupSongFiles(songId) in teardown. Label with overrides: { label }.
 */
export async function createSongFile(songId: string, overrides?: Record<string, unknown>) {
	const storagePath = `songs/${songId}/${crypto.randomUUID()}.pdf`;
	const fileBuffer = fs.readFileSync(PDF_FIXTURE);

	const { error: uploadError } = await adminClient.storage
		.from('song-files')
		.upload(storagePath, fileBuffer, { contentType: 'application/pdf' });
	if (uploadError) throw new Error(`Factory createSongFile upload failed: ${uploadError.message}`);

	const { data, error } = await adminClient
		.from('song_files')
		.insert({
			song_id: songId,
			label: null,
			storage_path: storagePath,
			file_name: 'sample.pdf',
			mime_type: 'application/pdf',
			file_size_bytes: fileBuffer.length,
			...overrides
		})
		.select()
		.single();
	if (error) throw new Error(`Factory createSongFile failed: ${error.message}`);

	return data;
}

/**
 * Create a track via admin API and navigate the browser to its detail page.
 */
export async function createTrack(
	page: Page,
	bandId: string,
	userId: string,
	overrides?: Record<string, unknown>
) {
	const track = await createTrackData(bandId, userId, overrides);
	await page.goto(`/bands/${bandId}/demos/${track.id}`);
	return track;
}

/**
 * Create a track comment via admin API. Timestamped at 0.5s by default;
 * pass timestamp_seconds: null for a general comment.
 */
export async function createTrackComment(
	versionId: string,
	authorId: string,
	overrides?: Record<string, unknown>
) {
	const comment = {
		version_id: versionId,
		author_id: authorId,
		body: faker.lorem.sentence(),
		timestamp_seconds: 0.5,
		...overrides
	};

	const { data, error } = await adminClient
		.from('track_comments')
		.insert(comment)
		.select()
		.single();
	if (error) throw new Error(`Factory createTrackComment failed: ${error.message}`);

	return data;
}
