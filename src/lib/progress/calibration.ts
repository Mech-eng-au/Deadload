import type { ExerciseId, Level, Session } from '../types.js';

/**
 * The calibration window (docs/SPEC.md §17.2).
 *
 * **The first sessions on a newly introduced exercise measure skill, not
 * strength.** Performance on a movement improves from *practising the movement*,
 * independently of any adaptation: Ritti-Dias 2011 watched untrained men's bench
 * 1RM climb 3.8%, 7.4% and 10.1% across sessions 2, 3 and 4 with no training in
 * between, and Mattocks 2017 found a group that only ever performed 1RM singles
 * gain as much *strength* as a group training to failure. So letting those
 * sessions satisfy §17.1's criterion would push somebody up a ladder on the
 * strength of having learned the movement.
 *
 * They are **recorded and excluded**, never discarded: from the progression
 * criterion, from trend fitting, and from any "personal best" or "getting
 * stronger" message.
 *
 * **Both numbers are data-quality heuristics inferred from the 1RM
 * familiarisation literature, not measured for bodyweight reps-to-failure** —
 * nobody has studied that. `docs/exercise-variation.md` §5c is where the
 * inference is laid out, and §17.2 requires them to be labelled this way in any
 * copy that explains them. *"Held for three sessions so the numbers settle"* is
 * true; *"held for three sessions to maximise adaptation"* is not.
 *
 * Pure per §15: it takes the log as an argument and reads nothing.
 */

/** Sessions before an exercise's numbers are trusted. Editorial, not measured. */
export const CALIBRATION_SESSIONS = 3;

/**
 * Five for `advanced`, because the learning effect scales with how much
 * coordination the task demands and those are the single-limb and hanging
 * variants. `level` is reused rather than a new field being added: it is
 * already in the catalog and already means roughly this.
 */
export const CALIBRATION_SESSIONS_ADVANCED = 5;

export function calibrationWindow(level: Level | undefined): number {
	return level === 'advanced' ? CALIBRATION_SESSIONS_ADVANCED : CALIBRATION_SESSIONS;
}

/**
 * The finished sessions in which an exercise was actually performed, oldest
 * first, as session ids.
 *
 * Counted in **sessions**, not days: two sessions in one day are two exposures
 * to the movement, and §17.1's criterion is written over sessions too. A skipped
 * set is not an exposure, so a session in which every set of the exercise was
 * skipped does not count against the window.
 */
export function performedIn(sessions: Session[], exerciseId: ExerciseId): string[] {
	return sessions
		.filter((s) => s.endedAt)
		.filter((s) => s.entries.some((e) => e.exerciseId === exerciseId && !e.skipped))
		.sort((a, b) => a.startedAt.localeCompare(b.startedAt))
		.map((s) => s.id);
}

/**
 * The session ids that are still calibration for this exercise — its first
 * `calibrationWindow(level)` performances, whenever they happened.
 *
 * A `Set` rather than a count because the callers ask different questions of it:
 * §10 needs "is *this* point calibration" while walking a history in date order,
 * and §17.1 needs "drop these from the streak" out of order.
 */
export function calibratingSessions(
	sessions: Session[],
	exerciseId: ExerciseId,
	level: Level | undefined
): Set<string> {
	return new Set(performedIn(sessions, exerciseId).slice(0, calibrationWindow(level)));
}

/**
 * Whether an exercise is still inside its window — which is also the condition
 * for saying so on screen. **The wording has to be about the numbers, not about
 * the user** (§17.2, §17.5): the app is waiting for its own measurement to
 * settle, and it has no evidence about what the user's body is doing.
 */
export function isCalibrating(
	sessions: Session[],
	exerciseId: ExerciseId,
	level: Level | undefined
): boolean {
	return performedIn(sessions, exerciseId).length < calibrationWindow(level);
}
