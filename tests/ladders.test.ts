import { describe, expect, it } from 'vitest';
import { catalog, getExercise } from '../src/lib/catalog/index.js';
import {
	easierVariant,
	harderVariant,
	ladderFor,
	ladders
} from '../src/lib/catalog/ladders.js';
import { DEFAULT_OWNED, isAvailable } from '../src/lib/catalog/equipment.js';

/**
 * The ladders are hand-authored (src/lib/catalog/ladders.ts), so they can drift
 * away from a regenerated catalog. These are the same referential-integrity
 * rules the build script applies to curation.yaml, applied to the one piece of
 * editorial data that is not generated.
 */
describe('progression ladders (§4.1)', () => {
	it('references only exercises that exist', () => {
		for (const chain of ladders) {
			for (const id of chain) {
				expect(getExercise(id), `${id} is not in the catalog`).toBeDefined();
			}
		}
	});

	it('never puts an exercise on two ladders', () => {
		const seen = new Set<string>();
		for (const chain of ladders) {
			for (const id of chain) {
				expect(seen.has(id), `${id} appears on more than one ladder`).toBe(false);
				seen.add(id);
			}
		}
	});

	it('has at least two rungs per ladder', () => {
		for (const chain of ladders) {
			expect(chain.length).toBeGreaterThan(1);
		}
	});

	it('links rungs in both directions', () => {
		for (const chain of ladders) {
			for (let i = 0; i < chain.length; i++) {
				expect(easierVariant(chain[i])).toBe(i > 0 ? chain[i - 1] : undefined);
				expect(harderVariant(chain[i])).toBe(i < chain.length - 1 ? chain[i + 1] : undefined);
			}
		}
	});

	it('never moves sideways into a different kind of training', () => {
		// A ladder is one movement getting harder. Swapping a strength exercise
		// for a stretch would be a different session, not a harder one.
		for (const chain of ladders) {
			const categories = new Set(chain.map((id) => getExercise(id)?.category));
			expect(categories.size, `${chain.join(' -> ')} spans ${[...categories].join(', ')}`).toBe(1);
		}
	});

	it('does not get harder while the catalog says it gets easier', () => {
		// `level` ranks against the whole catalog rather than against siblings, so
		// it cannot order a ladder — but it must not actively contradict one.
		const rank = { beginner: 0, intermediate: 1, advanced: 2 };
		for (const chain of ladders) {
			const levels = chain.map((id) => rank[getExercise(id)!.level]);
			for (let i = 1; i < levels.length; i++) {
				expect(levels[i], `${chain[i]} is easier than ${chain[i - 1]}`).toBeGreaterThanOrEqual(
					levels[i - 1]
				);
			}
		}
	});

	it('leaves exercises off the ladders rather than guessing', () => {
		expect(ladderFor('handstand_push_ups')).toEqual([]);
		expect(ladderFor('plank')).toEqual(['plank', 'side_bridge']);
	});

	it('covers a meaningful share of the strength catalog a fresh install offers', () => {
		// Measured over what the app offers on a fresh install (§5.1's default
		// equipment), which is the set this rule was written against — before the
		// equipment types existed, every strength exercise in the catalog was in it.
		//
		// Not measured over the whole catalog, because the equipment entries are
		// deliberately unladdered: a ladder is one movement getting harder by
		// leverage (§4.1), and the way a dumbbell curl gets harder is a heavier
		// dumbbell. Including 33 rungless equipment exercises in the denominator
		// would turn this into a test of how much equipment was curated in.
		const strength = catalog.filter(
			(e) => e.category === 'strength' && isAvailable(e, DEFAULT_OWNED)
		);
		const laddered = strength.filter((e) => ladderFor(e.id).length > 0);
		expect(laddered.length / strength.length).toBeGreaterThan(0.4);
	});
});
