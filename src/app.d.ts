import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			supabase: SupabaseClient;
			safeGetSession(): Promise<{ session: Session | null; user: User | null }>;
		}
		interface PageData {
			session: Session | null;
			user: User | null;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

declare module 'svelte/elements' {
	interface HTMLAttributes<T extends EventTarget> {
		// Dispatched by the `longpress` action ($lib/actions/longpress)
		onlongpress?: (e: CustomEvent<{ x: number; y: number }>) => void;
	}
}

export {};
