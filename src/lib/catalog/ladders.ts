import type { ExerciseId } from '../types.js';
import { getExercise } from './index.js';

/**
 * Progression ladders (docs/SPEC.md §4.1). Calisthenics progresses by leverage,
 * not by load: the way a push-up gets harder is to change the angle, not to add
 * a plate. A ladder is one movement's variants ordered easiest first, so the
 * session player can offer the next rung when a set was too easy or too hard.
 *
 * Hand-authored, and deliberately *not* emitted into `catalog.json`. The catalog
 * is generated from free-exercise-db, which has no notion of one exercise being
 * a harder version of another — inventing the ordering is editorial work, and
 * editorial work belongs in a file a person is expected to argue with rather
 * than in generated output. `level` is not enough on its own: it ranks an
 * exercise against the whole catalog, not against its own siblings.
 *
 * Rules, enforced by `tests/ladders.test.ts`:
 *
 * - Easiest first, and every step up has to be a real step. Where the catalog
 *   has two variants of roughly equal difficulty (`push_up_wide` next to
 *   `pushups`) only one is on the ladder; a rung the user cannot feel is worse
 *   than no rung.
 * - No exercise appears on two ladders, so "harder" is unambiguous.
 * - Every id exists in the catalog.
 *
 * Only eight chains fit this catalog honestly. Notably missing is a middle rung
 * between `push_ups_with_feet_elevated` and `handstand_push_ups` — a pike
 * push-up, which free-exercise-db does not have as a bodyweight entry — so
 * handstand push-ups are on no ladder rather than one rung above something four
 * rungs easier.
 */
export const ladders: ExerciseId[][] = [
	// Horizontal push. The angle is the load: hands high is easiest, feet high
	// is harder, one arm hardest.
	['incline_push_up', 'pushups', 'push_ups_with_feet_elevated', 'single_arm_push_up'],

	// Vertical pull. Scapular pull-ups build the hang; a row is the horizontal
	// version at a fraction of the bodyweight; supinated before pronated.
	['scapular_pull_up', 'inverted_row', 'chin_up', 'pullups'],

	// Triceps dip. Feet on the floor and hands behind you, then the full dip
	// with the whole bodyweight on the arms.
	['bench_dips', 'dips_triceps_version'],

	// Squat. Two legs, then a split stance, then the same movement with the
	// landing to absorb.
	['bodyweight_squat', 'bodyweight_walking_lunge', 'freehand_jump_squat'],

	// Posterior chain. Both feet, then one, then the knee-flexion version that
	// needs something to anchor the feet.
	['butt_lift_bridge', 'single_leg_glute_bridge', 'floor_glute_ham_raise'],

	// Trunk flexion, feet anchored by the floor.
	['crunches', 'sit_up', 'jackknife_sit_up'],

	// Hip flexion against the trunk. On the floor first, then hanging, where
	// the whole leg is the lever.
	['bent_knee_hip_raise', 'reverse_crunch', 'hanging_leg_raise', 'hanging_pike'],

	// Anti-extension hold, then the anti-lateral-flexion version on one arm.
	['plank', 'side_bridge']
];

const easierThan = new Map<ExerciseId, ExerciseId>();
const harderThan = new Map<ExerciseId, ExerciseId>();

for (const chain of ladders) {
	chain.forEach((id, i) => {
		if (i > 0) easierThan.set(id, chain[i - 1]);
		if (i < chain.length - 1) harderThan.set(id, chain[i + 1]);
	});
}

/** The rung below, or undefined when this is the easiest one known. */
export function easierVariant(id: ExerciseId): ExerciseId | undefined {
	return easierThan.get(id);
}

/** The rung above, or undefined when this is the hardest one known. */
export function harderVariant(id: ExerciseId): ExerciseId | undefined {
	return harderThan.get(id);
}

/**
 * The ladder an exercise sits on, easiest first, or an empty array when it is
 * on none. Used by the catalog detail screen to show the whole progression.
 */
export function ladderFor(id: ExerciseId): ExerciseId[] {
	return ladders.find((chain) => chain.includes(id)) ?? [];
}

/** Name of a rung, for the swap controls. Falls back to the id if unknown. */
export function variantName(id: ExerciseId): string {
	return getExercise(id)?.name ?? id;
}
