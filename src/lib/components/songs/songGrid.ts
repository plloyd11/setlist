/**
 * The song library's columns, shared by the header and every row so they line up:
 * title, attachments, added (wider screens), length. A literal, so Tailwind sees it.
 */
export const SONG_GRID =
	'grid grid-cols-[minmax(0,1fr)_4rem_3.25rem] items-center gap-x-3 sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem_3.5rem] sm:gap-x-6';
