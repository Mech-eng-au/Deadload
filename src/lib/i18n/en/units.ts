import { formatters } from '../format.js';

const f = formatters('en-GB');

/**
 * Quantities, and the words that go with them.
 *
 * These are the app's most-repeated phrases and the ones the old code got
 * casually wrong: `n === 1 ? '' : 's'` appeared in **21 places**, and every one
 * of them was an English plural rule written inline. They live here now because
 * a set count reads the same on the home screen, the routine screen, the PDF
 * and the statistics, and it should not be possible for those four to disagree.
 */
export const units = {
	seconds: (n: number) => `${f.num(n)} s`,
	spelledSeconds: (n: number) => f.plural(n, { one: '1 second', other: `${f.num(n)} seconds` }),
	minutes: (n: number) => `${f.num(n)} min`,
	reps: (n: number) => f.plural(n, { one: '1 rep', other: `${f.num(n)} reps` }),
	repsRange: (min: number, max: number) => `${f.num(min)}–${f.num(max)} reps`,
	sets: (n: number) => f.plural(n, { one: '1 set', other: `${f.num(n)} sets` }),
	rounds: (n: number) => f.plural(n, { one: '1 round', other: `${f.num(n)} rounds` }),
	exercises: (n: number) => f.plural(n, { one: '1 exercise', other: `${f.num(n)} exercises` }),
	sessions: (n: number) => f.plural(n, { one: '1 session', other: `${f.num(n)} sessions` }),
	routines: (n: number) => f.plural(n, { one: '1 routine', other: `${f.num(n)} routines` }),
	learnedNames: (n: number) =>
		f.plural(n, { one: '1 learned name', other: `${f.num(n)} learned names` }),
	/** "10 kg", "2.5 kg" — and "2,5 kg" wherever the locale uses a comma. */
	kg: (n: number) => `${f.num(Number(n.toFixed(2)))} kg`,
	/** The bare number, for the last-time line where the unit was already said. */
	kgBare: (n: number) => f.num(Number(n.toFixed(2))),
	megabytes: (n: number) => `${f.num(n, { maximumFractionDigits: 1 })} MB`,
	percent: (n: number) => f.num(n / 100, { style: 'percent' }),
	amrap: 'as many as possible',
	perSide: 'per side',
	left: 'left',
	right: 'right',
	restAfter: (seconds: number) => `${f.num(seconds)} s rest`,
	setOf: (n: number, total: number) => `Set ${f.num(n)} of ${f.num(total)}`,
	roundOf: (n: number, total: number) => `Round ${f.num(n)} of ${f.num(total)}`,
	/** "3 × " in front of a target; empty for a single set. */
	setsPrefix: (n: number) => (n > 1 ? `${f.num(n)} × ` : ''),
	atLoad: (load: string) => ` at ${load}`,
	date: f.date,
	dateTime: f.dateTime,
	num: f.num,
	list: f.list,
	plural: f.plural
};
