import { formatters } from '../format.js';

const f = formatters('da-DK');

export const session = {
	fallbackTitle: 'Træning',
	gone: 'Den træning findes ikke længere.',
	leave: '← Forlad',
	setsAcross: (sets: number, exercises: number) =>
		`${f.num(sets)} sæt fordelt på ` +
		`${f.plural(exercises, { one: '1 øvelse', other: `${f.num(exercises)} øvelser` })}.`,
	stayAwake:
		'Skærmen bliver tændt hele træningen igennem, og pausetimeren bipper. Tryk start med lyden skruet op.',
	start: 'Start',

	finished: 'Færdig.',
	totals: { sets: 'Sæt', exercises: 'Øvelser', minutes: 'Minutter' },
	swappedOne: 'Du byttede en øvelse.',
	swappedMany: (n: number) => `Du byttede ${f.num(n)} øvelser.`,
	keptIn: (routine: string) => `Gemt i ${routine}.`,
	keepIn: (routine: string) => `Gem i ${routine}`,
	keepHint: 'Ellers er rutinen uændret, og næste gang starter hvor den gjorde i dag.',
	notesPlaceholder: 'Noter til træningen (valgfrit)',

	lastTime: (when: string) => `Sidste gang, ${when}:`,
	startSet: 'Start sæt',
	startTimed: (clock: string) => `Start ${clock}`,
	startsWhenReadingOver: 'Starter når oplæsningen er slut',
	startingOnItsOwn: 'Starter af sig selv',
	backASet: '← Fortryd sæt',
	skipSet: 'Spring over',
	end: 'Slut',
	logSet: 'Notér sæt',
	addRpe: 'Tilføj RPE',
	hideRpe: 'Skjul RPE',
	rpe: 'RPE',
	oneFewer: 'En mindre',
	oneMore: 'En mere',
	lighter: 'Lettere',
	heavier: 'Tungere',
	noLoad: 'Ingen vægt',
	seconds: 'sekunder',
	reps: 'reps',
	easierTo: (name: string) => `Lettere: ${name}`,
	harderTo: (name: string) => `Sværere: ${name}`,
	easier: '↓ Lettere',
	harder: '↑ Sværere',

	paused: 'på pause — tryk for at fortsætte',
	timeLeft: 'tilbage · tryk for at pause',
	timeUp: 'tiden er gået — notér sættet',
	overTarget: 'over målet',

	rest: 'Pause',
	next: (name: string) => `Næste: ${name}`,
	minusFifteen: '−15 s',
	plusFifteen: '+15 s',
	skipRest: 'Spring pausen over',

	leaveQuestion: 'Forlad denne træning?',
	leaveHint: 'Den forbliver ufærdig, og forsiden tilbyder at tage den op igen.',
	leaveConfirm: 'Forlad',
	keepGoing: 'Fortsæt'
};

export const routine = {
	fallbackTitle: 'Rutine',
	gone: 'Den rutine findes ikke længere.',
	circuit: 'Cirkel',
	circuitRounds: (rounds: number, labelled: boolean) =>
		`· ${labelled ? 'cirkel, ' : ''}${f.plural(rounds, { one: '1 runde', other: `${f.num(rounds)} runder` })}`,
	approxMinutes: (n: number) => `~${f.num(n)} min`,
	startSession: 'Start træning',
	starting: 'Starter…',
	edit: 'Redigér rutine',
	print: 'Gem som PDF til print',
	printing: 'Laver PDF‑en…',
	printedShared: (filename: string, size: string) => `Gemte ${filename} (${size})`,
	printedLocal: (filename: string, size: string) =>
		`Skrevet til appens lager som ${filename} (${size})`,
	printFailed: (reason: string) => `Kunne ikke lave PDF‑en: ${reason}`,
	includePhotos: 'Tag billederne med — større fil, men du kan se bevægelsen',
	printHint: 'A4, med en rubrik til at skrive tallet i for hvert sæt.',
	deleteForGood: 'Slet for altid',
	keepIt: 'Behold den',
	delete: 'Slet rutine',

	newTitle: 'Ny rutine',
	editTitle: 'Redigér rutine',
	namePlaceholder: 'Navn',
	descriptionPlaceholder: 'Beskrivelse (valgfrit)',
	goalPlaceholder: 'Mål (valgfrit)',
	sectionPlaceholder: 'Afsnittets navn',
	addSection: 'Tilføj et afsnit',
	addExercise: 'Tilføj en øvelse',
	removeSection: 'Fjern afsnit',
	remove: 'Fjern',
	setsLabel: 'Sæt',
	restLabel: 'Pause (s)',
	targetLabel: 'Mål',
	notesLabel: 'Noter',
	loadLabel: 'Vægt (kg)',
	perSideLabel: 'Pr. side',
	circuitLabel: 'Cirkel',
	targetKinds: {
		reps: 'Reps',
		reps_range: 'Rep-interval',
		duration: 'Sekunder',
		amrap: 'Så mange som muligt'
	},
	cancelDiscards: 'Annullér — ugemte ændringer kasseres',
	saveRoutine: 'Gem rutine',
	nameRequired: 'Giv rutinen et navn først.',
	emptyEditor: 'Der er ikke noget i den endnu. Tilføj en øvelse for at komme i gang.',
	moveUp: 'Flyt op',
	moveDown: 'Flyt ned',
	dragHandle: (name: string) => `Flyt ${name}`
};
