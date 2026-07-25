/**
 * Session audio (docs/SPEC.md §7).
 *
 * The phone is on the floor and the user is often not looking at it — during a
 * plank they cannot look at it. Sound is the only channel that works, so every
 * moment the user needs to act has a cue, and the cues are deliberately
 * different from each other: pitch and shape, not volume, because volume is
 * what varies with the room.
 *
 * Two rules learned on mobile:
 *
 * 1. The AudioContext must be created and resumed inside a user gesture, not at
 *    the first cue, or the first cue is silent.
 * 2. Everything is synthesized. No file to load, nothing to go missing offline.
 */

let ctx: AudioContext | null = null;
let enabled = true;

/** Call from the Start button handler. Safe to call more than once. */
export async function armAudio(): Promise<void> {
	try {
		type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };
		const Ctor = window.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext;
		if (!Ctor) return;
		ctx ??= new Ctor();
		if (ctx.state === 'suspended') await ctx.resume();
	} catch {
		// No audio available; the countdown is still on screen.
	}
}

export function setSoundEnabled(value: boolean): void {
	enabled = value;
}

export function soundEnabled(): boolean {
	return enabled;
}

export function isArmed(): boolean {
	return ctx !== null && ctx.state === 'running';
}

/** One note. Gain is ramped rather than switched, so it does not click. */
function tone(frequency: number, afterSeconds: number, seconds: number, peak: number): void {
	if (!ctx) return;
	const start = ctx.currentTime + afterSeconds;
	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = 'sine';
	osc.frequency.value = frequency;
	gain.gain.setValueAtTime(0.0001, start);
	gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
	gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
	osc.connect(gain).connect(ctx.destination);
	osc.start(start);
	osc.stop(start + seconds + 0.02);
}

/**
 * Each cue answers a different question, so each sounds different:
 *
 * - `go`        rising pair   — "the timed set has started"
 * - `countdown` single tick   — "three, two, one"
 * - `done`      rising pair, brighter and longer — "stop now"
 * - `logged`    soft low click — "that tap registered"
 * - `finished`  three ascending notes — "the whole session is over"
 */
export type Cue = 'go' | 'countdown' | 'done' | 'logged' | 'finished';

export function cue(name: Cue): void {
	if (!enabled || !ctx || ctx.state !== 'running') return;
	try {
		switch (name) {
			case 'go':
				tone(523.25, 0, 0.1, 0.18);
				tone(783.99, 0.1, 0.14, 0.18);
				break;
			case 'countdown':
				tone(659.25, 0, 0.11, 0.16);
				break;
			case 'done':
				// The one that has to carry across a room while face down.
				tone(880, 0, 0.18, 0.38);
				tone(1174.66, 0.18, 0.32, 0.38);
				break;
			case 'logged':
				tone(392, 0, 0.06, 0.1);
				break;
			case 'finished':
				tone(523.25, 0, 0.16, 0.3);
				tone(659.25, 0.16, 0.16, 0.3);
				tone(783.99, 0.32, 0.4, 0.3);
				break;
		}
	} catch {
		// A missed cue must never interrupt a workout.
	}
}

export function releaseAudio(): void {
	ctx?.close().catch(() => {});
	ctx = null;
}
