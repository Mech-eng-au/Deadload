import { formatters } from '../format.js';

const f = formatters('da-DK');

export const stats = {
	title: 'Statistik',
	empty: 'Ingenting noteret endnu.',
	emptyHint: 'Gør en træning færdig, så begynder tallene her.',
	goToRoutines: 'Gå til rutiner',

	sessions: 'træninger',
	setsLogged: 'sæt noteret',
	dayStreak: 'dage i træk',
	bestStreak: (n: number) => ` · bedste ${f.num(n)}`,
	reps: 'reps',
	heldFor: (duration: string) => ` · ${duration} holdt`,

	activity: 'Aktivitet',
	weeksAgo: (n: number) => `for ${f.num(n)} uger siden`,
	less: 'mindre',
	more: 'mere',
	daySets: (date: string, sets: number) => `${date} — ${f.num(sets)} sæt`,

	sessionsPerWeek: 'Træninger pr. uge',
	thisWeek: 'denne uge',

	recentSessions: 'Seneste træninger',
	seeAll: 'Se alle',
	sessionLine: (date: string, sets: number) => `${date} · ${f.num(sets)} sæt`,

	setsPerMuscle: 'Sæt pr. muskelgruppe',
	muscleLine: (sets: number, reps: number, kgReps: number) =>
		`${f.num(sets)} sæt` +
		(reps ? ` · ${f.num(reps)} reps` : '') +
		(kgReps ? ` · ${f.num(Math.round(kgReps))} kg·reps` : ''),
	topTen: (total: number) => `Viser de øverste 10 af ${f.num(total)}.`,

	loadedWork: 'Arbejde med vægt',
	loadedWorkIntro:
		'Kilo-reps pr. uge, fra sæt lavet med en håndvægt eller kettlebell. Talt for sig selv, adskilt fra alt ovenfor, fordi der ikke findes en enhed hvor en planke og en roning med 10 kg lægges sammen.',
	loadedWeekTitle: (label: string, kgReps: number, sets: number) =>
		`${label}: ${f.num(Math.round(kgReps))} kg·reps, ${f.num(sets)} sæt med vægt`,
	thisWeekLoaded: (kgReps: number, sets: number, heaviest: string | null) =>
		`Denne uge: ${f.num(Math.round(kgReps))} kg·reps over ${f.num(sets)} sæt med vægt` +
		(heaviest ? `, tungeste ${heaviest}` : '') +
		'.',

	byExercise: 'Pr. øvelse',
	exerciseLine: (sets: number, best: string, load: string | null) =>
		`${f.num(sets)} sæt · bedste ${best}` + (load ? ` med ${load}` : ''),
	totalReps: 'Reps i alt:',
	timeHeld: 'Tid holdt:',
	heaviest: 'Tungeste:',
	kgReps: 'Kg·reps:',
	sessionCount: 'Træninger:',
	calibrating: (n: number) =>
		`De første ${n} træninger med en ny øvelse vises blegt og tælles ikke med i kurven, så tallene kan falde til ro.`,
	last: 'Sidst:',

	routinesUsed: 'Rutiner brugt',
	timesUsed: (n: number) => `${f.num(n)}×`,
	neverUsed: 'Alt hvad der mangler på denne liste er aldrig blevet brugt.',

	skipped: (n: number) => `${f.num(n)} sæt sprunget over og noteret som sådan.`,

	duration: (seconds: number) =>
		seconds < 60 ? `${f.num(seconds)} s` : `${f.num(Math.round(seconds / 60))} min`
};
