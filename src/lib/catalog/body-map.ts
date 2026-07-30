/**
 * Which part of the body figure each muscle name lights up (docs/SPEC.md §4.6).
 *
 * The figures come from `svelte-body-highlighter` (MIT), and every muscle in them
 * is its own `<g data-slug="...">`. So this file is a **name mapping**, not a set
 * of coordinates: the app recolours the actual muscle shape rather than floating
 * an approximate ellipse over a drawing, which is what the previous pair of
 * anatomical figures forced.
 *
 * Kept out of the component so the coverage rules are unit-testable, the same
 * reason `steps.ts` and the ladders are separate from the screens that use them.
 */
export type View = 'front' | 'back';

/**
 * Catalog muscle name -> the figure's slugs, per view. A muscle can be several
 * slugs (`abdominals` covers the front wall and the sides) and can be absent from
 * a view it is not visible from (`chest` has no back entry).
 */
export interface MuscleRegion {
	front?: string[];
	back?: string[];
}

/**
 * Fourteen of the seventeen names map exactly. Three are approximations, and they
 * are called out here rather than quietly fudged:
 *
 * - `lats` and `middle back` both resolve to `upper-back`, because the model has
 *   one region for the whole upper back. They therefore light the same shape. The
 *   glossary still tells them apart in words, which is where the distinction
 *   actually matters to a beginner.
 * - `abductors` resolves to `gluteal`, since there is no outer-hip region. This is
 *   defensible rather than a fudge: the hip abductors *are* gluteus medius and
 *   minimus, and they sit inside that mass.
 *
 * The alternative was keeping hand-placed shapes for those three. A correct muscle
 * outline that is slightly coarse beats a precise ellipse in roughly the right
 * place, so the mapping wins.
 */
export const MUSCLE_REGIONS: Record<string, MuscleRegion> = {
	abdominals: { front: ['abs', 'obliques'] },
	abductors: { back: ['gluteal'] },
	adductors: { front: ['adductors'], back: ['adductors'] },
	biceps: { front: ['biceps'] },
	calves: { front: ['calves', 'tibialis'], back: ['calves'] },
	chest: { front: ['chest'] },
	forearms: { front: ['forearm'], back: ['forearm'] },
	glutes: { back: ['gluteal'] },
	hamstrings: { back: ['hamstring'] },
	lats: { back: ['upper-back'] },
	'lower back': { back: ['lower-back'] },
	'middle back': { back: ['upper-back'] },
	neck: { front: ['neck'], back: ['neck'] },
	quadriceps: { front: ['quadriceps'] },
	shoulders: { front: ['deltoids'], back: ['deltoids'] },
	traps: { front: ['trapezius'], back: ['trapezius'] },
	triceps: { front: ['triceps'], back: ['triceps'] }
};

/** The slugs a set of muscles lights up in one view, deduplicated. */
export function slugsFor(muscles: string[], view: View): string[] {
	const out = new Set<string>();
	for (const m of muscles) {
		for (const slug of MUSCLE_REGIONS[m]?.[view] ?? []) out.add(slug);
	}
	return [...out];
}

/** Every muscle the map can point at. */
export function mappedMuscles(): string[] {
	return Object.keys(MUSCLE_REGIONS).sort();
}

/**
 * The muscles whose region is shared with another, or approximated. Each value
 * completes the sentence "On the figure this ___." — the compendium renders it
 * that way, so a phrase that does not fit reads as a typo.
 */
export const APPROXIMATED: Record<string, string> = {
	lats: 'shares the upper-back region with the middle back',
	'middle back': 'shares the upper-back region with the lats',
	abductors: 'is shown on the glutes, where gluteus medius actually sits'
};
