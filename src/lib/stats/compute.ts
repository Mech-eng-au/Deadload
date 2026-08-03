import type { Exercise, ExerciseId, Level, Session, SetEntry } from '../types.js';
import { calibratingSessions } from '../progress/calibration.js';

/**
 * Statistics (docs/SPEC.md §10). Derived entirely from the session log: no
 * aggregate store, no denormalization, until it measurably matters. Pure
 * functions over plain data, so every rule here is unit-testable.
 *
 * A session counts as completed once it has an endedAt. Unfinished sessions are
 * excluded from everything except the raw log.
 */

export function completed(sessions: Session[]): Session[] {
	return sessions.filter((s) => s.endedAt);
}

/** Local midnight of the ISO week (Monday) containing `date`. */
export function weekStart(date: Date): Date {
	const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
	const dayFromMonday = (d.getDay() + 6) % 7;
	d.setDate(d.getDate() - dayFromMonday);
	return d;
}

export function dayKey(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface WeekBucket {
	/** Monday of the week, local time. */
	start: Date;
	label: string;
	count: number;
}

/** Oldest first, including empty weeks so the chart has no gaps. */
export function sessionsPerWeek(sessions: Session[], weeks = 12, now = new Date()): WeekBucket[] {
	const thisWeek = weekStart(now);
	const buckets: WeekBucket[] = [];

	for (let i = weeks - 1; i >= 0; i--) {
		const start = new Date(thisWeek);
		start.setDate(start.getDate() - i * 7);
		buckets.push({
			start,
			label: `${start.getDate()}/${start.getMonth() + 1}`,
			count: 0
		});
	}

	const firstStart = buckets[0].start.getTime();
	for (const session of completed(sessions)) {
		const started = new Date(session.startedAt).getTime();
		if (started < firstStart) continue;
		const index = Math.floor((started - firstStart) / (7 * 24 * 60 * 60 * 1000));
		if (index >= 0 && index < buckets.length) buckets[index].count++;
	}

	return buckets;
}

export interface DayCell {
	date: Date;
	key: string;
	sessions: number;
	sets: number;
	/** Days after today, which are drawn as blanks rather than empty days. */
	future: boolean;
}

/**
 * Daily activity as columns of weeks, Monday at the top — the shape a calendar
 * heatmap wants. Empty days are present rather than omitted, because the gaps
 * are the informative part.
 */
export function activityCalendar(sessions: Session[], weeks = 16, now = new Date()): DayCell[][] {
	const counts = new Map<string, { sessions: number; sets: number }>();
	for (const session of completed(sessions)) {
		const key = dayKey(session.startedAt);
		const row = counts.get(key) ?? { sessions: 0, sets: 0 };
		row.sessions += 1;
		row.sets += session.entries.filter((e) => !e.skipped).length;
		counts.set(key, row);
	}

	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const firstMonday = weekStart(now);
	firstMonday.setDate(firstMonday.getDate() - (weeks - 1) * 7);

	const grid: DayCell[][] = [];
	for (let w = 0; w < weeks; w++) {
		const column: DayCell[] = [];
		for (let d = 0; d < 7; d++) {
			const date = new Date(firstMonday);
			date.setDate(date.getDate() + w * 7 + d);
			const key = dayKey(date.toISOString());
			const hit = counts.get(key);
			column.push({
				date,
				key,
				sessions: hit?.sessions ?? 0,
				sets: hit?.sets ?? 0,
				future: date.getTime() > today.getTime()
			});
		}
		grid.push(column);
	}
	return grid;
}

export interface SessionSummary {
	id: string;
	routineName: string;
	startedAt: string;
	/** Whole minutes, or undefined when the session was never finished. */
	minutes?: number;
	sets: number;
	skipped: number;
	reps: number;
	seconds: number;
	finished: boolean;
	/** Whether the log was corrected by hand (§4.3), so the list can say so too. */
	edited: boolean;
}

/** One line per session, for the history list. Newest first. */
export function summarize(sessions: Session[]): SessionSummary[] {
	return sessions
		.map((s) => {
			let sets = 0;
			let skipped = 0;
			let reps = 0;
			let seconds = 0;
			for (const entry of s.entries) {
				if (entry.skipped) skipped++;
				else {
					sets++;
					reps += entry.reps ?? 0;
					seconds += entry.seconds ?? 0;
				}
			}
			return {
				id: s.id,
				routineName: s.routineName,
				startedAt: s.startedAt,
				minutes: s.endedAt
					? Math.max(1, Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000))
					: undefined,
				sets,
				skipped,
				reps,
				seconds,
				finished: !!s.endedAt,
				edited: !!s.editedAt
			};
		})
		.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export interface FinishedTotals {
	/** Sets actually performed; skipped rows are not an achievement. */
	sets: number;
	/** Distinct exercises performed, which is what the routine promised. */
	exercises: number;
	/** Wall-clock length of the session, at least one minute. */
	minutes: number;
}

/**
 * The three numbers the finished screen shows large (§12). Wall clock rather
 * than the sum of the targets, because the time you spent is the time you
 * spent — rests, faffing and all.
 */
export function finishedTotals(session: Session, now = new Date()): FinishedTotals {
	const done = session.entries.filter((e) => !e.skipped);
	const ended = session.endedAt ? Date.parse(session.endedAt) : now.getTime();
	return {
		sets: done.length,
		exercises: new Set(done.map((e) => e.exerciseId)).size,
		minutes: Math.max(1, Math.round((ended - Date.parse(session.startedAt)) / 60000))
	};
}

export interface MuscleVolume {
	muscle: string;
	sets: number;
	reps: number;
	seconds: number;
	/**
	 * Kilogram-reps from loaded sets only (§10.1). Zero for a muscle trained with
	 * bodyweight work alone, and the UI shows it only where it is non-zero: "0 kg"
	 * next to a muscle reads as a result rather than as an absence.
	 */
	kgReps: number;
}

/**
 * Kilogram-reps for one logged set, or 0 (§10.1). Requires **both** a load and a
 * rep count: a loaded timed set is a loaded set, but kilogram-seconds is a
 * different quantity and adding the two would be arithmetic on unlike units.
 */
export function kgRepsOf(entry: SetEntry): number {
	if (entry.skipped) return 0;
	if (entry.loadKg === undefined || entry.reps === undefined) return 0;
	return entry.loadKg * entry.reps;
}

/** Whether any set anywhere carries a load — the gate on the whole section. */
export function hasLoggedLoad(sessions: Session[]): boolean {
	return completed(sessions).some((s) =>
		s.entries.some((e) => !e.skipped && e.loadKg !== undefined)
	);
}

export interface LoadedWeek {
	start: Date;
	label: string;
	/** Sets performed with a load, whether or not they contribute kg-reps. */
	sets: number;
	kgReps: number;
	/** Heaviest implement used that week, which is the other real progression. */
	bestKg: number;
}

/**
 * Loaded work per week — the "Loaded work" section (§10.1). A second currency,
 * never added to the set counts and never drawn on their axis: 240 kg-reps and
 * 24 reps are not comparable quantities.
 */
export function loadedWorkPerWeek(
	sessions: Session[],
	weeks = 12,
	now = new Date()
): LoadedWeek[] {
	const thisWeek = weekStart(now);
	const buckets: LoadedWeek[] = [];
	for (let i = weeks - 1; i >= 0; i--) {
		const start = new Date(thisWeek);
		start.setDate(start.getDate() - i * 7);
		buckets.push({
			start,
			label: `${start.getDate()}/${start.getMonth() + 1}`,
			sets: 0,
			kgReps: 0,
			bestKg: 0
		});
	}

	const firstStart = buckets[0].start.getTime();
	for (const session of completed(sessions)) {
		const started = new Date(session.startedAt).getTime();
		if (started < firstStart) continue;
		const index = Math.floor((started - firstStart) / (7 * 24 * 60 * 60 * 1000));
		if (index < 0 || index >= buckets.length) continue;
		for (const entry of session.entries) {
			if (entry.skipped || entry.loadKg === undefined) continue;
			buckets[index].sets += 1;
			buckets[index].kgReps += kgRepsOf(entry);
			buckets[index].bestKg = Math.max(buckets[index].bestKg, entry.loadKg);
		}
	}
	return buckets;
}

/**
 * Volume per muscle group. A set counts once for each of the exercise's primary
 * muscles: splitting a set fractionally across muscles would invent precision
 * the data does not have.
 */
export function volumeByMuscle(
	sessions: Session[],
	byId: Map<ExerciseId, Exercise>,
	since?: Date
): MuscleVolume[] {
	const totals = new Map<string, MuscleVolume>();

	for (const session of completed(sessions)) {
		if (since && new Date(session.startedAt) < since) continue;
		for (const entry of session.entries) {
			if (entry.skipped) continue;
			const exercise = byId.get(entry.exerciseId);
			if (!exercise) continue;
			for (const muscle of exercise.primaryMuscles) {
				const row = totals.get(muscle) ?? { muscle, sets: 0, reps: 0, seconds: 0, kgReps: 0 };
				row.sets += 1;
				row.reps += entry.reps ?? 0;
				row.seconds += entry.seconds ?? 0;
				row.kgReps += kgRepsOf(entry);
				totals.set(muscle, row);
			}
		}
	}

	return [...totals.values()].sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}

export interface ExerciseProgress {
	exerciseId: ExerciseId;
	sets: number;
	/** Best single set: most reps, or longest hold for timed work. */
	bestReps: number;
	bestSeconds: number;
	totalReps: number;
	totalSeconds: number;
	/**
	 * Heaviest implement used, and total kilogram-reps (§10.1). Safe here in a way
	 * an app-wide total is not: the series is one exercise, so 8 → 10 → 12 kg on a
	 * one-arm row means the same thing at every point on the line.
	 */
	bestKg: number;
	kgReps: number;
	lastPerformed: string;
	history: {
		date: string;
		bestReps: number;
		bestSeconds: number;
		sets: number;
		bestKg: number;
		kgReps: number;
		/**
		 * Inside §17.2's calibration window: the exercise was new enough that this
		 * point is substantially motor learning. Still drawn — the user did the
		 * work — but not joined into the trend line, and not counted as progress.
		 */
		calibrating: boolean;
	}[];
}

/**
 * Per-exercise progress, and which of its points are still calibration (§17.2).
 *
 * `levelOf` is a parameter rather than a catalog import so this module keeps
 * having no dependency on the catalog — the calibration window is wider for an
 * `advanced` exercise, and that is the only thing the level is used for here.
 * Omitting it treats everything as ordinary, which is the narrower window and
 * therefore the one that trusts the data soonest.
 */
export function exerciseProgress(
	sessions: Session[],
	levelOf: (id: ExerciseId) => Level | undefined = () => undefined
): ExerciseProgress[] {
	const byExercise = new Map<ExerciseId, ExerciseProgress>();
	const calibrating = new Map<ExerciseId, Set<string>>();
	const windowFor = (id: ExerciseId) => {
		let set = calibrating.get(id);
		if (!set) {
			set = calibratingSessions(sessions, id, levelOf(id));
			calibrating.set(id, set);
		}
		return set;
	};

	for (const session of completed(sessions)) {
		const day = dayKey(session.startedAt);
		for (const entry of session.entries) {
			if (entry.skipped) continue;
			const row =
				byExercise.get(entry.exerciseId) ??
				({
					exerciseId: entry.exerciseId,
					sets: 0,
					bestReps: 0,
					bestSeconds: 0,
					totalReps: 0,
					totalSeconds: 0,
					bestKg: 0,
					kgReps: 0,
					lastPerformed: session.startedAt,
					history: []
				} satisfies ExerciseProgress);

			row.sets += 1;
			row.totalReps += entry.reps ?? 0;
			row.totalSeconds += entry.seconds ?? 0;
			row.bestReps = Math.max(row.bestReps, entry.reps ?? 0);
			row.bestSeconds = Math.max(row.bestSeconds, entry.seconds ?? 0);
			row.bestKg = Math.max(row.bestKg, entry.loadKg ?? 0);
			row.kgReps += kgRepsOf(entry);
			if (session.startedAt > row.lastPerformed) row.lastPerformed = session.startedAt;

			const isCalibration = windowFor(entry.exerciseId).has(session.id);
			const point = row.history.find((h) => h.date === day);
			if (point) {
				point.sets += 1;
				point.bestReps = Math.max(point.bestReps, entry.reps ?? 0);
				point.bestSeconds = Math.max(point.bestSeconds, entry.seconds ?? 0);
				point.bestKg = Math.max(point.bestKg, entry.loadKg ?? 0);
				point.kgReps += kgRepsOf(entry);
				// History is per day and the window is counted in sessions, so a day
				// holding two sessions is only calibration if both of them were. The
				// day stops being calibration as soon as a trusted session lands in it.
				point.calibrating = point.calibrating && isCalibration;
			} else {
				row.history.push({
					date: day,
					sets: 1,
					bestReps: entry.reps ?? 0,
					bestSeconds: entry.seconds ?? 0,
					bestKg: entry.loadKg ?? 0,
					kgReps: kgRepsOf(entry),
					calibrating: isCalibration
				});
			}

			byExercise.set(entry.exerciseId, row);
		}
	}

	for (const row of byExercise.values()) row.history.sort((a, b) => a.date.localeCompare(b.date));
	return [...byExercise.values()].sort((a, b) => b.sets - a.sets);
}

/**
 * Consecutive days ending today or yesterday. Yesterday still counts, so the
 * streak does not appear broken before the day's session has happened.
 */
export function currentStreak(sessions: Session[], now = new Date()): number {
	const days = new Set(completed(sessions).map((s) => dayKey(s.startedAt)));
	if (days.size === 0) return 0;

	const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	if (!days.has(dayKey(cursor.toISOString()))) {
		cursor.setDate(cursor.getDate() - 1);
		if (!days.has(dayKey(cursor.toISOString()))) return 0;
	}

	let streak = 0;
	while (days.has(dayKey(cursor.toISOString()))) {
		streak++;
		cursor.setDate(cursor.getDate() - 1);
	}
	return streak;
}

export function longestStreak(sessions: Session[]): number {
	const days = [...new Set(completed(sessions).map((s) => dayKey(s.startedAt)))].sort();
	let best = 0;
	let run = 0;
	let previous: Date | null = null;

	for (const day of days) {
		const date = new Date(`${day}T00:00:00`);
		if (previous && (date.getTime() - previous.getTime()) / 86400000 === 1) run++;
		else run = 1;
		previous = date;
		best = Math.max(best, run);
	}
	return best;
}

export interface RoutineUsage {
	routineId: string;
	routineName: string;
	sessions: number;
	lastUsed: string;
}

/** Which routines actually get used, so the dead ones can be pruned (§10). */
export function routineUsage(sessions: Session[]): RoutineUsage[] {
	const byRoutine = new Map<string, RoutineUsage>();

	for (const session of completed(sessions)) {
		const row = byRoutine.get(session.routineId) ?? {
			routineId: session.routineId,
			routineName: session.routineName,
			sessions: 0,
			lastUsed: session.startedAt
		};
		row.sessions += 1;
		// The most recent name wins: a renamed routine should read as its new name.
		if (session.startedAt >= row.lastUsed) {
			row.lastUsed = session.startedAt;
			row.routineName = session.routineName;
		}
		byRoutine.set(session.routineId, row);
	}

	return [...byRoutine.values()].sort(
		(a, b) => b.sessions - a.sessions || b.lastUsed.localeCompare(a.lastUsed)
	);
}

/**
 * Deliberately no `kgReps` here, and no "total volume" of any kind (§10.1).
 * Sets, reps and seconds are three counts of three different things, which is
 * honest; one number combining a 45-second plank, twelve push-ups and eight rows
 * with a 10 kg dumbbell would be precise, prominent and meaningless. Loaded work
 * is reported per week and per exercise, where the unit stays comparable.
 */
export interface Totals {
	sessions: number;
	sets: number;
	reps: number;
	seconds: number;
	skipped: number;
}

export function totals(sessions: Session[]): Totals {
	const done = completed(sessions);
	let sets = 0;
	let reps = 0;
	let seconds = 0;
	let skipped = 0;

	for (const session of done) {
		for (const entry of session.entries) {
			if (entry.skipped) {
				skipped++;
				continue;
			}
			sets++;
			reps += entry.reps ?? 0;
			seconds += entry.seconds ?? 0;
		}
	}

	return { sessions: done.length, sets, reps, seconds, skipped };
}
