import { catalog } from './index.js';

/**
 * Plain English for the seventeen muscle names in the catalog (docs/SPEC.md
 * §4.6).
 *
 * The catalog is generated from free-exercise-db, which names muscles the way an
 * anatomy textbook does — `adductors`, `abductors`, `lats`. The app printed those
 * words at the user and left them to work it out. This file is the translation,
 * and like `ladders.ts` it is **hand-authored and deliberately not in
 * `catalog.json`**: it is editorial writing, and it belongs in a file a person is
 * expected to argue with rather than in generated output.
 *
 * `short` is the one that earns its keep. It appears in brackets after the
 * technical name everywhere a muscle is listed, so the answer is already on
 * screen and nobody has to go and look it up.
 *
 * The vocabulary is closed — the source has exactly these seventeen — and
 * `tests/muscles.test.ts` fails if the catalog ever mentions one that is missing
 * here, the same referential-integrity rule the build script applies to
 * `curation.yaml`.
 */
export interface MuscleInfo {
	/** Exactly as it appears in `Exercise.primaryMuscles`. */
	id: string;
	/** Display name, capitalised. */
	label: string;
	/** Two or three words, for the bracket after the name. */
	short: string;
	/** Where it is on the body, in words somebody could point with. */
	where: string;
	/** What it does, said in terms of movements rather than anatomy. */
	does: string;
}

export const MUSCLES: MuscleInfo[] = [
	{
		id: 'abdominals',
		label: 'Abdominals',
		short: 'stomach',
		where: 'The front of your stomach, between the ribs and the hips.',
		does: 'Curls your trunk forwards, and stops it arching when you hold a plank.'
	},
	{
		id: 'abductors',
		label: 'Abductors',
		short: 'outer hip',
		where: 'The outer hip, at the side of your bottom.',
		does: 'Takes the leg out sideways, and keeps your hips level when you stand on one leg.'
	},
	{
		id: 'adductors',
		label: 'Adductors',
		short: 'inner thigh',
		where: 'The inner thigh, running up into the groin.',
		does: 'Pulls the leg back in towards the other one. What a wide squat stretches.'
	},
	{
		id: 'biceps',
		label: 'Biceps',
		short: 'front of upper arm',
		where: 'The front of the upper arm, between shoulder and elbow.',
		does: 'Bends the elbow. Does most of the extra work in a chin-up over a pull-up.'
	},
	{
		id: 'calves',
		label: 'Calves',
		short: 'back of lower leg',
		where: 'The back of the lower leg, between knee and heel.',
		does: 'Points the foot down: every step, every jump, every heel raise.'
	},
	{
		id: 'chest',
		label: 'Chest',
		short: 'front of ribs',
		where: 'Across the front of the ribs, below the collarbone.',
		does: 'Pushes your arms forwards and inwards. The main muscle of a push-up.'
	},
	{
		id: 'forearms',
		label: 'Forearms',
		short: 'elbow to wrist',
		where: 'Between the elbow and the wrist, all the way round.',
		does: 'Grip, and the wrist. Usually what gives out first on a long hang.'
	},
	{
		id: 'glutes',
		label: 'Glutes',
		short: 'bottom',
		where: 'Your bottom, from the top of the hip down to the thigh.',
		does: 'Straightens the hip: standing up out of a squat, and every bridge.'
	},
	{
		id: 'hamstrings',
		label: 'Hamstrings',
		short: 'back of thigh',
		where: 'The back of the thigh, from the bottom down to behind the knee.',
		does: 'Bends the knee, and helps the glutes straighten the hip. What a toe-touch stretches.'
	},
	{
		id: 'lats',
		label: 'Lats',
		short: 'sides of back',
		where: 'The broad sheet down the sides of the back, starting under the armpit.',
		does: 'Pulls the arms down and in towards the body. The muscle a pull-up is really about.'
	},
	{
		id: 'lower back',
		label: 'Lower back',
		short: 'above the belt',
		where: 'Either side of the spine, above the belt.',
		does: 'Holds the spine straight. Mostly braces rather than moves, which is why it is trained with holds.'
	},
	{
		id: 'middle back',
		label: 'Middle back',
		short: 'between shoulder blades',
		where: 'Between the shoulder blades.',
		does: 'Squeezes the shoulder blades together. This, not the arms, is what a row trains.'
	},
	{
		id: 'neck',
		label: 'Neck',
		// The one name that needs no translating, so the hint gives the location
		// instead of restating the word.
		short: 'front, back and sides',
		where: 'The front, back and sides of the neck.',
		does: 'Holds your head up and turns it.'
	},
	{
		id: 'quadriceps',
		label: 'Quadriceps',
		short: 'front of thigh',
		where: 'The front of the thigh, from hip to kneecap.',
		does: 'Straightens the knee: squats, lunges, and every flight of stairs.'
	},
	{
		id: 'shoulders',
		label: 'Shoulders',
		short: 'cap of the arm',
		where: 'The cap sitting on top of each arm, front, side and back.',
		does: 'Lifts the arm in any direction, and overhead most of all.'
	},
	{
		id: 'traps',
		label: 'Traps',
		short: 'neck to shoulders',
		where: 'From the back of the neck out to each shoulder, and down between the blades.',
		does: 'Shrugs the shoulders, and holds the shoulder blades back and down.'
	},
	{
		id: 'triceps',
		label: 'Triceps',
		short: 'back of upper arm',
		where: 'The back of the upper arm, between shoulder and elbow.',
		does: 'Straightens the elbow: push-ups, dips, and any press.'
	}
];

const byId = new Map<string, MuscleInfo>(MUSCLES.map((m) => [m.id, m]));

export function muscleInfo(id: string): MuscleInfo | undefined {
	return byId.get(id);
}

/** "Quadriceps", or the raw id if it is somehow unknown. */
export function muscleLabel(id: string): string {
	return byId.get(id)?.label ?? id;
}

/** "quadriceps (front of thigh)" — the inline form, for lists of muscles. */
export function muscleWithHint(id: string): string {
	const info = byId.get(id);
	return info ? `${info.id} (${info.short})` : id;
}

export interface MuscleUsage {
	muscle: MuscleInfo;
	/** Exercises where this is a primary muscle. */
	primary: number;
	/** Exercises where it only assists. */
	secondary: number;
}

/**
 * How much of the catalog trains each muscle, for the compendium. Counted over
 * the whole catalog rather than the owned subset: the page explains the words,
 * and the words do not change when a box is ticked.
 */
export const muscleUsage: MuscleUsage[] = MUSCLES.map((muscle) => ({
	muscle,
	primary: catalog.filter((e) => e.primaryMuscles.includes(muscle.id)).length,
	secondary: catalog.filter((e) => e.secondaryMuscles.includes(muscle.id)).length
})).sort((a, b) => b.primary - a.primary || a.muscle.label.localeCompare(b.muscle.label));

/** Every muscle name the catalog actually uses, primary or secondary. */
export function musclesInCatalog(): string[] {
	const seen = new Set<string>();
	for (const e of catalog) {
		for (const m of e.primaryMuscles) seen.add(m);
		for (const m of e.secondaryMuscles) seen.add(m);
	}
	return [...seen].sort();
}
