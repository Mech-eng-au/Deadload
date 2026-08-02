import { formatters } from '../format.js';

const f = formatters('en-GB');

export const home = {
	title: 'Routines',
	newRoutine: 'New routine',
	resumeQuestion: 'Resume session?',
	setsLogged: (n: number) => f.plural(n, { one: '1 set logged', other: `${f.num(n)} sets logged` }),
	resume: 'Resume',
	discard: 'Discard',
	empty: 'No routines yet.',
	emptyHint: 'Start from a built-in routine, build your own, or import one.',
	browsePresets: 'Browse built-in routines',
	buildOne: 'Build a routine',
	presetsCard: 'Built-in routines',
	presetsCardHint: 'Nine to start from',
	importCard: 'Import',
	importCardHint: 'From JSON or CSV',
	catalogCard: 'exercises in the catalog, every one with images'
};

export const presets = {
	title: 'Built-in routines',
	notMedicalAdvice: 'These are general training routines, not medical advice.',
	unreadable: 'The built-in routines could not be read.',
	needMatching: (n: number) => `${f.num(n)} need matching`,
	usesUnticked: (equipment: string) =>
		`Uses ${equipment}, which you have not ticked in Settings. It is added complete either way.`,
	add: 'Add to my routines',
	adding: 'Adding…'
};

export const about = {
	title: 'About',
	blurb:
		"Deadload is a local-first bodyweight training app. All data stays on this device. Named for the structural engineering term for a structure's own self-weight — in calisthenics the only load is you.",
	sources: 'Sources and licences',
	license: (name: string) => `License: ${name}`,
	publicDomain: 'Public domain',
	by: (author: string) => `· by ${author}`,
	exerciseCount: (n: number) => f.plural(n, { one: '1 exercise', other: `${f.num(n)} exercises` }),
	shareAlike:
		'Shared under the same licence, with changes: recoloured and simplified, with our own highlights drawn over it.',
	notMedicalAdvice:
		'Built-in routines, when they arrive, are general training content and not medical advice.'
};
