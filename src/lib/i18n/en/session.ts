import { formatters } from '../format.js';

const f = formatters('en-GB');

export const session = {
	fallbackTitle: 'Session',
	gone: 'That session is no longer here.',
	leave: '← Leave',
	setsAcross: (sets: number, exercises: number) =>
		`${f.plural(sets, { one: '1 set', other: `${f.num(sets)} sets` })} across ` +
		`${f.plural(exercises, { one: '1 exercise', other: `${f.num(exercises)} exercises` })}.`,
	stayAwake:
		'The screen stays awake for the whole session, and the rest timer beeps. Press start with the volume up.',
	start: 'Start',

	// ---------------------------------------------------------------- finished
	finished: 'Done.',
	totals: { sets: 'Sets', exercises: 'Exercises', minutes: 'Minutes' },
	swappedOne: 'You swapped an exercise.',
	swappedMany: (n: number) => `You swapped ${f.num(n)} exercises.`,
	keptIn: (routine: string) => `Kept in ${routine}.`,
	keepIn: (routine: string) => `Keep in ${routine}`,
	keepHint: 'Otherwise the routine is unchanged and next time starts where it did today.',
	/**
	 * §17's progression offer. Bound by §17.5: no claim that the body has adapted,
	 * no plateau, no cross-exercise comparison, and no number the app did not
	 * measure. What it can say is what it saw — the sets that were logged.
	 */
	progress: {
		title: 'Ready for more?',
		clearedTwice: (name: string, target: string) =>
			`${name}: every set at ${target}, two sessions running.`,
		addRep: (target: string) => `Move up to ${target}`,
		nextRung: (next: string) => `Move on to ${next}`,
		nextRungWhy: (next: string) =>
			`${next} is the next rung on the same movement, and it starts easier than this one finished.`,
		/**
		 * About the catalog, never about the user (§17.1). The app has run out of
		 * variants; it knows nothing about anybody's limit.
		 */
		ladderEnd: (name: string) =>
			`That is as far as this app can take ${name} — it knows no harder version of the movement.`,
		notNow: 'Not now',
		ok: 'Got it',
		appliedTarget: (name: string, target: string) => `${name} is now ${target}.`,
		appliedRung: (next: string, target: string) => `Swapped in ${next}, starting at ${target}.`,
		dismissed: 'Not asking again for a couple of weeks.'
	},
	notesPlaceholder: 'Session notes (optional)',

	// ----------------------------------------------------------------- working
	lastTime: (when: string) => `Last time, ${when}:`,
	startSet: 'Start set',
	startTimed: (clock: string) => `Start ${clock}`,
	startsWhenReadingOver: 'Starts when the reading is over',
	startingOnItsOwn: 'Starting on its own',
	backASet: '← Back a set',
	skipSet: 'Skip set',
	end: 'End',
	logSet: 'Log set',
	addRpe: 'Add RPE',
	hideRpe: 'Hide RPE',
	rpe: 'RPE',
	oneFewer: 'One fewer',
	oneMore: 'One more',
	lighter: 'Lighter',
	heavier: 'Heavier',
	noLoad: 'No load',
	seconds: 'seconds',
	reps: 'reps',
	easierTo: (name: string) => `Easier: ${name}`,
	harderTo: (name: string) => `Harder: ${name}`,
	easier: '↓ Easier',
	harder: '↑ Harder',

	// -------------------------------------------------------------- the clock
	paused: 'paused — tap to resume',
	timeLeft: 'left · tap to pause',
	timeUp: 'time — log the set',
	overTarget: 'over the target',

	// ----------------------------------------------------------------- resting
	rest: 'Rest',
	next: (name: string) => `Next: ${name}`,
	minusFifteen: '−15 s',
	plusFifteen: '+15 s',
	skipRest: 'Skip rest',

	// ------------------------------------------------------------------ leaving
	leaveQuestion: 'Leave this session?',
	leaveHint: 'It stays unfinished, and the home screen will offer to pick it back up.',
	leaveConfirm: 'Leave',
	keepGoing: 'Keep going'
};

export const routine = {
	fallbackTitle: 'Routine',
	gone: 'That routine is no longer here.',
	circuit: 'Circuit',
	circuitRounds: (rounds: number, labelled: boolean) =>
		`· ${labelled ? 'circuit, ' : ''}${f.plural(rounds, { one: '1 round', other: `${f.num(rounds)} rounds` })}`,
	approxMinutes: (n: number) => `~${f.num(n)} min`,
	startSession: 'Start session',
	starting: 'Starting…',
	edit: 'Edit routine',
	print: 'Save as printable PDF',
	printing: 'Making the PDF…',
	printedShared: (filename: string, size: string) => `Saved ${filename} (${size})`,
	printedLocal: (filename: string, size: string) =>
		`Written to app storage as ${filename} (${size})`,
	printFailed: (reason: string) => `Could not make the PDF: ${reason}`,
	includePhotos: 'Include the photos — bigger file, but you can see the movement',
	printHint: 'A4, with a box to write the number in for every set.',
	deleteForGood: 'Delete for good',
	keepIt: 'Keep it',
	delete: 'Delete routine',

	// ------------------------------------------------------------- the editor
	newTitle: 'New routine',
	editTitle: 'Edit routine',
	namePlaceholder: 'Routine name',
	descriptionPlaceholder: 'Description (optional)',
	goalPlaceholder: 'Goal, e.g. hip flexibility',
	sectionPlaceholder: 'Section name, e.g. Warm-up',
	tagsPlaceholder: 'Tags, comma separated',
	circuitHint: 'Circuit — one set of each exercise, then the next round',
	removeExercise: 'Remove exercise',
	nameToSave: 'Give the routine a name to save it.',
	cancelEdit: '← Cancel',
	restLabelShort: 'Rest s',
	rangeTo: 'to',
	addSection: 'Add a section',
	addExercise: 'Add an exercise',
	removeSection: 'Remove section',
	remove: 'Remove',
	setsLabel: 'Sets',
	restLabel: 'Rest (s)',
	targetLabel: 'Target',
	notesPlaceholder: 'Notes (optional)',
	perSideLabel: 'Per side',
	targetKinds: {
		reps: 'Reps',
		reps_range: 'Rep range',
		duration: 'Seconds',
		amrap: 'As many as possible'
	},
	saveRoutine: 'Save routine',
	reorderExercises: 'Reorder exercises',
	reorderDone: 'Done',
	dragHandle: (name: string) => `Reorder ${name}`
};
