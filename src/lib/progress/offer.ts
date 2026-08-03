import { getExercise } from '../catalog/index.js';
import { isAvailable } from '../catalog/equipment.js';
import { harderVariant } from '../catalog/ladders.js';
import type { EquipmentId, ExerciseId, Routine, RoutineItem, Session, Target } from '../types.js';
import { calibratingSessions } from './calibration.js';

/**
 * The progression rule (docs/SPEC.md §17.1), over data the app already has.
 *
 * One rule, not a scheduler. `exercise-variation.md` killed the version of this
 * that rotated exercises to stop the muscles "adapting" — that has been tested
 * twice (Baz-Valle 2019, Kassiano 2024) and found null both times — and it
 * collapsed double progression and the §7 ladder swap into a single mechanism,
 * because in a leverage-based system **progressing *is* changing the exercise**.
 *
 * Pure per §15: everything it needs arrives as an argument, and it reads no
 * database. The catalog is not a database read — it ships with the app, and
 * `ladders.ts` is imported the same way by its own tests.
 */

/**
 * The rep ceiling. **An editorial number, not a physiological one, and it must
 * be labelled as such wherever it is explained** (§17.1). Nothing in the
 * literature supports a specific value; what supports *having* one is that a set
 * of 40 makes a session long and stops being strength work.
 *
 * It is 20 rather than something lower because reps are integers, so a rep count
 * is a coarse measurement: at 8 reps one rep is a 12.5% step and at 20 it is 5%.
 * Swapping early lands the user on the *coarsest* channel, at the same moment a
 * ladder step changes the movement under them.
 */
export const REP_CEILING = 20;

/**
 * The target a new rung starts on. Also editorial — the point is only that it is
 * low: a ladder step is a 10–30% change in effective load (`exercise-variation.md`
 * §7.1), so arriving with reps in hand is better than arriving with none.
 */
export const STARTING_RANGE: Target = { kind: 'reps_range', min: 5, max: 8 };

/** Sessions the criterion looks back over. One is inside the noise; three is slower than the user. */
export const STREAK_SESSIONS = 2;

/** How long a declined suggestion stays declined (§17.3), in days. */
export const DECLINE_DAYS = 14;

/** At most this many suggestions after one session (§17.3), so it cannot become a wall. */
export const MAX_OFFERS_PER_SESSION = 2;

export type Offer =
	/** Below the ceiling: raise the target by one rep, both ends for a range. */
	| { kind: 'add_rep'; itemId: string; exerciseId: ExerciseId; target: Target }
	/** At the ceiling, with a harder rung the user has the equipment for. */
	| { kind: 'next_rung'; itemId: string; exerciseId: ExerciseId; to: ExerciseId; target: Target }
	/**
	 * At the ceiling with nowhere to go. Said once and about the catalog rather
	 * than about the user (§17.1 as amended): *the app knows no harder version of
	 * this movement*, never *you have reached your limit*.
	 */
	| { kind: 'ladder_end'; itemId: string; exerciseId: ExerciseId };

export interface OfferInput {
	item: RoutineItem;
	/** Every session in the log. Unfinished ones are ignored. */
	sessions: Session[];
	/** Resolved through `ownedEquipment()` by the caller — never `settings.ownedEquipment`. */
	owned: EquipmentId[];
	now?: Date;
}

/** The top of a target: its max for a range, its value for fixed reps. */
export function targetTop(target: Target): number | undefined {
	if (target.kind === 'reps') return target.reps;
	if (target.kind === 'reps_range') return target.max;
	return undefined;
}

function raised(target: Target): Target {
	if (target.kind === 'reps') return { kind: 'reps', reps: target.reps + 1 };
	if (target.kind === 'reps_range')
		return { kind: 'reps_range', min: target.min + 1, max: target.max + 1 };
	return target;
}

function declinedRecently(item: RoutineItem, now: Date): boolean {
	if (!item.progressDeclinedAt) return false;
	const since = now.getTime() - Date.parse(item.progressDeclinedAt);
	return Number.isFinite(since) && since >= 0 && since < DECLINE_DAYS * 86_400_000;
}

/**
 * Whether the rule applies to this item at all (§17.1 as amended 2026-08-03).
 *
 * `strength` **and `core`**: the first draft said strength alone, on the stated
 * ground that "§7's ladders are strength chains", which the ladder audit found to
 * be false — three of the eight were `core`. A set of sit-ups is trying to get
 * harder in exactly the way a set of push-ups is. A stretch progresses by
 * duration or not at all, and mobility work is not trying to get harder, so both
 * stay out.
 */
export function applies(item: RoutineItem): boolean {
	const exercise = getExercise(item.exerciseId);
	if (!exercise) return false;
	if (exercise.category !== 'strength' && exercise.category !== 'core') return false;
	return item.target.kind === 'reps' || item.target.kind === 'reps_range';
}

/**
 * Whether the last two qualifying sessions both cleared the target.
 *
 * Matched on **itemId *and* exerciseId**. A §7 swap keeps the itemId and changes
 * the exercise, and sessions performed on the easier rung are not evidence that
 * the harder one is too easy — that is the same reasoning §17.2 applies to a
 * newly introduced exercise, one level up.
 */
function clearedTwice(input: OfferInput): boolean {
	const { item, sessions } = input;
	const top = targetTop(item.target);
	if (top === undefined) return false;

	const exercise = getExercise(item.exerciseId);
	const skip = calibratingSessions(sessions, item.exerciseId, exercise?.level);

	const qualifying = sessions
		.filter((s) => s.endedAt && !skip.has(s.id))
		.map((s) => ({
			startedAt: s.startedAt,
			entries: s.entries.filter((e) => e.itemId === item.id && e.exerciseId === item.exerciseId)
		}))
		.filter((s) => s.entries.length > 0)
		.sort((a, b) => a.startedAt.localeCompare(b.startedAt));

	const recent = qualifying.slice(-STREAK_SESSIONS);
	if (recent.length < STREAK_SESSIONS) return false;

	return recent.every((s) => {
		// A skip anywhere in the item resets the streak, whatever the other sets did.
		if (s.entries.some((e) => e.skipped)) return false;
		// Counted by *distinct* setIndex so a per-side pair is one set, exactly as
		// §4.3's renumbering does — otherwise a unilateral item needs twice as many
		// entries to look complete.
		const done = new Set(s.entries.map((e) => e.setIndex));
		if (done.size < item.sets) return false;
		return s.entries.every((e) => (e.reps ?? 0) >= top);
	});
}

/**
 * What to offer for one item, or nothing. Nothing is the common answer, and it
 * is the right one: §17.3's rule is that the app suggests rather than acts, and
 * an app that has something to say after every session is nagging.
 */
export function offerFor(input: OfferInput): Offer | undefined {
	const { item, owned } = input;
	const now = input.now ?? new Date();
	if (!applies(item) || declinedRecently(item, now)) return undefined;
	if (!clearedTwice(input)) return undefined;

	const top = targetTop(item.target)!;
	if (top < REP_CEILING) {
		return {
			kind: 'add_rep',
			itemId: item.id,
			exerciseId: item.exerciseId,
			target: raised(item.target)
		};
	}

	// A rung the user cannot perform is not an offer (§17.1). §5.1 gates what the
	// app *suggests*, and a progression suggestion is the most emphatic suggestion
	// it makes — the ladder audit found a chain that would otherwise have offered
	// a hanging leg raise to somebody with no pull-up bar.
	const harder = harderVariant(item.exerciseId);
	const next = harder ? getExercise(harder) : undefined;
	if (next && isAvailable(next, owned)) {
		return {
			kind: 'next_rung',
			itemId: item.id,
			exerciseId: item.exerciseId,
			to: next.id,
			target: STARTING_RANGE
		};
	}

	return { kind: 'ladder_end', itemId: item.id, exerciseId: item.exerciseId };
}

/**
 * Every offer a finished routine has earned, capped at two (§17.3).
 *
 * Routine order rather than "the most impressive first": the user is looking at
 * a list they wrote, and a stable order is one they can predict. `ladder_end` is
 * sorted last within that, because it asks for nothing and the two slots are
 * better spent on offers that do something.
 */
export function offersFor(
	routine: Routine,
	sessions: Session[],
	owned: EquipmentId[],
	now = new Date()
): Offer[] {
	const all: Offer[] = [];
	for (const block of routine.blocks) {
		for (const item of block.items) {
			const offer = offerFor({ item, sessions, owned, now });
			if (offer) all.push(offer);
		}
	}
	const actionable = all.filter((o) => o.kind !== 'ladder_end');
	const terminal = all.filter((o) => o.kind === 'ladder_end');
	return [...actionable, ...terminal].slice(0, MAX_OFFERS_PER_SESSION);
}
