import { en } from './en/index.js';
import { da } from './da/index.js';

/**
 * Interface language (docs/SPEC.md §16).
 *
 * **English is the base and the type.** `Messages` is `typeof en`, so a locale
 * is a value that has to satisfy the shape English defines — a missing key, a
 * stray key or a message function with the wrong arguments is a compile error
 * rather than an `undefined` on somebody's phone. `tests/i18n.test.ts` checks
 * the same thing at runtime, because the type only holds while everything goes
 * through TypeScript and the presets do not.
 *
 * **No library**, and the reason is not only this project's habit of making a
 * dependency earn its place. The two things a compile-time i18n library buys —
 * tree-shaking one locale per build, and locale-prefixed URLs — are both
 * worthless here: the APK carries every language at once, and the app
 * prerenders 176 pages, so a `/da/` prefix would prerender all of them again
 * and cost 14 MB against §11's remaining 2 MB. What is left is a dictionary,
 * and a dictionary is an object.
 *
 * **Messages are values where nothing varies and functions where something
 * does.** That is what makes this work for the sentences the app builds rather
 * than looks up — `describeStep`, `describeItem`, the last-time line — because
 * word order lives inside the function, where a translator can move it, instead
 * of inside an interpolation syntax that cannot.
 */
export type Locale = 'en' | 'da';

/** The base language. Everything else is measured against it. */
export const BASE_LOCALE: Locale = 'en';

export interface LocaleInfo {
	id: Locale;
	/** The language's name in the language itself, for the Settings list. */
	endonym: string;
	/** BCP 47 tag, for `Intl` and for `<html lang>`. */
	tag: string;
}

export const LOCALES: LocaleInfo[] = [
	{ id: 'en', endonym: 'English', tag: 'en-GB' },
	{ id: 'da', endonym: 'Dansk', tag: 'da-DK' }
];

const packs = { en, da };

export type Messages = typeof en;

export function messages(locale: Locale): Messages {
	return packs[locale];
}

export function localeTag(locale: Locale): string {
	return LOCALES.find((l) => l.id === locale)?.tag ?? locale;
}

function isLocale(value: string | undefined): value is Locale {
	return value !== undefined && value in packs;
}

/**
 * Which language to show, from the saved setting and the device.
 *
 * `Settings.language` is **three-valued in exactly the way `ownedEquipment` is**
 * (§5.1), and for the same reason: `undefined` means the question has never been
 * answered, so the device decides; an explicit value means the user answered,
 * and it wins even when it agrees with nothing on the phone. Collapsing the two
 * — `settings.language ?? deviceLanguage()` — would put a Dane who deliberately
 * chose English back into Danish on the next launch, silently, which is the same
 * failure §5.1 has a test named after.
 *
 * Device tags are matched on the primary subtag, so `da`, `da-DK` and `da-GL`
 * all find Danish, and a phone set to `de-AT` falls through to English rather
 * than to nothing.
 */
export function resolveLocale(
	saved: string | undefined,
	device: readonly string[] = []
): Locale {
	if (isLocale(saved)) return saved;
	for (const tag of device) {
		const primary = tag.toLowerCase().split(/[-_]/)[0];
		if (isLocale(primary)) return primary;
	}
	return BASE_LOCALE;
}
