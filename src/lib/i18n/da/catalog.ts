import { formatters } from '../format.js';

const f = formatters('da-DK');

export const catalog = {
	title: 'Katalog',
	search: (n: number) => `Søg blandt ${f.num(n)} øvelser…`,
	all: 'alle',
	categories: {
		strength: 'styrke',
		stretch: 'udstrækning',
		mobility: 'mobilitet',
		core: 'core',
		cardio: 'kondition'
	},
	levels: {
		beginner: 'begynder',
		intermediate: 'øvet',
		advanced: 'avanceret'
	},
	shown: (n: number) => `${f.num(n)} vist`,
	needEquipment: (n: number) => `${f.num(n)} kræver udstyr, du ikke har sat kryds ved`,
	nothingMatches: 'Ingenting passer. Prøv et andet navn — eller ryd kategorifilteret.',
	moreHidden: (n: number) => `${f.num(n)} flere er skjult, indtil du sætter kryds ved udstyret.`
};

export const exercise = {
	howToDoIt: 'Sådan gør du',
	instructionsInEnglish: 'Trin for trin-anvisningerne er på engelsk, fra øvelseskataloget.',
	progression: 'Progression',
	needsEquipment: (equipment: string) =>
		`Kræver ${equipment}, som du ikke har sat kryds ved.`,
	tickInSettings: 'Sæt kryds i Indstillinger',
	swapPhoto: 'Skift billede, dobbelttryk for at afspille',
	playing: 'afspiller · dobbelttryk for at stoppe',
	frameOf: (n: number, total: number) => `${n}/${total} · dobbelttryk for at afspille`,
	notFound: 'Den øvelse findes ikke i kataloget.'
};
