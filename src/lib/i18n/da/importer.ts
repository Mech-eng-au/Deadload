import { formatters } from '../format.js';

const f = formatters('da-DK');

export const importer = {
	title: 'Importér en rutine',
	dropHere: 'Slip en .json- eller .csv-fil her',
	chooseFile: 'Vælg en fil',
	orPaste: 'Eller indsæt teksten',
	pastePlaceholder: '{ "name": "Morgenmobilitet", "blocks": [ … ] }',
	readIt: 'Læs den',
	fencesFine: 'Markdown-kodehegn omkring JSON-en er fint, de bliver fjernet.',
	orPreset: 'Eller start fra en indbygget rutine →',

	llmSummary: 'Få en rutine fra en sprogmodel',
	llmIntro:
		'Kopiér prompten nedenfor, vedhæft katalogfilen så den kun bruger øvelser du har, og indsæt svaret her.',
	llmBuiltFrom: (count: number) =>
		`Begge er bygget ud fra det du har: ${f.num(count)} øvelser, udstyr`,
	llmChangeInSettings: '. Skift det i Indstillinger og hent igen.',
	copyPrompt: 'Kopiér prompt',
	copied: 'Kopieret',
	catalogFile: 'Katalogfil',
	promptLanguageLine: (language: string) =>
		`Write the routine's name, goal, description and notes in ${language}. Leave every field name and every exercise id exactly as they are.`,

	readyCount: (n: number) => f.plural(n, { one: '1 øvelse klar.', other: `${f.num(n)} øvelser klar.` }),
	stillNeedMatch: (n: number) =>
		f.plural(n, {
			one: '1 mangler stadig et match.',
			other: `${f.num(n)} mangler stadig et match.`
		}),
	circuit: 'cirkel',
	matchedFrom: (written: string) => `matchet ud fra “${written}”`,
	needsEquipment: (equipment: string) =>
		`Kræver ${equipment} — ikke sat kryds ved i Indstillinger. Importeret alligevel.`,
	loadDropped: (kg: number) =>
		`Filen satte ${f.num(kg)} kg på denne. Den laves ikke med vægt, så vægten droppes.`,
	notExact: 'Ikke et præcist match. Vælg en:',
	notInCatalog: 'Ikke i kataloget. Vælg den nærmeste, eller drop den.',
	searchCatalog: 'Søg i kataloget',
	dropIt: 'Drop den',
	keepAfterAll: 'Behold den alligevel',
	rememberMeans: (written: string) => `Husk at “${written}” betyder den her`,
	startOver: 'Start forfra med en anden fil',
	saveRoutine: 'Gem rutine',
	matchFirst: (n: number) =>
		f.plural(n, {
			one: 'Match eller drop den 1 fremhævede øvelse først.',
			other: `Match eller drop de ${f.num(n)} fremhævede øvelser først.`
		}),
	pickerTitle: 'Vælg en øvelse',
	pickerSearch: (n: number) => `Søg blandt ${f.num(n)} øvelser…`
};
