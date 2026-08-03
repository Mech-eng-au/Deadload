import { formatters } from '../format.js';

const f = formatters('da-DK');

export const settings = {
	title: 'Indstillinger',

	backupDue: (n: number) => `Du har ${f.num(n)} træninger noteret.`,
	backupDueHint:
		'Værd at tage en sikkerhedskopi — det hele ligger på denne telefon og ingen andre steder.',

	language: 'Sprog',
	languageIntro:
		'Brugerfladen, de indbyggede rutiner og printarket. Øvelsernes navne og deres trin for trin-anvisninger bliver på engelsk, fordi kataloget de kommer fra er engelsk.',
	followDevice: 'Følg telefonen',
	followDeviceHint: (resolved: string) => `Din telefon er sat til ${resolved}.`,
	spokenStaysEnglish:
		'Oplæsningen bliver på engelsk uanset hvad du vælger her: øvelsesnavnene der læses op er engelske, og en dansk stemme der læser engelske ord op er værre end en engelsk.',

	handleSide: 'Flyttegreb',
	handleSideIntro:
		'Hvilken side af en øvelse grebet sidder på, når du sætter en rutine i rækkefølge. Sæt det der hvor din tommelfinger allerede er.',
	handleLeft: 'Venstre',
	handleRight: 'Højre',
	handleSideHint:
		'Det flytter kun grebet. Fjern-knappen bliver i højre side, så de to aldrig er under den samme tommelfinger.',

	whatYouOwn: 'Hvad du har',
	whatYouOwnIntro:
		'Sæt kryds ved det du har. Udstyr uden kryds bliver holdt ude af kataloget og ude af øvelsesvælgeren, så du kun bliver tilbudt det du faktisk kan lave.',
	availableCount: (available: number, total: number) =>
		`${f.num(available)} af ${f.num(total)} øvelser tilgængelige.`,
	nothingTicked:
		'Ingen kryds, så det er alt hvad du kan lave med et gulv, en væg og en stol.',
	gatingScope:
		'Det ændrer kun hvad du bliver tilbudt. En rutine du allerede har, alt hvad du har noteret, og de indbyggede rutiner beholder alle deres øvelser — med en bemærkning om hvad de kræver.',

	sound: 'Lyd',
	soundIntro:
		'Signaler undervejs: når et sæt på tid starter, de sidste tre sekunder, tiden der er gået, et sæt noteret, og slutningen af træningen. Uden dem skal du holde øje med skærmen.',
	sessionSounds: 'Lyde under træning',
	speechIntro:
		'Tonerne siger at noget ændrede sig. Tale siger hvad: den næste øvelse, dens sæt og dens mål, læst op når pausen begynder. Det er den sidste grund til at kigge på telefonen midt i træningen.',
	speakNext: 'Læs den næste øvelse op',
	noSpeechEngine: 'Denne enhed har ingen talemotor, så der er ikke noget at slå til.',

	autoMode: 'Automatik',
	autoModeIntro:
		'Normalt venter appen på dig ved hvert sæt. De her to overlader den de dele, den kan være sikker på. De virker uafhængigt, og træder i kraft ved næste træning du starter.',
	autoStart: 'Start sæt af sig selv',
	autoStartHint:
		'Sættet begynder når oplæsningen er færdig, i stedet for at vente på Start.',
	autoLog: 'Notér sæt på tid af sig selv',
	autoLogHint:
		'Et hold noterer sit mål ved nul og går videre. Overtid bliver ikke registreret i denne tilstand, og sæt med reps bliver ikke rørt — appen kan ikke se dig lave dem færdige.',

	backup: 'Sikkerhedskopi',
	backupIntro:
		'Én fil med alle rutiner, alle noterede træninger, dine lærte øvelsesnavne og dine indstillinger.',
	exportBackup: 'Eksportér sikkerhedskopi',
	preparing: 'Forbereder…',
	wrote: (what: string) => `Skrev ${what}`,
	savedToAppStorage: (filename: string) => `${filename} (gemt i appens lager)`,
	exportCsv: 'Eksportér sæt som CSV',
	exportHint:
		'JSON-filen genskaber appen. CSV-filen er én række pr. sæt, til at læse i et regneark.',
	lastExport: (when: string) => `Seneste eksport: ${when}`,
	neverExported: 'Aldrig eksporteret.',
	backupFailed: 'Sikkerhedskopien kunne ikke skrives.',
	csvFailed: 'CSV-filen kunne ikke skrives.',

	restore: 'Gendan',
	restoreIntro:
		'Læs en sikkerhedskopi ind igen. Du vælger, om den skal flettes sammen med det der er her, eller erstatte det hele.',
	chooseBackup: 'Vælg en sikkerhedskopi',
	fileHolds: (routines: string, sessions: string, names: string) =>
		`${routines}, ${sessions}, ${names}.`,
	exportedOn: (when: string) => `Eksporteret ${when}`,
	merge: 'Flet ind i det der er her',
	replace: 'Erstat det hele',
	restoreHint:
		'Fletning beholder det der er på denne telefon, tilføjer det der mangler, og opdaterer kun en rutine når filens udgave er nyere. Erstat sletter alt her først.',
	restored: 'Gendannet.',
	routinesAdded: (added: number, updated: number, skipped: number) =>
		`${f.num(added)} rutiner tilføjet, ${f.num(updated)} opdateret` +
		(skipped ? `, ${f.num(skipped)} allerede ajour` : ''),
	sessionsAdded: (added: number, skipped: number) =>
		`${f.num(added)} træninger tilføjet` + (skipped ? `, ${f.num(skipped)} var her allerede` : ''),
	aliasesAdded: (n: number) => `${f.num(n)} lærte navne tilføjet`,
	restoreFailed: 'Gendannelsen gik galt undervejs.',

	storage: 'Lagring',
	persistent: 'Dine data er markeret som vedvarende.',
	persistentHint:
		'Android rydder dem ikke automatisk, når enheden er ved at løbe tør for plads. Afinstallerer du appen, slettes alt alligevel, så hold en sikkerhedskopi.',
	notPersistent: 'Dine data er gemt, men ikke markeret som vedvarende.',
	notPersistentHint:
		'De overlever genstart, men systemet kan rydde dem, hvis enheden løber meget lavt på plads. Tag en sikkerhedskopi.',

	data: 'Data',
	routines: 'Rutiner',
	sessions: 'Træninger',
	learnedNames: 'Lærte navne',
	spaceUsed: 'Plads brugt',
	databaseVersion: 'Databaseversion',
	appBuild: 'App-build',
	staysOnDevice: 'Alt bliver på denne enhed.',
	aboutLink: 'Om og kildeangivelser'
};
