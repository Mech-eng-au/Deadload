import { formatters } from '../format.js';

const f = formatters('da-DK');

export const history = {
	title: 'Historik',
	empty: 'Ingen træninger endnu.',
	emptyHint: 'Hvert sæt du noterer bliver vist her.',
	month: (iso: string) => f.date(iso, { month: 'long', year: 'numeric' }),
	day: (iso: string) => f.date(iso, { weekday: 'short', day: 'numeric', month: 'short' }),
	fullDate: (iso: string) =>
		f.dateTime(iso, {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			hour: '2-digit',
			minute: '2-digit'
		}),
	minutes: (n: number) => `· ${f.num(n)} min`,
	unfinished: 'ufærdig',
	correctedTag: 'rettet',
	sets: 'sæt',

	gone: 'Den træning findes ikke længere.',
	nothingLogged: 'Der blev ikke noteret noget i denne træning.',
	tapToCorrect: 'Tryk på et sæt for at rette det.',
	setNumber: (n: number) => `Sæt ${f.num(n)}`,
	setWithSide: (n: number, side: string) => `Sæt ${f.num(n)}, ${side}`,
	skipped: 'sprunget over',
	rpe: (n: number) => `RPE ${f.num(n)}`,
	skippedCheckbox: 'Sprunget over — jeg lavede ikke dette sæt',
	seconds: 'Sekunder',
	reps: 'Reps',
	loadKg: 'Vægt kg',
	rpeLabel: 'RPE',
	removeSet: 'Fjern sæt',
	note: 'Note',
	notePlaceholder: 'Hvordan gik det?',
	saveNote: 'Gem note',
	deleteSession: 'Slet denne træning',
	deleteAlsoStats: 'Sletning fjerner den også fra statistikken.',

	corrected: (iso: string) =>
		`Rettet i hånden den ${f.date(iso, { day: 'numeric', month: 'long' })}`,
	notFinished:
		'Denne træning blev aldrig gjort færdig. Fortsæt den eller slet den — at rette den mens afspilleren stadig kunne være i gang med at tælle sæt ville miste din plads.',
	noSuchSet: (index: number) => `Der er ikke noget sæt ${f.num(index)} i denne træning.`,
	needsAmount: 'Et sæt der blev lavet skal have enten reps eller sekunder. Spring det over i stedet.',
	repsWhole: 'Reps skal være et helt tal, ét eller derover.',
	secondsWhole: 'Sekunder skal være et helt tal, ét eller derover.',
	loadPositive: 'En vægt er et positivt antal kilo, eller ingenting.',
	rpeRange: 'RPE går fra 1 til 10.',

	earlierToday: 'tidligere i dag',
	yesterday: 'i går',
	daysAgo: (n: number) => `for ${f.num(n)} dage siden`,
	shortDate: (iso: string, sameYear: boolean) =>
		f.date(iso, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
};
