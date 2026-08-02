import { formatters } from '../format.js';

const f = formatters('en-GB');

/**
 * The printable sheet's own words (§8).
 *
 * A separate namespace from the screens even though several strings look alike,
 * because the sheet is read on paper by somebody who may not have the app open —
 * so it says "Needs:" where the app shows a chip, and it spells things out where
 * a screen can rely on context.
 *
 * Everything here has to be printable by the embedded font. `tests/pdf.test.ts`
 * walks every string in every locale and fails on any character Noto Sans
 * cannot draw, which is what makes "adding a language is a file" true of the
 * PDF as well as of the screens.
 */
export const pdf = {
	needs: (equipment: string) => `Needs: ${equipment}`,
	circuit: 'Circuit',
	circuitRounds: (rounds: number) =>
		` — circuit, ${f.plural(rounds, { one: '1 round', other: `${f.num(rounds)} rounds` })}`,
	page: (n: number) => `Page ${f.num(n)}`,
	restAfter: (seconds: number) => `${f.num(seconds)} s rest`,
	tempo: (value: string) => `tempo ${value}`,
	max: 'max',
	printedOn: (iso: string | Date) => f.date(iso, { day: 'numeric', month: 'long', year: 'numeric' })
};
