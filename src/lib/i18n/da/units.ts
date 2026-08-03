import { formatters } from '../format.js';

const f = formatters('da-DK');

/**
 * Danske mængdeangivelser.
 *
 * Bemærk `sets`: dansk «sæt» er ens i ental og flertal, hvilket er præcis den
 * slags detalje de 21 håndskrevne `n === 1 ? '' : 's'` ikke kunne udtrykke.
 */
export const units = {
	seconds: (n: number) => `${f.num(n)} s`,
	reps: (n: number) => f.plural(n, { one: '1 rep', other: `${f.num(n)} reps` }),
	repsRange: (min: number, max: number) => `${f.num(min)}–${f.num(max)} reps`,
	sets: (n: number) => `${f.num(n)} sæt`,
	exercises: (n: number) => f.plural(n, { one: '1 øvelse', other: `${f.num(n)} øvelser` }),
	sessions: (n: number) => f.plural(n, { one: '1 træning', other: `${f.num(n)} træninger` }),
	routines: (n: number) => f.plural(n, { one: '1 rutine', other: `${f.num(n)} rutiner` }),
	learnedNames: (n: number) =>
		f.plural(n, { one: '1 lært navn', other: `${f.num(n)} lærte navne` }),
	kg: (n: number) => `${f.num(Number(n.toFixed(2)))} kg`,
	kgBare: (n: number) => f.num(Number(n.toFixed(2))),
	megabytes: (n: number) => `${f.num(n, { maximumFractionDigits: 1 })} MB`,
	amrap: 'så mange som muligt',
	perSide: 'pr. side',
	left: 'venstre',
	right: 'højre',
	restAfter: (seconds: number) => `${f.num(seconds)} s pause`,
	setOf: (n: number, total: number) => `Sæt ${f.num(n)} af ${f.num(total)}`,
	roundOf: (n: number, total: number) => `Runde ${f.num(n)} af ${f.num(total)}`,
	setsPrefix: (n: number) => (n > 1 ? `${f.num(n)} × ` : ''),
	atLoad: (load: string) => ` med ${load}`,
	date: f.date,
	dateTime: f.dateTime,
	num: f.num,
	list: f.list
};
