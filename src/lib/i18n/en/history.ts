import { formatters } from '../format.js';

const f = formatters('en-GB');

export const history = {
	title: 'History',
	empty: 'No sessions yet.',
	emptyHint: 'Every set you log will be listed here.',
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
	unfinished: 'unfinished',
	correctedTag: 'corrected',
	sets: 'sets',

	// ------------------------------------------------------------- the session
	gone: 'That session is no longer here.',
	nothingLogged: 'Nothing was logged in this session.',
	tapToCorrect: 'Tap a set to correct it.',
	setNumber: (n: number) => `Set ${f.num(n)}`,
	setWithSide: (n: number, side: string) => `Set ${f.num(n)}, ${side}`,
	skipped: 'skipped',
	rpe: (n: number) => `RPE ${f.num(n)}`,
	skippedCheckbox: 'Skipped — I did not do this set',
	seconds: 'Seconds',
	reps: 'Reps',
	loadKg: 'Load kg',
	rpeLabel: 'RPE',
	removeSet: 'Remove set',
	note: 'Note',
	notePlaceholder: 'How did it go?',
	saveNote: 'Save note',
	deleteSession: 'Delete this session',
	deleteAlsoStats: 'Deleting removes it from the statistics too.',

	// ---------------------------------------------- what `session/edit.ts` says
	corrected: (iso: string) =>
		`Corrected by hand on ${f.date(iso, { day: 'numeric', month: 'long' })}`,
	notFinished:
		'This session was never finished. Resume it or delete it — correcting it while the player could still be counting its sets would lose your place.',
	noSuchSet: (index: number) => `There is no set ${f.num(index)} in this session.`,
	needsAmount: 'A set that was done needs either reps or seconds. Skip it instead.',
	repsWhole: 'Reps have to be a whole number, one or more.',
	secondsWhole: 'Seconds have to be a whole number, one or more.',
	loadPositive: 'A load is a positive number of kilograms, or nothing at all.',
	rpeRange: 'RPE runs from 1 to 10.',

	// ------------------------------------------------ what `last-time.ts` says
	earlierToday: 'earlier today',
	yesterday: 'yesterday',
	daysAgo: (n: number) => `${f.num(n)} days ago`,
	shortDate: (iso: string, sameYear: boolean) =>
		f.date(iso, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
};
