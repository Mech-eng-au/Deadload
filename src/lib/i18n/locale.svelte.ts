import { getSettings, putSettings } from '../db/settings.js';
import {
	BASE_LOCALE,
	localeTag,
	messages,
	resolveLocale,
	type Locale,
	type Messages
} from './index.js';

/**
 * The language the app is currently showing (docs/SPEC.md §16).
 *
 * The one reactive thing in the i18n layer, and it is deliberately the *only*
 * one: `index.ts` and the dictionaries are plain TypeScript with no runes, so
 * the pure modules §15 requires to be testable headlessly — `steps.ts`,
 * `routines.ts`, `pdf/`, `stats/` — can take a `Messages` as an argument
 * without dragging Svelte into vitest.
 *
 * **Why not a locale in the URL.** The app is fully prerendered
 * (`+layout.ts`), and that is 176 HTML files, 14 MB, because every catalog page
 * inlines the body figures. A `/da/` prefix means all of it again per language,
 * against about 2 MB of headroom under §11's 25 MB budget. Switching at runtime
 * costs one re-render and nothing on disk.
 */

/**
 * The choice, mirrored where it can be read *synchronously*.
 *
 * IndexedDB is the source of truth, and it is async, so on a cold start the
 * first paint would always be English and Danish would arrive a frame later.
 * `localStorage` is readable during module initialisation, so the app starts in
 * the right language and the database only ever confirms it. Written on every
 * change and on every restore, so the two cannot drift.
 */
const STORAGE_KEY = 'deadload:language';

function initial(): Locale {
	// Prerendering happens in Node, where there is no device and no storage, so
	// the HTML on disk is always the base language. The browser corrects it
	// during hydration, before anything is painted from it.
	if (typeof window === 'undefined') return BASE_LOCALE;
	let saved: string | undefined;
	try {
		saved = window.localStorage.getItem(STORAGE_KEY) ?? undefined;
	} catch {
		// Storage can be disabled; the device language is a fine answer.
	}
	return resolveLocale(saved, navigator.languages ?? [navigator.language]);
}

let current = $state<Locale>(initial());

/**
 * Tell the document what language it is in, straight away.
 *
 * `<html lang>` is what a screen reader picks a voice from and what the browser
 * offers to translate against, so it has to be right from the first paint —
 * not from whenever IndexedDB comes back. Setting it only in `adoptSaved()`
 * left it at the prerendered `en` for the whole of a cold start, which a
 * Playwright run caught by reading it too early and finding the truth.
 */
applyToDocument(current);

export function locale(): Locale {
	return current;
}

/** The current dictionary, for the pure functions that take one. */
export function pack(): Messages {
	return messages(current);
}

/**
 * The messages, as a plain object read at the point of use.
 *
 * Every namespace is a getter, so `t.session.logSet` in a template reads
 * `current` while rendering and therefore re-renders when the language changes.
 * Explicit rather than a Proxy: it is a dozen lines, it is greppable, and
 * TypeScript fails the file if a namespace is forgotten.
 */
export const t: Messages = {
	get nav() {
		return pack().nav;
	},
	get common() {
		return pack().common;
	},
	get home() {
		return pack().home;
	},
	get routine() {
		return pack().routine;
	},
	get catalog() {
		return pack().catalog;
	},
	get exercise() {
		return pack().exercise;
	},
	get muscles() {
		return pack().muscles;
	},
	get equipment() {
		return pack().equipment;
	},
	get session() {
		return pack().session;
	},
	get history() {
		return pack().history;
	},
	get stats() {
		return pack().stats;
	},
	get settings() {
		return pack().settings;
	},
	get importer() {
		return pack().importer;
	},
	get presets() {
		return pack().presets;
	},
	get about() {
		return pack().about;
	},
	get pdf() {
		return pack().pdf;
	},
	get units() {
		return pack().units;
	}
};

/** Tell the document what language it is in, for accessibility and the browser. */
function applyToDocument(value: Locale): void {
	if (typeof document === 'undefined') return;
	document.documentElement.lang = localeTag(value);
}

/**
 * Adopt the language stored in Settings. Called once the database has been
 * read; usually it agrees with what `initial()` worked out, and the one case it
 * does not is a user who chose a language other than their phone's.
 */
export function adoptSaved(saved: string | undefined): void {
	const next = resolveLocale(saved, typeof navigator === 'undefined' ? [] : navigator.languages);
	if (next !== current) current = next;
	if (saved === undefined) forget();
	else remember(next);
	applyToDocument(current);
}

/** The user chose a language. Explicit, and it outranks the device from now on. */
export async function setLocale(value: Locale): Promise<void> {
	current = value;
	remember(value);
	applyToDocument(value);
	await putSettings({ ...(await getSettings()), language: value });
}

function remember(value: Locale): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, value);
	} catch {
		// Not fatal: the database still has it, one frame later.
	}
}

function forget(): void {
	try {
		window.localStorage.removeItem(STORAGE_KEY);
	} catch {
		// As above.
	}
}
