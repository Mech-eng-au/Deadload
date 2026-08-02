import { formatters } from '../format.js';

const f = formatters('en-GB');

export const settings = {
	title: 'Settings',

	backupDue: (n: number) => `You have ${f.num(n)} sessions logged.`,
	backupDueHint: 'Worth exporting a backup — it all lives on this phone and nowhere else.',

	// ------------------------------------------------------------- language
	language: 'Language',
	languageIntro:
		'The interface, the built-in routines and the printable sheet. Exercise names and their step-by-step cues stay in English, because the catalog they come from is English.',
	followDevice: 'Follow the phone',
	followDeviceHint: (resolved: string) => `Your phone is set to ${resolved}.`,
	spokenStaysEnglish:
		'Announcements stay in English whatever you choose here: the exercise names being read out are English, and a Danish voice reading English words is worse than an English one.',

	// ------------------------------------------------------------ equipment
	whatYouOwn: 'What you own',
	whatYouOwnIntro:
		'Tick what you have. Unticked equipment is left out of the catalog and out of the exercise picker, so you are only ever offered what you can actually do.',
	availableCount: (available: number, total: number) =>
		`${f.num(available)} of ${f.num(total)} exercises available.`,
	nothingTicked:
		'Nothing ticked, so that is everything you can do with a floor, a wall and a chair.',
	gatingScope:
		'This only changes what you get offered. A routine you already have, anything you have logged, and the built-in routines all keep every exercise in them — with a note about what they need.',

	// ---------------------------------------------------------------- sound
	sound: 'Sound',
	soundIntro:
		'Cues during a session: when a timed set starts, the last three seconds, time being up, a set logged, and the end of the workout. Without them you have to watch the screen.',
	sessionSounds: 'Session sounds',
	speechIntro:
		'The tones say that something changed. Speech says what: the next exercise, its set and its target, spoken as the rest starts. It is the last reason to look at the phone mid-workout.',
	speakNext: 'Speak the next exercise',
	noSpeechEngine: 'This device has no speech engine, so there is nothing to turn on.',

	// ------------------------------------------------------------ auto mode
	autoMode: 'Auto mode',
	autoModeIntro:
		'Normally the app waits for you at every set. These two hand it the parts it can be sure about. They work independently, and take effect on the next session you start.',
	autoStart: 'Start sets by itself',
	autoStartHint:
		'The set begins once the announcement has been read, instead of waiting for Start.',
	autoLog: 'Log timed sets by itself',
	autoLogHint:
		'A hold logs its target at zero and moves on. Overtime is not recorded in this mode, and reps sets are untouched — the app cannot see you finish those.',

	// --------------------------------------------------------------- backup
	backup: 'Backup',
	backupIntro:
		'One file with every routine, every logged session, your learned exercise names and your settings.',
	exportBackup: 'Export backup',
	preparing: 'Preparing…',
	wrote: (what: string) => `Wrote ${what}`,
	savedToAppStorage: (filename: string) => `${filename} (saved to app storage)`,
	exportCsv: 'Export sets as CSV',
	exportHint: 'The JSON restores the app. The CSV is one row per set, for reading in a spreadsheet.',
	lastExport: (when: string) => `Last export: ${when}`,
	neverExported: 'Never exported.',
	backupFailed: 'The backup could not be written.',
	csvFailed: 'The CSV could not be written.',

	// -------------------------------------------------------------- restore
	restore: 'Restore',
	restoreIntro:
		'Read a backup file back in. You choose whether to merge it with what is here or replace everything.',
	chooseBackup: 'Choose a backup file',
	fileHolds: (routines: string, sessions: string, names: string) =>
		`${routines}, ${sessions}, ${names}.`,
	exportedOn: (when: string) => `Exported ${when}`,
	merge: 'Merge into what is here',
	replace: 'Replace everything',
	restoreHint:
		"Merge keeps what is on this phone, adds anything missing, and updates a routine only when the file's copy is newer. Replace deletes everything here first.",
	restored: 'Restored.',
	routinesAdded: (added: number, updated: number, skipped: number) =>
		`${f.num(added)} routines added, ${f.num(updated)} updated` +
		(skipped ? `, ${f.num(skipped)} already current` : ''),
	sessionsAdded: (added: number, skipped: number) =>
		`${f.num(added)} sessions added` + (skipped ? `, ${f.num(skipped)} already here` : ''),
	aliasesAdded: (n: number) => `${f.num(n)} learned names added`,
	restoreFailed: 'The restore failed part way.',

	// -------------------------------------------------------------- storage
	storage: 'Storage',
	persistent: 'Your data is marked as persistent.',
	persistentHint:
		'Android will not clear it automatically when the device runs low on space. Uninstalling the app still deletes everything, so keep a backup.',
	notPersistent: 'Your data is stored, but not marked as persistent.',
	notPersistentHint:
		'It survives restarts, but the system may clear it if the device runs very low on space. Export a backup.',

	// ----------------------------------------------------------------- data
	data: 'Data',
	routines: 'Routines',
	sessions: 'Sessions',
	learnedNames: 'Learned names',
	spaceUsed: 'Space used',
	databaseVersion: 'Database version',
	appBuild: 'App build',
	staysOnDevice: 'Everything stays on this device.',
	aboutLink: 'About and attribution'
};
