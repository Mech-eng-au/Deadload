/**
 * Where each muscle is on the anatomical figures (docs/SPEC.md §4.6).
 *
 * The figures are `File:Muscular_system.svg` and `File:Muscular_system-back.svg`
 * from Wikimedia Commons by Termininja, CC BY-SA 3.0. They are flattened to seven
 * tonal layers with no per-muscle paths, so nothing in them can be recoloured by
 * name — which is why the highlights are ours: a translucent ellipse per muscle,
 * positioned in the figures' own 200 × 369 coordinate space.
 *
 * Kept out of the component so the coverage rules are unit-testable, the same
 * reason `steps.ts` and the ladders are separate from the screens that use them.
 *
 * Positions were read off a coordinate grid rendered over the figures and then
 * checked by eye one muscle at a time. They are approximate by construction — an
 * ellipse over a region, not a traced outline — and that is the honest limit of
 * putting our own highlights on somebody else's drawing.
 */
export interface Region {
	/** Matches an id in `MUSCLES` (and so in `Exercise.primaryMuscles`). */
	m: string;
	cx: number;
	cy: number;
	rx: number;
	ry: number;
	/** Degrees, for the muscles that run diagonally. */
	rot?: number;
}

/** The figures' intrinsic size, and the overlay's coordinate space. */
export const FIGURE_WIDTH = 200;
export const FIGURE_HEIGHT = 369;

// The arms hang the same way in both views and the hips are visible from either
// side, so these are shared; only the muscle named on them differs.
const FOREARMS: Region[] = [
	{ m: 'forearms', cx: 54, cy: 152, rx: 9, ry: 23 },
	{ m: 'forearms', cx: 146, cy: 152, rx: 9, ry: 23 }
];

// The widest point of the hip, not the top of the thigh: the first pass sat these
// lower and further inboard, and "outer hip" landed on the quadriceps.
const ABDUCTORS: Region[] = [
	{ m: 'abductors', cx: 76, cy: 172, rx: 7, ry: 12 },
	{ m: 'abductors', cx: 124, cy: 172, rx: 7, ry: 12 }
];

export const FRONT: Region[] = [
	{ m: 'neck', cx: 100, cy: 56, rx: 11, ry: 8 },
	{ m: 'traps', cx: 83, cy: 67, rx: 11, ry: 6, rot: -20 },
	{ m: 'traps', cx: 117, cy: 67, rx: 11, ry: 6, rot: 20 },
	{ m: 'shoulders', cx: 70, cy: 78, rx: 12, ry: 11 },
	{ m: 'shoulders', cx: 130, cy: 78, rx: 12, ry: 11 },
	// The pectorals sit well below the collarbone. The first pass had these at
	// cy 86 and they read as the top of the sternum.
	{ m: 'chest', cx: 87, cy: 92, rx: 14, ry: 12 },
	{ m: 'chest', cx: 113, cy: 92, rx: 14, ry: 12 },
	{ m: 'abdominals', cx: 100, cy: 128, rx: 16, ry: 28 },
	{ m: 'biceps', cx: 64, cy: 106, rx: 8, ry: 18 },
	{ m: 'biceps', cx: 136, cy: 106, rx: 8, ry: 18 },
	...FOREARMS,
	...ABDUCTORS,
	{ m: 'quadriceps', cx: 84, cy: 216, rx: 13, ry: 32 },
	{ m: 'quadriceps', cx: 116, cy: 216, rx: 13, ry: 32 },
	// Two shapes well clear of the centreline, starting below the hip joint. An
	// earlier version of this diagram merged the pair into one bright bar at the
	// crotch and looked exactly like what you would expect. Do not close this gap;
	// `tests/muscles.test.ts` enforces it.
	{ m: 'adductors', cx: 89, cy: 218, rx: 6, ry: 24 },
	{ m: 'adductors', cx: 111, cy: 218, rx: 6, ry: 24 },
	{ m: 'calves', cx: 84, cy: 290, rx: 9, ry: 26 },
	{ m: 'calves', cx: 116, cy: 290, rx: 9, ry: 26 }
];

export const BACK: Region[] = [
	{ m: 'neck', cx: 100, cy: 58, rx: 10, ry: 9 },
	{ m: 'traps', cx: 100, cy: 88, rx: 27, ry: 21 },
	{ m: 'shoulders', cx: 68, cy: 78, rx: 12, ry: 11 },
	{ m: 'shoulders', cx: 132, cy: 78, rx: 12, ry: 11 },
	{ m: 'middle back', cx: 100, cy: 108, rx: 14, ry: 15 },
	{ m: 'lats', cx: 79, cy: 129, rx: 12, ry: 20, rot: 12 },
	{ m: 'lats', cx: 121, cy: 129, rx: 12, ry: 20, rot: -12 },
	{ m: 'lower back', cx: 100, cy: 156, rx: 13, ry: 14 },
	{ m: 'triceps', cx: 65, cy: 106, rx: 8, ry: 18 },
	{ m: 'triceps', cx: 135, cy: 106, rx: 8, ry: 18 },
	...FOREARMS,
	...ABDUCTORS,
	{ m: 'glutes', cx: 88, cy: 183, rx: 11, ry: 13 },
	{ m: 'glutes', cx: 112, cy: 183, rx: 11, ry: 13 },
	{ m: 'hamstrings', cx: 87, cy: 224, rx: 12, ry: 28 },
	{ m: 'hamstrings', cx: 113, cy: 224, rx: 12, ry: 28 },
	{ m: 'calves', cx: 86, cy: 286, rx: 11, ry: 26 },
	{ m: 'calves', cx: 114, cy: 286, rx: 11, ry: 26 }
];

export const VIEWS = [
	{ id: 'front', label: 'front', regions: FRONT },
	{ id: 'back', label: 'back', regions: BACK }
] as const;

/** Every muscle the map can point at, in either view. */
export function mappedMuscles(): string[] {
	return [...new Set([...FRONT, ...BACK].map((r) => r.m))].sort();
}
