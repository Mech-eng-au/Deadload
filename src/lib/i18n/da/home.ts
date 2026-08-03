import { formatters } from '../format.js';

const f = formatters('da-DK');

export const home = {
	title: 'Rutiner',
	newRoutine: 'Ny rutine',
	resumeQuestion: 'Fortsæt træning?',
	setsLogged: (n: number) => `${f.num(n)} sæt noteret`,
	resume: 'Fortsæt',
	discard: 'Kassér',
	empty: 'Ingen rutiner endnu.',
	emptyHint: 'Start fra en indbygget rutine, byg din egen, eller importér en.',
	browsePresets: 'Se de indbyggede rutiner',
	buildOne: 'Byg en rutine',
	presetsCard: 'Indbyggede rutiner',
	presetsCardHint: 'Ni at starte fra',
	importCard: 'Importér',
	importCardHint: 'Fra JSON eller CSV',
	catalogCard: 'øvelser i kataloget, alle sammen med billeder'
};

export const presets = {
	title: 'Indbyggede rutiner',
	notMedicalAdvice: 'Det er almindelige træningsrutiner, ikke lægelig rådgivning.',
	unreadable: 'De indbyggede rutiner kunne ikke læses.',
	needMatching: (n: number) => `${f.num(n)} mangler at blive matchet`,
	usesUnticked: (equipment: string) =>
		`Bruger ${equipment}, som du ikke har sat kryds ved i Indstillinger. Den tilføjes komplet alligevel.`,
	add: 'Føj til mine rutiner',
	adding: 'Tilføjer…'
};

export const about = {
	title: 'Om',
	blurb:
		'Deadload er en lokal træningsapp til kropsvægtstræning. Alle data bliver på denne enhed. Opkaldt efter det konstruktionstekniske ord for en konstruktions egenvægt — i calisthenics er den eneste vægt dig selv.',
	sources: 'Kilder og licenser',
	license: (name: string) => `Licens: ${name}`,
	publicDomain: 'Public domain',
	by: (author: string) => `· af ${author}`,
	exerciseCount: (n: number) => f.plural(n, { one: '1 øvelse', other: `${f.num(n)} øvelser` }),
	origin: 'kilde',
	shareAlike:
		'Delt under samme licens, med ændringer: farvet om og forenklet, med vores egne markeringer tegnet ovenpå.',
	notMedicalAdvice:
		'Indbyggede rutiner er almindeligt træningsindhold og ikke lægelig rådgivning.'
};
