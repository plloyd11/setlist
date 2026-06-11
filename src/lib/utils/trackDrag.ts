/**
 * MIME keys identifying in-app drags on the tracks page. Custom types keep
 * OS file drags (the upload dropzone) and our card drags mutually invisible —
 * drop targets gate on these via dataTransfer.types, which is readable during
 * dragover (the payload itself is only readable on drop).
 */
export const TRACK_DRAG_TYPE = 'application/x-setlist-track';
export const FOLDER_DRAG_TYPE = 'application/x-setlist-folder';

export function isAppDrag(e: DragEvent): boolean {
	const types = e.dataTransfer?.types ?? [];
	return types.includes(TRACK_DRAG_TYPE) || types.includes(FOLDER_DRAG_TYPE);
}
