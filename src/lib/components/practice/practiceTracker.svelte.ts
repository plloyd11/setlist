import { browser } from '$app/env';

const STORE_PREFIX = 'practice:session:v1:';
/** A gap this long means the next thing you practice is a new session */
const NEW_SESSION_AFTER_MS = 30 * 60 * 1000;
/** Opening a page and leaving isn't practice */
const MIN_SECONDS_TO_SAVE = 30;
/** Forgot it was running: stop counting, unless audio or the metronome is going */
const IDLE_PAUSE_MS = 10 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;
const JOURNAL_MS = 5 * 1000;
/** A larger jump is a laptop waking up, not practice */
const MAX_TICK_SECONDS = 5;
const MAX_UNSENT = 5;

export interface PracticeItemRef {
	kind: 'song' | 'exercise' | 'skill';
	/** Null when there's nothing to link to */
	refId: string | null;
	label: string;
}

interface StoredItem {
	id: string;
	kind: PracticeItemRef['kind'];
	ref_id: string | null;
	label: string;
	practice_seconds: number;
	run_seconds: number | null;
	run_source: 'audio' | 'stopwatch' | null;
	length_before_apply: number | null;
	note: string | null;
}

interface StoredSession {
	id: string;
	started_at: string;
	last_active_at: string;
	items: Record<string, StoredItem>;
	dirty: boolean;
}

interface Store {
	current: StoredSession | null;
	/** Finished sessions that never reached the server: a closed tab or a dead phone */
	unsent: StoredSession[];
}

function worthSaving(session: StoredSession): boolean {
	const items = Object.values(session.items);
	return (
		items.some((item) => item.run_seconds || item.note) ||
		items.reduce((sum, item) => sum + item.practice_seconds, 0) >= MIN_SECONDS_TO_SAVE
	);
}

/** Only a real JSON success counts: an expired login redirects to a page that's "ok" too */
async function send(session: StoredSession, keepalive = false): Promise<boolean> {
	try {
		const response = await fetch('/practice/session', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			keepalive,
			body: JSON.stringify({
				session: {
					id: session.id,
					started_at: session.started_at,
					last_active_at: session.last_active_at
				},
				items: Object.values(session.items)
			})
		});
		return response.ok && (await response.json()).saved === true;
	} catch {
		return false;
	}
}

/**
 * Counts time on one thing you're practicing and gets it to the database, even if the
 * tab closes or the phone dies. Everything is journaled to localStorage first, and
 * sends carry running totals under stable ids, so a replay can't double-count. Sessions
 * span screens: moving from a warm-up to a song within 30 minutes is one session.
 */
export class PracticeTracker {
	/** Seconds on this item in this session, including earlier visits */
	seconds = $state(0);
	paused = $state(false);

	#storeKey: string;
	#ref: PracticeItemRef;
	#isBusy: () => boolean;
	#store: Store = { current: null, unsent: [] };
	#item: StoredItem | null = null;
	#lastTick = 0;
	#lastActivity = 0;
	#lastJournal = 0;
	#lastSend = 0;
	#sending = false;
	#interval: ReturnType<typeof setInterval> | null = null;

	constructor(userId: string, ref: PracticeItemRef, isBusy: () => boolean = () => false) {
		this.#storeKey = STORE_PREFIX + userId;
		this.#ref = ref;
		this.#isBusy = isBusy;
	}

	start() {
		if (!browser || this.#interval) return;
		this.#read();
		this.#rollOverIfStale();
		this.#ensureItem();
		void this.#replay();

		this.#lastTick = this.#lastActivity = this.#lastJournal = this.#lastSend = Date.now();
		this.#interval = setInterval(() => this.#tick(), 1000);
		document.addEventListener('visibilitychange', this.#handleVisibility);
		window.addEventListener('pagehide', this.#handleLeave);
		window.addEventListener('pointerdown', this.#handleActivity, { passive: true });
		window.addEventListener('keydown', this.#handleActivity, { passive: true });
	}

	stop() {
		if (!this.#interval) return;
		clearInterval(this.#interval);
		this.#interval = null;
		document.removeEventListener('visibilitychange', this.#handleVisibility);
		window.removeEventListener('pagehide', this.#handleLeave);
		window.removeEventListener('pointerdown', this.#handleActivity);
		window.removeEventListener('keydown', this.#handleActivity);
		this.#write();
		void this.#flush(true);
	}

	togglePause() {
		this.paused = !this.paused;
		this.#lastActivity = Date.now();
	}

	/** Record a timed full run of this item */
	setRun(seconds: number, source: 'audio' | 'stopwatch') {
		if (!this.#item || !this.#store.current) return;
		this.#item.run_seconds = Math.max(1, Math.round(seconds));
		this.#item.run_source = source;
		this.#store.current.dirty = true;
		this.#write();
	}

	/** Record that a measured run replaced a length, so it can be undone from history */
	setLengthApplied(previousSeconds: number) {
		if (!this.#item || !this.#store.current) return;
		this.#item.length_before_apply = previousSeconds;
		this.#store.current.dirty = true;
		this.#write();
		void this.#flush();
	}

	#handleActivity = () => {
		this.#lastActivity = Date.now();
		if (this.paused && this.#autoPaused) {
			this.paused = false;
			this.#autoPaused = false;
		}
	};
	#autoPaused = false;

	#handleVisibility = () => {
		if (document.visibilityState === 'hidden') {
			this.#handleLeave();
		} else {
			this.#lastTick = Date.now();
		}
	};

	#handleLeave = () => {
		this.#write();
		void this.#flush(true);
	};

	#tick() {
		const now = Date.now();
		const elapsed = Math.min((now - this.#lastTick) / 1000, MAX_TICK_SECONDS);
		this.#lastTick = now;

		if (!this.paused && now - this.#lastActivity > IDLE_PAUSE_MS && !this.#isBusy()) {
			this.paused = true;
			this.#autoPaused = true;
		}
		if (this.#isBusy()) this.#lastActivity = now;

		if (!this.paused && document.visibilityState === 'visible' && this.#item) {
			this.seconds += elapsed;
			this.#item.practice_seconds = Math.round(this.seconds);
			const session = this.#store.current!;
			session.last_active_at = new Date(now).toISOString();
			session.dirty = true;
		}

		if (now - this.#lastJournal >= JOURNAL_MS) {
			this.#lastJournal = now;
			this.#write();
		}
		if (now - this.#lastSend >= HEARTBEAT_MS) {
			this.#lastSend = now;
			void this.#flush();
		}
	}

	#read() {
		try {
			const raw = JSON.parse(localStorage.getItem(this.#storeKey) ?? 'null');
			if (raw && typeof raw === 'object') {
				this.#store = {
					current: raw.current ?? null,
					unsent: Array.isArray(raw.unsent) ? raw.unsent : []
				};
			}
		} catch {
			// Corrupt/blocked storage: start fresh, and this session still saves to the server
		}
	}

	#write() {
		try {
			localStorage.setItem(this.#storeKey, JSON.stringify(this.#store));
		} catch {
			// Blocked storage: the heartbeat still saves to the server
		}
	}

	#rollOverIfStale() {
		const current = this.#store.current;
		if (!current) return;
		if (Date.now() - Date.parse(current.last_active_at) < NEW_SESSION_AFTER_MS) return;
		if (current.dirty && worthSaving(current)) {
			this.#store.unsent = [...this.#store.unsent, current].slice(-MAX_UNSENT);
		}
		this.#store.current = null;
	}

	#ensureItem() {
		const now = new Date().toISOString();
		const session = (this.#store.current ??= {
			id: crypto.randomUUID(),
			started_at: now,
			last_active_at: now,
			items: {},
			dirty: false
		});
		const key = `${this.#ref.kind}:${this.#ref.refId ?? this.#ref.label}`;
		this.#item = session.items[key] ??= {
			id: crypto.randomUUID(),
			kind: this.#ref.kind,
			ref_id: this.#ref.refId,
			label: this.#ref.label,
			practice_seconds: 0,
			run_seconds: null,
			run_source: null,
			length_before_apply: null,
			note: null
		};
		this.seconds = this.#item.practice_seconds;
	}

	/** Anything the last visit couldn't send */
	async #replay() {
		const unsent = this.#store.unsent;
		this.#store.unsent = [];
		for (const session of unsent) {
			if (!(await send(session))) this.#store.unsent.push(session);
		}
		this.#write();
		await this.#flush();
	}

	async #flush(keepalive = false) {
		const session = this.#store.current;
		if (!session?.dirty || this.#sending || !worthSaving(session)) return;
		this.#sending = true;
		session.dirty = false;
		const saved = await send(session, keepalive);
		if (!saved) session.dirty = true;
		this.#sending = false;
		this.#write();
	}
}
