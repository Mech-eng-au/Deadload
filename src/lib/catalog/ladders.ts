import type { ExerciseId } from '../types.js';
import { getExercise } from './index.js';

/**
 * Progression ladders (docs/SPEC.md §4.1). Calisthenics progresses by leverage,
 * not by load: the way a push-up gets harder is to change the angle, not to add
 * a plate. A ladder is one movement's variants ordered easiest first, so the
 * session player can offer the next rung when a set was too easy or too hard —
 * and, since §17, so the app can offer it on its own after two good sessions.
 *
 * Hand-authored, and deliberately *not* emitted into `catalog.json`. The catalog
 * is generated from free-exercise-db, which has no notion of one exercise being
 * a harder version of another — inventing the ordering is editorial work, and
 * editorial work belongs in a file a person is expected to argue with rather
 * than in generated output.
 *
 * ## Why every step carries its reasoning (2026-08-03)
 *
 * These were eight lists of ids, with the reasoning in a comment above them.
 * That was enough while a rung was a suggestion the user could ignore. §17
 * promotes the ladder into the mechanism the app steers a routine with, and a
 * comment is not something a test can reach: the old test asserted that `level`
 * never falls as a ladder rises, which was true of a chain ending in a jump
 * squat and of a step that doubled the load. **"Never gets easier" is a much
 * weaker claim than "each rung is the next step."**
 *
 * So the judgement moved into the data. Every step says what makes the rung
 * above harder, how well supported that is, and — in one sentence, carrying the
 * measurement where one exists — why. `tests/ladders.test.ts` cannot check that
 * a step is the right *size*, because nothing in the catalog encodes effective
 * load; it can check that somebody wrote down what they thought and why, that no
 * step rests on folklore, and every mechanical consequence of the claim.
 *
 * The audit that produced this shape, with a verdict per chain and the evidence
 * tagged, is `docs/ladder-audit.md`. Read it before adding a rung.
 */

/** What makes the rung above harder than the rung below. */
export type StepMechanism =
	/** The same movement with more of the body's mass on the working limbs. */
	| 'leverage'
	/** More joints involved, or a longer path through the same ones. */
	| 'range'
	/** The load moves further from the joint that has to hold it. */
	| 'lever_length'
	/** The same work on half the limbs. The only mechanism that may flip `unilateral`. */
	| 'limb_count';

/**
 * How well supported a step is, in the vocabulary `docs/exercise-variation.md`
 * uses on itself. There is deliberately no `folklore` — a rung justified by "it
 * feels harder" is `reasonable_inference` and has to say so in its note, and a
 * rung with nothing behind it does not belong on a chain the app steers by.
 */
export type StepEvidence = 'well_established' | 'reasonable_inference' | 'contested';

export interface Step {
	mechanism: StepMechanism;
	evidence: StepEvidence;
	/** One sentence. Where there is a measurement, the measurement. */
	note: string;
	/**
	 * Required when the catalog's `level` falls across this step, and forbidden
	 * otherwise. `level` ranks an exercise against the whole catalog rather than
	 * against its siblings, so it cannot order a ladder — but disagreeing with it
	 * silently is how a wrong ordering hides, so the disagreement is written down.
	 */
	levelFalls?: string;
}

export interface Rung {
	id: ExerciseId;
	/** Why this is a step up from the rung below. Absent on the first rung. */
	step?: Step;
}

export type Ladder = Rung[];

/**
 * Seven chains, seventeen rungs. **The count is a finding, not a target** — the
 * previous eight became seven when the audit deleted two and split one, and the
 * test that measured ladder coverage as a percentage was removed along with them
 * because it rewarded exactly the pressure the audit says to resist.
 */
export const ladders: Ladder[] = [
	// Horizontal push. The angle is the load, and this is the one chain in the
	// file with a force plate behind it.
	[
		{ id: 'incline_push_up' },
		{
			id: 'pushups',
			step: {
				mechanism: 'leverage',
				evidence: 'well_established',
				note: 'Ebben 2011 measured peak vertical ground reaction force at 55% of body mass with the hands elevated 30.5 cm and 64% flat: a ~16% step, on these exact variants.'
			}
		},
		{
			id: 'push_ups_with_feet_elevated',
			step: {
				mechanism: 'leverage',
				evidence: 'well_established',
				note: 'Same study: feet elevated produced the highest force of the six variations, up to ~74% of body mass. Another ~16%.'
			}
		}
	],

	// Triceps dip. `single_arm_push_up` was dropped from the push chain for a
	// doubling of load; this chain had the same doubling in it from the start,
	// and the close-grip push-up is the rung that removes it.
	[
		{ id: 'bench_dips' },
		{
			id: 'push_ups_close_triceps_position',
			step: {
				mechanism: 'leverage',
				evidence: 'reasonable_inference',
				note: 'A bench dip loads roughly half of body mass; a push-up loads ~64% (Ebben 2011) and the close hand position puts more of it through the triceps. The direction is clear, the size is inferred.'
			}
		},
		{
			id: 'dips_triceps_version',
			step: {
				mechanism: 'leverage',
				evidence: 'reasonable_inference',
				note: 'A parallel-bar dip carries essentially the whole body on the arms. No force-plate study of the pair; a 2022 motion-capture and EMG comparison found higher peak activation in six muscles including the triceps than the bench dip.',
				levelFalls:
					'The catalog calls this beginner and the close-grip push-up intermediate, which is backwards: this rung takes ~100% of body mass and that one takes ~64%. The clearest case in the file of `level` ranking against the whole catalog rather than against siblings.'
			}
		}
	],

	// Horizontal pull. Split out of the old four-rung pull chain, which crossed
	// from horizontal to vertical and from ~50% of body mass to ~100% in one step.
	[
		{ id: 'inverted_row' },
		{
			id: 'bodyweight_mid_row',
			step: {
				mechanism: 'lever_length',
				evidence: 'contested',
				note: 'Performed with the legs hooked over the apparatus, which raises the hips and lengthens the lever. The rung I am least sure of in the whole file — it may be closer to a front-lever row than to a harder inverted row. See ladder-audit.md §2.'
			}
		}
	],

	// Vertical pull. There is nothing below a chin-up: the catalog has no
	// negative, band-assisted or jumping chin-up to start from.
	[
		{ id: 'chin_up' },
		{
			id: 'pullups',
			step: {
				mechanism: 'leverage',
				evidence: 'reasonable_inference',
				note: 'Supinated before pronated: the chin-up recruits the elbow flexors more, and most people manage more of them. Widely observed; no trial for the ordering, and the catalog gives both the same level.'
			}
		}
	],

	// Hip extension. Two feet, then one. `floor_glute_ham_raise` used to sit above
	// this and was dropped: knee flexion rather than hip extension, and its own
	// instructions say most people cannot do it unaided.
	[
		{ id: 'butt_lift_bridge' },
		{
			id: 'single_leg_glute_bridge',
			step: {
				mechanism: 'limb_count',
				evidence: 'well_established',
				note: 'The same movement through one hip instead of two — arithmetic. §17.2 gives a wider calibration window to steps like this, because a rep stops meaning what it meant.'
			}
		}
	],

	// Trunk flexion, feet anchored by the floor. The only one of the original
	// eight that the audit changed nothing about.
	[
		{ id: 'crunches' },
		{
			id: 'sit_up',
			step: {
				mechanism: 'range',
				evidence: 'reasonable_inference',
				note: 'Adds hip flexion and a full trunk range to a movement that only takes the shoulders off the floor. Mechanism, not measurement — nobody has compared them.'
			}
		},
		{
			id: 'jackknife_sit_up',
			step: {
				mechanism: 'lever_length',
				evidence: 'reasonable_inference',
				note: 'Both levers move instead of one: the legs are raised against gravity at the same time as the torso.'
			}
		}
	],

	// Hip flexion while hanging. The floor rungs that used to lead here were
	// near-duplicates of each other, and the step onto the bar added equipment
	// mid-chain — so a user with no bar would have been offered a hanging leg raise.
	[
		{ id: 'hanging_leg_raise' },
		{
			id: 'hanging_pike',
			step: {
				mechanism: 'range',
				evidence: 'reasonable_inference',
				note: 'The same hang with a straighter leg and the feet carried up to the bar rather than to horizontal.'
			}
		}
	]
];

const easierThan = new Map<ExerciseId, ExerciseId>();
const harderThan = new Map<ExerciseId, ExerciseId>();
const stepUp = new Map<ExerciseId, Step>();

for (const chain of ladders) {
	chain.forEach((rung, i) => {
		if (i > 0) easierThan.set(rung.id, chain[i - 1].id);
		if (i < chain.length - 1) harderThan.set(rung.id, chain[i + 1].id);
		if (rung.step) stepUp.set(rung.id, rung.step);
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
 * on none. Ids only: the screens show a progression, not an argument about one.
 */
export function ladderFor(id: ExerciseId): ExerciseId[] {
	const chain = ladders.find((c) => c.some((r) => r.id === id));
	return chain ? chain.map((r) => r.id) : [];
}

/**
 * Why this rung is a step up from the one below it, or undefined when it is the
 * first rung of a chain or on no chain at all. Not shown to the user: §17.5
 * forbids the app claiming more than the evidence supports, and a note written
 * for the person maintaining the ladders is not copy.
 */
export function stepUpTo(id: ExerciseId): Step | undefined {
	return stepUp.get(id);
}

/** Name of a rung, for the swap controls. Falls back to the id if unknown. */
export function variantName(id: ExerciseId): string {
	return getExercise(id)?.name ?? id;
}
