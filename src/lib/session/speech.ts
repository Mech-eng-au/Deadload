/**
 * Spoken cues (docs/SPEC.md §7). The tones in `audio.ts` can say *that*
 * something changed; only speech can say *what* changed, which is the last
 * reason to look at the phone during a workout.
 *
 * Deliberately thin: all the wording lives in `announce.ts`, which is pure and
 * tested. What is left here is the part that cannot be unit-tested — the
 * browser's speech engine — so it is kept small and total, and every failure
 * path is silence rather than an exception. A missed announcement must never
 * interrupt a workout.
 */

let enabled = true;
let voice: SpeechSynthesisVoice | null = null;

/** Slightly slower than default: heard across a room, out of breath. */
const RATE = 0.95;

function synth(): SpeechSynthesis | null {
	if (typeof window === 'undefined') return null;
	return 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/** Whether this device can speak at all, for the Settings screen. */
export function speechAvailable(): boolean {
	return synth() !== null;
}

export function setSpeechEnabled(value: boolean): void {
	enabled = value;
	if (!value) cancelSpeech();
}

/**
 * Pick a voice once. Android loads them asynchronously, so this is called on
 * arming and again on `voiceschanged`; until one is chosen the engine's default
 * is used, which is correct more often than not.
 */
function chooseVoice(): void {
	const s = synth();
	if (!s) return;
	const voices = s.getVoices();
	if (!voices.length) return;
	const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
	voice =
		voices.find((v) => v.lang === lang && v.localService) ??
		voices.find((v) => v.lang.startsWith(lang.slice(0, 2)) && v.localService) ??
		voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) ??
		null;
}

/**
 * Called from the same user gesture that arms the audio. Speaking an empty
 * utterance is what wakes some engines up; without it the first real
 * announcement can be swallowed, exactly like the first beep.
 */
export function armSpeech(): void {
	const s = synth();
	if (!s) return;
	try {
		chooseVoice();
		s.addEventListener?.('voiceschanged', chooseVoice);
		s.cancel();
	} catch {
		// Nothing to arm; the screen still shows everything.
	}
}

export function speak(text: string): void {
	const s = synth();
	if (!enabled || !s || !text) return;
	try {
		// One announcement at a time: the next exercise supersedes the last one,
		// it does not queue behind it.
		s.cancel();
		const utterance = new SpeechSynthesisUtterance(text);
		if (voice) utterance.voice = voice;
		utterance.rate = RATE;
		s.speak(utterance);
	} catch {
		// Same rule as a missed tone: silence, never a thrown error mid-set.
	}
}

/** Leaving the session, or turning speech off, stops it mid-sentence. */
export function cancelSpeech(): void {
	try {
		synth()?.cancel();
	} catch {
		// Nothing to cancel.
	}
}
