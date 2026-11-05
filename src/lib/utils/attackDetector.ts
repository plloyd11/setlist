/**
 * Tells playing from an amp that's just switched on. A steady level never jumps,
 * however loud it is: hiss, hum, a noisy high-gain channel. A pick attack does. So
 * playing means a recent jump above where the level was just resting, not a level
 * above a fixed line, which hiss can sit over and quiet playing can sit under.
 */

/** A pick attack: at least this much above where the level was resting */
const ATTACK_DB = 9;
/** Nothing quieter counts, whatever it does: digital silence, a muted input */
const FLOOR_DB = -60;
/**
 * The resting level drops quickly between notes and rises slowly under a held one.
 * The next pick then stands out, and a chord left ringing counts once, not forever.
 */
const FALL_SECONDS = 0.1;
const RISE_SECONDS = 1;

export class AttackDetector {
	#resting: number | null = null;
	#lastTime = 0;

	/** Feed one reading (RMS in dBFS) taken at `now` (ms). True while an attack stands out. */
	feed(db: number, now: number): boolean {
		const level = Math.max(db, FLOOR_DB);
		if (this.#resting === null) {
			this.#resting = level;
			this.#lastTime = now;
			return false;
		}
		const seconds = Math.max(0, (now - this.#lastTime) / 1000);
		this.#lastTime = now;

		const attack = level > FLOOR_DB && level - this.#resting >= ATTACK_DB;
		const settle = level < this.#resting ? FALL_SECONDS : RISE_SECONDS;
		this.#resting += (level - this.#resting) * (1 - Math.exp(-seconds / settle));
		return attack;
	}
}
