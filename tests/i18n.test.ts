import { describe, expect, it } from 'vitest';
import { BASE_LOCALE, LOCALES, messages, resolveLocale, type Locale } from '../src/lib/i18n/index.js';
import { en } from '../src/lib/i18n/en/index.js';
import { formatters } from '../src/lib/i18n/format.js';

/**
 * The dictionaries (docs/SPEC.md §16).
 *
 * Most of what is checked here is **already a compile error**: `Messages` is
 * `typeof en`, so a locale missing a key, carrying a stray one, or declaring a
 * message function with the wrong arguments fails `npm run check` before it
 * fails anything else.
 *
 * These run anyway, and the reason is worth stating rather than assuming. The
 * type only holds where TypeScript is looking: an object literal satisfies an
 * index signature with *any* keys, `as` erases the check outright, and a
 * dictionary that has drifted into `Record<string, string>` anywhere along the
 * way stops being checked without anything going red. A missing Danish string
 * has to fail CI rather than appear as `undefined` on the phone, and one of
 * these two mechanisms failing quietly is exactly the case the other exists for.
 */

type Node = unknown;

/** Every leaf in a dictionary, as `nav.routines` / `muscles.names.lats.label`. */
function paths(node: Node, prefix = ''): Map<string, 'string' | 'function' | 'other'> {
	const out = new Map<string, 'string' | 'function' | 'other'>();
	if (typeof node === 'string') {
		out.set(prefix, 'string');
	} else if (typeof node === 'function') {
		out.set(prefix, 'function');
	} else if (node && typeof node === 'object') {
		for (const [key, value] of Object.entries(node)) {
			for (const [p, kind] of paths(value, prefix ? `${prefix}.${key}` : key)) out.set(p, kind);
		}
	} else {
		out.set(prefix, 'other');
	}
	return out;
}

const base = paths(en);

describe('every locale is complete (§16)', () => {
	it('ships more than one language, or none of this is doing anything', () => {
		expect(LOCALES.length).toBeGreaterThan(1);
		expect(LOCALES.map((l) => l.id)).toContain(BASE_LOCALE);
	});

	it.each(LOCALES)('$id has every key English has', ({ id }) => {
		const theirs = paths(messages(id));
		const missing = [...base.keys()].filter((k) => !theirs.has(k));
		expect(missing, `${id} is missing ${missing.length} key(s)`).toEqual([]);
	});

	it.each(LOCALES)('$id has no keys English does not', ({ id }) => {
		// A stray key is a translation of something that was renamed or deleted:
		// dead weight that reads as coverage.
		const theirs = paths(messages(id));
		const stray = [...theirs.keys()].filter((k) => !base.has(k));
		expect(stray, `${id} has ${stray.length} key(s) English does not`).toEqual([]);
	});

	it.each(LOCALES)('$id keeps strings as strings and functions as functions', ({ id }) => {
		// A message that takes a number in one language and not in another means a
		// call site is wrong in exactly one of them.
		const theirs = paths(messages(id));
		for (const [key, kind] of base) {
			expect(theirs.get(key), `${id}: ${key}`).toBe(kind);
		}
	});

	it.each(LOCALES)('$id has no empty or untranslated-looking strings', ({ id }) => {
		for (const [key, kind] of paths(messages(id))) {
			if (kind !== 'string') continue;
			const value = key.split('.').reduce<any>((o, k) => o[k], messages(id));
			expect(value.trim().length, `${id}: ${key} is empty`).toBeGreaterThan(0);
			expect(value, `${id}: ${key} is still a TODO`).not.toMatch(/^(TODO|FIXME|XXX)/i);
		}
	});

	it.each(LOCALES.filter((l) => l.id !== BASE_LOCALE))(
		'$id actually differs from English',
		({ id }) => {
			// The failure this catches: a locale file copied from English and never
			// filled in, which passes every check above.
			const theirs = messages(id);
			const strings = [...base].filter(([, kind]) => kind === 'string').map(([k]) => k);
			const identical = strings.filter(
				(k) =>
					k.split('.').reduce<any>((o, part) => o[part], theirs) ===
					k.split('.').reduce<any>((o, part) => o[part], en)
			);
			// Some genuinely are the same word — "RPE", "Kettlebell", "Core" — so the
			// bar is that the great majority are not.
			expect(identical.length / strings.length, `${id}: ${identical.length}/${strings.length} strings are still English`).toBeLessThan(0.2);
		}
	);
});

describe('picking a language (§16)', () => {
	it('takes an explicit choice over anything the device says', () => {
		expect(resolveLocale('da', ['en-GB', 'en'])).toBe('da');
		expect(resolveLocale('en', ['da-DK', 'da'])).toBe('en');
	});

	/**
	 * The `ownedEquipment` failure of §5.1, in a second costume. `undefined` is
	 * "never answered" and follows the phone; an explicit value is an answer and
	 * outranks it. Writing `settings.language ?? deviceLanguage()` collapses the
	 * two and puts a Dane who chose English back into Danish on the next launch.
	 */
	it('distinguishes "never answered" from choosing the phone\u2019s language', () => {
		expect(resolveLocale(undefined, ['da-DK'])).toBe('da');
		expect(resolveLocale('en', ['da-DK'])).toBe('en');
		// And the reverse, which is the one a Danish developer would never hit by
		// hand: an English speaker on a Danish phone who chose Danish keeps it.
		expect(resolveLocale('da', ['en-GB'])).toBe('da');
	});

	it('matches on the primary subtag, so a region never loses the language', () => {
		for (const tag of ['da', 'da-DK', 'da-GL', 'DA', 'da_DK']) {
			expect(resolveLocale(undefined, [tag]), tag).toBe('da');
		}
	});

	it('walks the device list in order and falls back to English', () => {
		expect(resolveLocale(undefined, ['de-AT', 'da-DK', 'en'])).toBe('da');
		expect(resolveLocale(undefined, ['de-AT', 'fr'])).toBe(BASE_LOCALE);
		expect(resolveLocale(undefined, [])).toBe(BASE_LOCALE);
	});

	it('ignores a saved language that is no longer shipped', () => {
		expect(resolveLocale('kl', ['en'])).toBe('en');
		expect(resolveLocale('', ['da'])).toBe('da');
	});
});

describe('plurals, numbers and dates come from Intl (§16)', () => {
	const enF = formatters('en-GB');
	const daF = formatters('da-DK');

	it('uses the locale\u2019s own plural rules rather than an "s"', () => {
		expect(en.units.sets(1)).toBe('1 set');
		expect(en.units.sets(2)).toBe('2 sets');
		// Danish "sæt" does not change in the plural, which is the whole reason
		// `n === 1 ? '' : 's'` in 21 places had to go.
		expect(messages('da').units.sets(1)).toBe('1 sæt');
		expect(messages('da').units.sets(2)).toBe('2 sæt');
	});

	it('falls back to `other` for a category a language does not have', () => {
		// English has no `few`; a locale supplying only `one` and `other` must not
		// break when a future language's dictionary supplies more.
		expect(enF.plural(3, { one: 'one', few: 'few', other: 'other' })).toBe('other');
		expect(enF.plural(1, { one: 'one', other: 'other' })).toBe('one');
	});

	it('writes a decimal the way the language does', () => {
		expect(en.units.kg(2.5)).toBe('2.5 kg');
		expect(messages('da').units.kg(2.5)).toBe('2,5 kg');
		expect(daF.num(1234.5)).toBe('1.234,5');
	});

	it('trims a trailing zero, because "10.0 kg" reads as a scale', () => {
		expect(en.units.kg(10)).toBe('10 kg');
		expect(messages('da').units.kg(10)).toBe('10 kg');
	});

	it('joins a list the way the language does', () => {
		expect(enF.list(['a', 'b', 'c'])).toBe('a, b and c');
		expect(daF.list(['a', 'b', 'c'])).toBe('a, b og c');
	});

	it('formats a date in the language, not in en-GB', () => {
		const iso = '2026-07-30T12:00:00Z';
		expect(en.pdf.printedOn(iso)).toBe('30 July 2026');
		expect(messages('da').pdf.printedOn(iso)).toBe('30. juli 2026');
	});
});

describe('what is deliberately not translated (§16)', () => {
	it('speaks English whatever the interface is set to', async () => {
		// §7 and HANDOVER §5: everything spoken is English because the exercise
		// names being read out are English, and a Danish voice reading "Side
		// Bridge" is what that sounds like. Changing this means changing the
		// catalog first — see src/lib/catalog/names.ts.
		const speech = await import('node:fs').then((fs) =>
			fs.readFileSync(
				new URL('../src/lib/session/speech.ts', import.meta.url).pathname,
				'utf8'
			)
		);
		expect(speech).toContain("SPOKEN_LANG = 'en-US'");
		// Comments stripped first: this file *explains* why `navigator.language` is
		// wrong, and the explanation must not be what makes the test pass.
		const code = speech.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
		expect(code).not.toContain('navigator.language');
	});

	it('keeps the announcement wording out of the dictionaries', () => {
		// `announce.ts` builds the spoken sentence and is English by design. If it
		// ever needs a locale it will be because the catalog was translated, and
		// that is a decision with a file of its own.
		expect([...base.keys()].filter((k) => k.startsWith('announce'))).toEqual([]);
	});
});

describe('files stay locale-invariant (§16)', () => {
	/**
	 * The CSV, the backup and the import format are **machine formats**, and a
	 * number formatted for a human breaks all three: `2,5` for two and a half
	 * kilos makes a comma-separated file ambiguous, and a localised date makes a
	 * backup unreadable by the app that wrote it once the phone changes language.
	 *
	 * The risk is real rather than theoretical — `formatKg` and `Intl` are one
	 * autocomplete away from here, and everything above this line exists to push
	 * them into the app.
	 */
	it('writes numbers and dates as machines read them', async () => {
		const { sessionsToCsv } = await import('../src/lib/stats/csv.js');
		const session = {
			id: 's1',
			routineId: 'r1',
			routineName: 'Morgen',
			startedAt: '2026-07-30T07:00:00.000Z',
			endedAt: '2026-07-30T07:30:00.000Z',
			entries: [
				{
					exerciseId: 'pushups',
					itemId: 'i1',
					setIndex: 0,
					reps: 12,
					loadKg: 2.5,
					skipped: false,
					completedAt: '2026-07-30T07:05:00.000Z'
				}
			]
		};
		const csv = sessionsToCsv([session as never]);
		// A dot, whatever the interface language is, because a comma would be a
		// column break in this very file.
		expect(csv).toContain('2.5');
		expect(csv).not.toContain('2,5');
		// ISO timestamps, not "30. juli 2026".
		expect(csv).toContain('2026-07-30');
		// The header is part of the format and is never translated.
		expect(csv.split('\n')[0]).toContain('load_kg');
	});

	it('names a PDF by a date that sorts, not one that reads', async () => {
		const { sheetFilename } = await import('../src/lib/pdf/routine-sheet.js');
		const routine = {
			id: 'r1',
			name: 'Ryg og lænd',
			tags: [],
			source: 'user',
			createdAt: '2026-07-30T07:00:00.000Z',
			updatedAt: '2026-07-30T07:00:00.000Z',
			blocks: []
		};
		const name = sheetFilename(routine as never, new Date('2026-07-30T12:00:00Z'));
		expect(name).toBe('deadload-ryg-og-laend-2026-07-30.pdf');
	});
});
