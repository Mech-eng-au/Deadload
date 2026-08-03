import { formatters } from '../format.js';

const f = formatters('en-GB');

export const stats = {
	title: 'Statistics',
	empty: 'Nothing logged yet.',
	emptyHint: 'Finish a session and the numbers start here.',
	goToRoutines: 'Go to routines',

	sessions: 'sessions',
	setsLogged: 'sets logged',
	dayStreak: 'day streak',
	bestStreak: (n: number) => ` · best ${f.num(n)}`,
	reps: 'reps',
	heldFor: (duration: string) => ` · ${duration} held`,

	activity: 'Activity',
	weeksAgo: (n: number) => `${f.num(n)} weeks ago`,
	less: 'less',
	more: 'more',
	daySets: (date: string, sets: number) =>
		`${date} — ${f.plural(sets, { one: '1 set', other: `${f.num(sets)} sets` })}`,

	sessionsPerWeek: 'Sessions per week',
	thisWeek: 'this week',

	recentSessions: 'Recent sessions',
	seeAll: 'See all',
	sessionLine: (date: string, sets: number) =>
		`${date} · ${f.plural(sets, { one: '1 set', other: `${f.num(sets)} sets` })}`,

	setsPerMuscle: 'Sets per muscle group',
	muscleLine: (sets: number, reps: number, kgReps: number) =>
		f.plural(sets, { one: '1 set', other: `${f.num(sets)} sets` }) +
		(reps ? ` · ${f.num(reps)} reps` : '') +
		(kgReps ? ` · ${f.num(Math.round(kgReps))} kg·reps` : ''),
	topTen: (total: number) => `Showing the top 10 of ${f.num(total)}.`,

	loadedWork: 'Loaded work',
	loadedWorkIntro:
		'Kilogram-reps per week, from sets done with a dumbbell or kettlebell. Counted apart from everything above, because there is no unit in which a plank and a 10 kg row add up.',
	loadedWeekTitle: (label: string, kgReps: number, sets: number) =>
		`${label}: ${f.num(Math.round(kgReps))} kg·reps, ${f.num(sets)} loaded sets`,
	thisWeekLoaded: (kgReps: number, sets: number, heaviest: string | null) =>
		`This week: ${f.num(Math.round(kgReps))} kg·reps over ` +
		f.plural(sets, { one: '1 loaded set', other: `${f.num(sets)} loaded sets` }) +
		(heaviest ? `, heaviest ${heaviest}` : '') +
		'.',

	byExercise: 'By exercise',
	exerciseLine: (sets: number, best: string, load: string | null) =>
		`${f.plural(sets, { one: '1 set', other: `${f.num(sets)} sets` })} · best ${best}` +
		(load ? ` at ${load}` : ''),
	totalReps: 'Total reps:',
	timeHeld: 'Time held:',
	heaviest: 'Heaviest:',
	kgReps: 'Kg·reps:',
	sessionCount: 'Sessions:',
	/**
	 * §17.2 requires this to be labelled for what it is: a data-quality heuristic
	 * inferred from the 1RM familiarisation literature, not a measured fact about
	 * bodyweight reps. "So the numbers settle" is true; "to maximise adaptation"
	 * would not be.
	 */
	calibrating: (n: number) =>
		`The first ${n} sessions on a new exercise are shown pale and left out of the trend, so the numbers settle.`,
	last: 'Last:',

	routinesUsed: 'Routines used',
	timesUsed: (n: number) => `${f.num(n)}×`,
	neverUsed: 'Anything missing from this list has never been used.',

	skipped: (n: number) =>
		f.plural(n, {
			one: '1 set skipped and recorded as such.',
			other: `${f.num(n)} sets skipped and recorded as such.`
		}),

	/** "45 s" under a minute, "3 min" over it. */
	duration: (seconds: number) =>
		seconds < 60 ? `${f.num(seconds)} s` : `${f.num(Math.round(seconds / 60))} min`
};
