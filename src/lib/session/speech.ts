/**
 * Spoken cues (docs/SPEC.md §7). The tones in `audio.ts` can say *that*
 * something changed; only speech can say *what* changed, which is the last
 * reason to look at the phone during a workout.
 *
 * **Two engines, because the Web Speech API is not available where this app
 * actually runs.** `window.speechSynthesis` is absent from the Android System
 * WebView — a Chromium issue open since 2015 — and the sideloaded APK is a
 * WebView, so a browser-only implementation is silent on the phone and works
 * only in the dev browser. Found 2026-07-29 on a Pixel, after shipping exactly
 * that mistake. On Android the announcement goes through Capacitor to the OS
 * text-to-speech engine; in a browser it still uses `speechSynthesis`.
 *
 * All the wording lives in `announce.ts`, which is pure and tested. What is
 * left here is the part that cannot be unit-tested, so it is kept small and
 * total: every failure path is silence rather than an exception, because a
 * missed announcement must never interrupt a workout.
 */

type NativeTts = {
	speak(options: { text: string; lang?: string; rate?: number }): Promise<void>;
	stop(): Promise<void>;
};

let enabled = true;
let voice: SpeechSynthesisVoice | null = null;
/** Resolved once on arming: the native bridge, or null for the web path. */
let native: NativeTts | null = null;
let checked = false;

/** Slightly slower than default: heard across a room, out of breath. */
const RATE = 0.95;

/**
 * The language of the *words*, not of the phone. Everything spoken is English —
 * the catalog's exercise names are English, and so is every sentence
 * `announce.ts` builds. Handing the engine `navigator.language` instead asks a
 * Danish voice to read "Next up, Side Bridge", which is what it sounds like:
 * found 2026-07-29 on a Danish-locale phone. The device locale describes the
 * user's interface preference, and has nothing to say about which voice can
 * pronounce this text.
 */
const SPOKEN_LANG = 'en-US';

function synth(): SpeechSynthesis | null {
	if (typeof window === 'undefined') return null;
	return 'speechSynthesis' in window ? window.speechSynthesis : null;
}

/**
 * Resolve which engine this device has. Dynamic imports, like the back-button
 * handler: the Capacitor packages must not be pulled into a browser build.
 */
async function resolveEngine(): Promise<void> {
	if (checked) return;
	checked = true;
	try {
		const { Capacitor } = await import('@capacitor/core');
		if (!Capacitor.isNativePlatform()) return;
		const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
		native = TextToSpeech as unknown as NativeTts;
	} catch {
		// Not a native build, or the plugin is missing: fall back to the web API.
	}
}

/**
 * Whether this device can speak at all, for the Settings screen. Async because
 * finding out means asking Capacitor which platform we are on.
 */
export async function speechAvailable(): Promise<boolean> {
	await resolveEngine();
	return native !== null || synth() !== null;
}

export function setSpeechEnabled(value: boolean): void {
	enabled = value;
	if (!value) cancelSpeech();
}

/**
 * Pick a voice once, web path only. Browsers load them asynchronously, so this
 * is called on arming and again on `voiceschanged`; until one is chosen the
 * engine's default is used, which is correct more often than not. The native
 * engine is told the language directly.
 */
function chooseVoice(): void {
	const s = synth();
	if (!s) return;
	const voices = s.getVoices();
	if (!voices.length) return;
	voice =
		voices.find((v) => v.lang.replace('_', '-') === SPOKEN_LANG && v.localService) ??
		voices.find((v) => v.lang.startsWith('en') && v.localService) ??
		voices.find((v) => v.lang.startsWith('en')) ??
		null;
}

/**
 * Called from the same user gesture that arms the audio. On the web, speaking
 * needs waking up or the first announcement can be swallowed, exactly like the
 * first beep; the native engine needs no gesture.
 */
export async function armSpeech(): Promise<void> {
	await resolveEngine();
	if (native) return;
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

/**
 * Speak, and say whether anything will actually be spoken. The boolean is what
 * auto mode waits on (§7): "start when the reading is over" needs to know both
 * when the reading ends and whether there is one at all.
 *
 * `onDone` fires when the engine finishes, or when it fails — never never.
 */
export function speak(text: string, onDone?: () => void): boolean {
	if (!enabled || !text) return false;

	if (native) {
		// One announcement at a time: the next exercise supersedes the last one
		// rather than queueing behind it. Stop first, because the plugin's queue
		// strategy enum has moved between versions and this does not.
		void native
			.stop()
			.catch(() => {})
			.then(() => native?.speak({ text, lang: SPOKEN_LANG, rate: RATE }))
			.then(() => onDone?.())
			.catch(() => onDone?.());
		return true;
	}

	const s = synth();
	if (!s) return false;
	try {
		s.cancel();
		const utterance = new SpeechSynthesisUtterance(text);
		if (voice) utterance.voice = voice;
		// Set even when a voice was chosen: on a non-English device it is what
		// stops the browser falling back to the page or system locale.
		utterance.lang = SPOKEN_LANG;
		utterance.rate = RATE;
		if (onDone) {
			utterance.onend = () => onDone();
			utterance.onerror = () => onDone();
		}
		s.speak(utterance);
		return true;
	} catch {
		// Same rule as a missed tone: silence, never a thrown error mid-set.
		return false;
	}
}

/** Leaving the session, or turning speech off, stops it mid-sentence. */
export function cancelSpeech(): void {
	try {
		if (native) void native.stop().catch(() => {});
		else synth()?.cancel();
	} catch {
		// Nothing to cancel.
	}
}
