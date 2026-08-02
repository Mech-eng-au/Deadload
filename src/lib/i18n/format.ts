/**
 * The formatting a dictionary needs (docs/SPEC.md §16).
 *
 * Everything here is `Intl`, which the Android WebView has had for years and
 * which works with no network — so plurals, numbers, dates and lists are the
 * platform's problem rather than ours. That matters more than it saves: the app
 * had **21 hand-written `n === 1 ? '' : 's'`** and Danish happens to pluralise
 * the same way English does, so all 21 would have kept working while being
 * wrong in principle. Polish has four plural forms and Russian three; a rule
 * that is right for the second language and wrong for the third is not a rule.
 *
 * Bound to a locale once per dictionary, so a message reads `f.plural(n, {…})`
 * rather than repeating the tag on every line.
 */

/** The plural categories a language can have. Only `other` is required. */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export interface Formatters {
	readonly locale: string;
	/**
	 * The right form for `n`, by the locale's own rules.
	 *
	 * A locale supplies the categories it actually has: English and Danish need
	 * `one` and `other`, Polish adds `few` and `many`, Japanese would need only
	 * `other`. Anything a language does not supply falls back to `other`, which
	 * is what the category is for.
	 */
	plural(n: number, forms: PluralForms): string;
	/** A number in the locale's own notation — `2.5` in English, `2,5` in Danish. */
	num(n: number, options?: Intl.NumberFormatOptions): string;
	/** A date, from an ISO string or a `Date`. */
	date(value: string | Date, options?: Intl.DateTimeFormatOptions): string;
	/** A date and a time together. */
	dateTime(value: string | Date, options?: Intl.DateTimeFormatOptions): string;
	/** "a, b and c" — and "a, b og c" in Danish, which is why it is not `join`. */
	list(items: string[], type?: 'conjunction' | 'disjunction'): string;
}

/**
 * `Intl` objects are expensive to construct and cheap to reuse, and the session
 * screen formats numbers every second while a set is running.
 */
const cache = new Map<string, unknown>();
function memo<T>(key: string, make: () => T): T {
	let hit = cache.get(key) as T | undefined;
	if (hit === undefined) {
		hit = make();
		cache.set(key, hit);
	}
	return hit;
}

export function formatters(locale: string): Formatters {
	return {
		locale,
		plural(n, forms) {
			const rules = memo(`p:${locale}`, () => new Intl.PluralRules(locale));
			return forms[rules.select(n)] ?? forms.other;
		},
		num(n, options) {
			return memo(`n:${locale}:${JSON.stringify(options ?? {})}`, () =>
				new Intl.NumberFormat(locale, options)
			).format(n);
		},
		date(value, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
			return memo(`d:${locale}:${JSON.stringify(options)}`, () =>
				new Intl.DateTimeFormat(locale, options)
			).format(typeof value === 'string' ? new Date(value) : value);
		},
		dateTime(value, options = { dateStyle: 'medium', timeStyle: 'short' }) {
			return memo(`dt:${locale}:${JSON.stringify(options)}`, () =>
				new Intl.DateTimeFormat(locale, options)
			).format(typeof value === 'string' ? new Date(value) : value);
		},
		list(items, type = 'conjunction') {
			return memo(`l:${locale}:${type}`, () => new Intl.ListFormat(locale, { type })).format(
				items
			);
		}
	};
}
