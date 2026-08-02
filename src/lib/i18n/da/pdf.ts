import { formatters } from '../format.js';

const f = formatters('da-DK');

export const pdf = {
	needs: (equipment: string) => `Kræver: ${equipment}`,
	circuit: 'Cirkel',
	circuitRounds: (rounds: number) =>
		` — cirkel, ${f.plural(rounds, { one: '1 runde', other: `${f.num(rounds)} runder` })}`,
	page: (n: number) => `Side ${f.num(n)}`,
	restAfter: (seconds: number) => `${f.num(seconds)} s pause`,
	tempo: (value: string) => `tempo ${value}`,
	max: 'maks',
	printedOn: (iso: string | Date) => f.date(iso, { day: 'numeric', month: 'long', year: 'numeric' })
};
