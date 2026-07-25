/**
 * Rest-timer beep (§7). Two rules, both learned the hard way on mobile:
 *
 * 1. The AudioContext must be created and resumed inside a user gesture, not at
 *    the first beep, or the first beep is silent.
 * 2. A synthesized oscillator, not an audio file, so nothing has to load.
 */

let ctx: AudioContext | null = null;

/** Call from the Start button handler. Safe to call more than once. */
export async function armAudio(): Promise<void> {
	try {
		type WithWebkit = typeof globalThis & { webkitAudioContext?: typeof AudioContext };
		const Ctor = window.AudioContext ?? (globalThis as WithWebkit).webkitAudioContext;
		if (!Ctor) return;
		ctx ??= new Ctor();
		if (ctx.state === 'suspended') await ctx.resume();
	} catch {
		// No audio available; the countdown is still visible.
	}
}

export function isArmed(): boolean {
	return ctx !== null && ctx.state === 'running';
}

/** Short tone. `emphasis` marks the final beep at zero. */
export function beep(emphasis = false): void {
	if (!ctx || ctx.state !== 'running') return;
	try {
		const now = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = 'sine';
		osc.frequency.value = emphasis ? 880 : 660;
		// Ramped rather than switched, so it does not click.
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(emphasis ? 0.35 : 0.2, now + 0.01);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + (emphasis ? 0.45 : 0.16));
		osc.connect(gain).connect(ctx.destination);
		osc.start(now);
		osc.stop(now + (emphasis ? 0.5 : 0.2));
	} catch {
		// Ignore: a missed beep must never interrupt a workout.
	}
}

export function releaseAudio(): void {
	ctx?.close().catch(() => {});
	ctx = null;
}
