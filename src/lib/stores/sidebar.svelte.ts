/**
 * Sidebar behavior preference (Svelte 5 runes module).
 *
 * 'hover' is the historical default: a collapsed rail that expands on
 * hover/focus and overlays the content. 'expanded' pins the sidebar open
 * (pushing content), 'collapsed' pins it shut.
 */
import { browser } from '$app/environment';

export type SidebarMode = 'expanded' | 'collapsed' | 'hover';

const STORAGE_KEY = 'sidebar-mode';

export const sidebar = $state({ mode: 'hover' as SidebarMode });

let initialized = false;

/** Read the stored preference on the client (idempotent). */
export function initSidebar() {
	if (!browser || initialized) return;
	initialized = true;
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored === 'expanded' || stored === 'collapsed' || stored === 'hover') {
		sidebar.mode = stored;
	}
}

export function setSidebarMode(mode: SidebarMode) {
	sidebar.mode = mode;
	localStorage.setItem(STORAGE_KEY, mode);
}
