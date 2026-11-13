import { rig, type IrSlot } from './rig.svelte.js';
import type { RigFile, RigFileSource } from './rigStore.js';
import {
	creatorName,
	httpsUrl,
	selectTone,
	T3K_ORIGIN,
	Tone3000Error,
	type T3kKind,
	type T3kModel,
	type T3kSession,
	type T3kTone,
	type T3kUser
} from './tone3000.js';

/**
 * A pick from TONE3000 in progress, for the rig panel's model or IR picker. One for the
 * whole app, like the rig: on a phone the panel unmounts when another pane shows, and
 * a pick shouldn't be lost to that.
 *
 * idle → choosing (TONE3000's window is open) → loading → ready (the tone's files,
 * each one tap to add). Closing the window without a pick goes back to idle.
 */
type Status = 'idle' | 'choosing' | 'loading' | 'ready';

/** "Plexi" + "Plexi Crunch" → "Plexi Crunch"; "JCM800" + "Gain 6" → "JCM800 – Gain 6" */
export function fileNameFor(tone: Pick<T3kTone, 'title'>, model: Pick<T3kModel, 'name'>): string {
	const title = tone.title.trim();
	const name = model.name.trim();
	const full =
		!name || name.toLowerCase().includes(title.toLowerCase())
			? name || title
			: `${title} – ${name}`;
	return full.slice(0, 120);
}

function sourceFor(tone: T3kTone, model: T3kModel): RigFileSource {
	return {
		toneId: tone.id,
		modelId: model.id,
		toneTitle: tone.title,
		toneUrl: httpsUrl(tone.url) ?? T3K_ORIGIN,
		creator: creatorName(tone.user),
		creatorUrl: httpsUrl(tone.user.url),
		license: tone.license,
		gear: tone.gear
	};
}

class Tone3000Browser {
	/** Which picker the pick belongs to */
	kind = $state<T3kKind | null>(null);
	/** For an IR, whether it's the first or the second: the pick goes where it was asked for */
	slot = $state<IrSlot>(0);
	status = $state<Status>('idle');
	tone = $state<T3kTone | null>(null);
	models = $state<T3kModel[]>([]);
	/**
	 * The TONE3000 account the window was signed in to. TONE3000 remembers that in the
	 * browser, not us, so on a shared machine it can be someone else's: say whose it is.
	 */
	account = $state<T3kUser | null>(null);
	/** The TONE3000 file on its way down */
	adding = $state<number | null>(null);
	error = $state<string | null>(null);

	#session: T3kSession | null = null;
	#abort: AbortController | null = null;

	/** Straight from a click: the window has to open before anything is awaited */
	async browse(kind: T3kKind, slot: IrSlot = 0) {
		this.#abort?.abort();
		const abort = new AbortController();
		this.#abort = abort;
		this.#reset();
		this.kind = kind;
		this.slot = slot;
		this.status = 'choosing';

		try {
			const picked = await selectTone(kind, abort.signal, () => {
				if (this.#abort === abort) this.status = 'loading';
			});
			if (this.#abort !== abort) return;
			if (!picked) {
				this.#reset();
				return;
			}
			const [tone, models, account] = await Promise.all([
				picked.session.tone(picked.toneId, kind),
				picked.session.models(picked.toneId, kind),
				// Only there to be shown: the pick goes ahead without it
				picked.session.user().catch(() => null)
			]);
			if (this.#abort !== abort) return;
			this.#session = picked.session;
			this.tone = tone;
			this.models = models;
			this.account = account;
			this.status = 'ready';
			// Nothing to choose between: straight in
			if (models.length === 1 && !this.saved(models[0])) await this.add(models[0]);
		} catch (e) {
			if (this.#abort !== abort) return;
			this.#reset();
			this.kind = kind;
			this.slot = slot;
			this.error =
				e instanceof Tone3000Error ? e.message : "Couldn't reach TONE3000. Check you're online.";
		}
	}

	/** Back to the button: closes TONE3000's window if it's open, and forgets the pick */
	close() {
		this.#abort?.abort();
		this.#abort = null;
		this.#reset();
	}

	/** This TONE3000 file, if it's already kept in this browser */
	saved(model: T3kModel): RigFile | undefined {
		const files = this.kind === 'ir' ? rig.irs : rig.models;
		return files.find((file) => file.source?.modelId === model.id);
	}

	isChosen(model: T3kModel): boolean {
		const file = this.saved(model);
		if (!file) return false;
		if (this.kind !== 'ir') return rig.settings.modelId === file.id;
		return (this.slot === 0 ? rig.setup.irId : rig.setup.irId2) === file.id;
	}

	/** Download, check and keep one of the tone's files, then choose it */
	async add(model: T3kModel) {
		const session = this.#session;
		const tone = this.tone;
		const kind = this.kind;
		if (!session || !tone || !kind || this.adding !== null) return;
		this.error = null;

		// Picking the same capture again just chooses the copy already here
		const existing = this.saved(model);
		if (existing) {
			await (kind === 'ir' ? rig.selectIr(existing.id, this.slot) : rig.selectModel(existing.id));
			return;
		}

		this.adding = model.id;
		try {
			const bytes = await session.file(model);
			if (session !== this.#session) return;
			const name = fileNameFor(tone, model);
			const source = sourceFor(tone, model);
			const problem =
				kind === 'ir'
					? await rig.keepIr(bytes, name, name, source, true, this.slot)
					: await rig.keepModel(bytes, name, name, source);
			if (problem && session === this.#session) this.error = problem;
		} catch (e) {
			if (session === this.#session) {
				this.error =
					e instanceof Tone3000Error ? e.message : "Couldn't download that. Check you're online.";
			}
		} finally {
			if (session === this.#session) this.adding = null;
		}
	}

	#reset() {
		this.#session = null;
		this.kind = null;
		this.slot = 0;
		this.status = 'idle';
		this.tone = null;
		this.models = [];
		this.account = null;
		this.adding = null;
		this.error = null;
	}
}

export const tone3000 = new Tone3000Browser();
