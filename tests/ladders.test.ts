import { describe, expect, it } from 'vitest';
import { catalog, getExercise } from '../src/lib/catalog/index.js';
import {
	easierVariant,
	harderVariant,
	ladderFor,
	ladders,
	stepUpTo,
	type Rung
} from '../src/lib/catalog/ladders.js';
import { isGated } from '../src/lib/catalog/equipment.js';

/**
 * The ladders are hand-authored (src/lib/catalog/ladders.ts), so they can drift
 * away from a regenerated catalog. These started as the same referential-integrity
 * rules the build script applies to curation.yaml, applied to the one piece of
 * editorial data that is not generated.
 *
 * ## What changed on 2026-08-03, and why
 *
 * They were not enough. SPEC §17 turns a ladder from a suggestion the user can
 * ignore into the mechanism the app steers a routine with, and the strongest
 * thing this file asserted about difficulty was that the catalog's `level` never
 * falls as a ladder rises. **"Never gets easier" is a much weaker claim than
 * "each rung is the next step",** and only the second is good enough to move
 * somebody automatically. Both chains the audit deleted passed the old suite.
 *
 * So the data now carries its own reasoning — a mechanism, an evidence tag and a
 * note per step — and the assertions below check the mechanical consequences of
 * each claim rather than a proxy for difficulty. `docs/ladder-audit.md` §11 maps
 * each assertion to the defect it would have caught.
 *
 * ## What these tests cannot check
 *
 * Stated here rather than left for an assertion to imply:
 *
 * - **That the size of a step is right.** This is the whole substance of the
 *   audit and it is unenforceable: nothing in the catalog encodes effective load,
 *   so no assertion can distinguish a 16% step from one that doubles it. The
 *   force-plate numbers exist for the push-up chain and nowhere else. The `note`
 *   fields are the record; the only power this file has over them is to insist
 *   they exist and are not tagged as folklore.
 * - **That an ordering holds for a particular person.** A chin-up before a
 *   pull-up is a population tendency. Some users are the other way round and
 *   nothing in a training log can tell the app so.
 * - **That a chain is complete.** No test can know that the missing rung between
 *   `push_ups_with_feet_elevated` and `handstand_push_ups` is a pike push-up.
 *   Only a person reading the catalog can.
 * - **That an exercise is on the right chain at all.** Same category, same
 *   primary muscle and same metric are necessary and nowhere near sufficient —
 *   the walking lunge that the audit removed from the squat chain satisfied all
 *   three.
 */

const rungs = (chain: Rung[]) => chain.map((r) => r.id);
const chainName = (chain: Rung[]) => rungs(chain).join(' -> ');
const gatedFor = (id: string) => new Set(getExercise(id)!.equipment.filter(isGated));
const LEVEL_RANK = { beginner: 0, intermediate: 1, advanced: 2 };

describe('progression ladders (§4.1)', () => {
	it('references only exercises that exist', () => {
		for (const chain of ladders) {
			for (const id of rungs(chain)) {
				expect(getExercise(id), `${id} is not in the catalog`).toBeDefined();
			}
		}
	});

	it('never puts an exercise on two ladders', () => {
		const seen = new Set<string>();
		for (const chain of ladders) {
			for (const id of rungs(chain)) {
				expect(seen.has(id), `${id} appears on more than one ladder`).toBe(false);
				seen.add(id);
			}
		}
	});

	it('has at least two rungs per ladder', () => {
		// Two rungs is a chain and one is not: two states one true thing — there is
		// a harder version of this, and it is that. One states nothing.
		for (const chain of ladders) {
			expect(chain.length, `${chainName(chain)} is not a chain`).toBeGreaterThan(1);
		}
	});

	it('links rungs in both directions', () => {
		for (const chain of ladders) {
			const ids = rungs(chain);
			for (let i = 0; i < ids.length; i++) {
				expect(easierVariant(ids[i])).toBe(i > 0 ? ids[i - 1] : undefined);
				expect(harderVariant(ids[i])).toBe(i < ids.length - 1 ? ids[i + 1] : undefined);
			}
		}
	});

	it('says why every step is a step, and nothing rests on folklore', () => {
		// The one rule no other part of the codebase can enforce. A rung justified
		// by "it feels harder" is fine — `reasonable_inference`, and the note says
		// so. A rung whose justification was never written down is not.
		for (const chain of ladders) {
			expect(chain[0].step, `${chainName(chain)} justifies its first rung`).toBeUndefined();
			for (const rung of chain.slice(1)) {
				const step = rung.step;
				expect(step, `${rung.id} does not say why it is a step up`).toBeDefined();
				expect(step!.note.length, `${rung.id}'s note is too short to be a reason`).toBeGreaterThan(
					40
				);
				expect(
					['well_established', 'reasonable_inference', 'contested'],
					`${rung.id} has an evidence tag outside the vocabulary`
				).toContain(step!.evidence);
			}
		}
	});

	it('exposes a step through stepUpTo, and nothing for a first rung', () => {
		for (const chain of ladders) {
			expect(stepUpTo(chain[0].id)).toBeUndefined();
			for (const rung of chain.slice(1)) expect(stepUpTo(rung.id)).toBe(rung.step);
		}
		expect(stepUpTo('bodyweight_squat')).toBeUndefined();
	});

	it('never moves sideways into a different kind of training', () => {
		// A ladder is one movement getting harder. Swapping a strength exercise
		// for a stretch would be a different session, not a harder one.
		for (const chain of ladders) {
			const categories = new Set(rungs(chain).map((id) => getExercise(id)?.category));
			expect(categories.size, `${chainName(chain)} spans ${[...categories].join(', ')}`).toBe(1);
		}
	});

	it('keeps the same primary muscle the whole way up', () => {
		// Would have caught butt_lift_bridge (glutes) -> floor_glute_ham_raise
		// (hamstrings), and the old pull chain's traps -> middle back -> lats.
		// A chain that changes what it works is not one movement getting harder.
		for (const chain of ladders) {
			const primary = new Set(rungs(chain).map((id) => getExercise(id)!.primaryMuscles[0]));
			expect(primary.size, `${chainName(chain)} works ${[...primary].join(', ')}`).toBe(1);
		}
	});

	it('keeps the same unit of measurement the whole way up', () => {
		// A reps chain that turns into a duration one has no criterion §17 can
		// apply across the step, and no sparkline that means anything across it.
		for (const chain of ladders) {
			const metrics = new Set(rungs(chain).map((id) => getExercise(id)!.defaultMetric));
			expect(metrics.size, `${chainName(chain)} mixes ${[...metrics].join(', ')}`).toBe(1);
		}
	});

	it('only changes unilateral on a step that says it does', () => {
		// A two-limb to one-limb step halves what a logged rep means, so it is the
		// one change the note is not allowed to leave out — and no other mechanism
		// may make it silently. `single_arm_push_up` and `side_bridge` both arrived
		// this way before the audit.
		for (const chain of ladders) {
			for (let i = 1; i < chain.length; i++) {
				const changed =
					getExercise(chain[i].id)!.unilateral !== getExercise(chain[i - 1].id)!.unilateral;
				const declared = chain[i].step!.mechanism === 'limb_count';
				expect(changed, `${chain[i].id} declares limb_count but the catalog disagrees`).toBe(
					declared
				);
			}
		}
	});

	it('never adds gated equipment as it rises', () => {
		// §5.1 gates what the app *offers*, and a progression suggestion is the most
		// emphatic offer it makes. The old hip-flexion chain ran floor -> floor ->
		// hanging -> hanging, so a user who had never ticked the pull-up-bar box
		// would have been automatically offered a hanging leg raise (§17.1).
		//
		// Checked here as well as filtered in §17 because a chain the user drops out
		// of halfway is a broken promise even when nothing is offered: the catalog
		// screen still draws all four rungs.
		for (const chain of ladders) {
			for (let i = 1; i < chain.length; i++) {
				const added = [...gatedFor(chain[i].id)].filter((e) => !gatedFor(chain[i - 1].id).has(e));
				expect(added, `${chain[i].id} needs ${added.join(', ')} that ${chain[i - 1].id} does not`)
					.toHaveLength(0);
			}
		}
	});

	it('puts nothing on a ladder that the app cannot explain', () => {
		// Three catalog entries have an empty instructions array — side_bridge,
		// side_jackknife and one_arm_kettlebell_swings. An exercise the app cannot
		// describe is a poor thing to move somebody onto automatically.
		for (const chain of ladders) {
			for (const id of rungs(chain)) {
				expect(getExercise(id)!.instructions.length, `${id} has no instructions`).toBeGreaterThan(0);
			}
		}
	});

	it('writes down its disagreement whenever the catalog level falls', () => {
		// This replaces "level never falls as a ladder rises", which was the old
		// suite's only claim about difficulty. It was too weak to catch anything the
		// audit found, and it was actively wrong once: it rejects
		// push_ups_close_triceps_position (intermediate) below dips_triceps_version
		// (beginner), which is the better ordering. `level` ranks against the whole
		// catalog rather than against siblings, so it may be quoted as evidence and
		// may not order a chain — but disagreeing with it silently is how a wrong
		// ordering hides.
		for (const chain of ladders) {
			for (let i = 1; i < chain.length; i++) {
				const falls =
					LEVEL_RANK[getExercise(chain[i].id)!.level] <
					LEVEL_RANK[getExercise(chain[i - 1].id)!.level];
				const explained = !!chain[i].step!.levelFalls;
				expect(explained, `${chain[i].id}: levelFalls is ${falls ? 'missing' : 'not needed'}`).toBe(
					falls
				);
			}
		}
	});

	it('leaves exercises off the ladders rather than guessing', () => {
		// Every strength or core exercise somebody might reasonably expect to find
		// on a ladder, and the one-line reason it is not. `docs/ladder-audit.md` §10
		// carries the argument; this is the assertion that fails when one is quietly
		// added back.
		//
		// This replaces a test that asserted the ladders covered more than 40% of
		// the strength catalog a fresh install offers. That test failed on an honest
		// deletion and passed on a bad rung — exactly backwards. The audit cut
		// coverage from 59% to 44% and was right to.
		const off: Record<string, string> = {
			handstand_push_ups: 'no pike push-up in the catalog to stand below it',
			single_arm_push_up: 'a ~2x step, and no archer or uneven push-up to bridge it',
			bodyweight_squat: 'the catalog has no harder bodyweight squat',
			bodyweight_walking_lunge: 'a different movement at almost the same load',
			freehand_jump_squat: 'power rather than strength, and `strength` only by source-data accident',
			floor_glute_ham_raise: 'knee flexion, not hip extension — a different joint action, and a cliff',
			scapular_pull_up: 'a scapular drill with no elbow flexion, not a pull',
			bent_knee_hip_raise: 'a near-duplicate of reverse_crunch',
			reverse_crunch: 'kept off with it; neither leads anywhere without a bar',
			plank: 'anti-extension, and side_bridge is a different plane rather than a harder one',
			side_bridge: 'a different plane, and it has no instructions at all',
			push_up_wide: 'a near-duplicate of pushups'
		};
		for (const [id, why] of Object.entries(off)) {
			expect(getExercise(id), `${id} is not in the catalog`).toBeDefined();
			expect(ladderFor(id), `${id} is on a ladder: ${why}`).toEqual([]);
		}
	});

	it('still describes the chains the screens draw', () => {
		expect(ladderFor('pushups')).toEqual([
			'incline_push_up',
			'pushups',
			'push_ups_with_feet_elevated'
		]);
		expect(ladderFor('dips_triceps_version')).toEqual([
			'bench_dips',
			'push_ups_close_triceps_position',
			'dips_triceps_version'
		]);
		expect(ladders).toHaveLength(7);
		expect(ladders.flat()).toHaveLength(17);
	});

	it('leaves the equipment catalog unladdered on purpose', () => {
		// A ladder is one movement getting harder by leverage (§4.1), and the way a
		// dumbbell curl gets harder is a heavier dumbbell. Nothing that progresses
		// by load belongs on one.
		const loadable = catalog.filter((e) =>
			e.equipment.some((id) => id === 'dumbbells' || id === 'kettlebell')
		);
		expect(loadable.length).toBeGreaterThan(20);
		for (const e of loadable) {
			expect(ladderFor(e.id), `${e.id} progresses by load, not by leverage`).toEqual([]);
		}
	});
});
