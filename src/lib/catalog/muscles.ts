import type { Messages } from '../i18n/index.js';
import { catalog } from './index.js';

/**
 * The seventeen muscle names in the catalog (docs/SPEC.md §4.6).
 *
 * **Amended 2026-08-02 by §16.** This file used to hold the plain-English
 * `short`, `where` and `does` for each muscle as well as the list itself. The
 * writing has moved to `src/lib/i18n/<locale>/muscles.ts`; what stays here is
 * the part that is not writing: the closed vocabulary, the lookups, and the
 * count of how much of the catalog trains each one.
 *
 * The split is the same one the catalog already had between `catalog.json` and
 * `ladders.ts` — generated or structural data in one place, editorial writing in
 * a file a person is expected to argue with — and it is what makes a second
 * language a file rather than a rewrite.
 *
 * The vocabulary is closed, which is what makes this tractable:
 * free-exercise-db uses exactly these seventeen, and `tests/muscles.test.ts`
 * fails if the catalog ever names one that a locale does not explain.
 */

/** Exactly the names that appear in `Exercise.primaryMuscles`, in catalog order. */
export const MUSCLE_IDS = [
	'abdominals',
	'abductors',
	'adductors',
	'biceps',
	'calves',
	'chest',
	'forearms',
	'glutes',
	'hamstrings',
	'lats',
	'lower back',
	'middle back',
	'neck',
	'quadriceps',
	'shoulders',
	'traps',
	'triceps'
] as const;

export type MuscleId = (typeof MUSCLE_IDS)[number];

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

function isMuscleId(id: string): id is MuscleId {
	return (MUSCLE_IDS as readonly string[]).includes(id);
}

export function muscleInfo(id: string, t: Messages): MuscleInfo | undefined {
	if (!isMuscleId(id)) return undefined;
	return { id, ...t.muscles.names[id] };
}

/** "Quadriceps", or the raw id if it is somehow unknown. */
export function muscleLabel(id: string, t: Messages): string {
	return isMuscleId(id) ? t.muscles.names[id].label : id;
}

/** "quadriceps (front of thigh)" — the inline form, for lists of muscles. */
export function muscleWithHint(id: string, t: Messages): string {
	const info = muscleInfo(id, t);
	return info ? t.muscles.withHint(info.label, info.short) : id;
}

/**
 * How the figure is coarser than the word, for the three muscles where it is
 * (§4.6, `APPROXIMATED` in `body-map.ts`). Completes "On the figure this ___."
 * and is `undefined` for the fourteen the model maps exactly.
 */
export function muscleApproximation(id: string, t: Messages): string | undefined {
	const approximated = t.muscles.approximated;
	return id in approximated ? approximated[id as keyof typeof approximated] : undefined;
}

/** The short hint on its own, for the picker and the routine editor. */
export function muscleShort(id: string, t: Messages): string {
	return isMuscleId(id) ? t.muscles.names[id].short : id;
}

export interface MuscleUsage {
	id: MuscleId;
	/** Exercises where this is a primary muscle. */
	primary: number;
	/** Exercises where it only assists. */
	secondary: number;
}

/**
 * How much of the catalog trains each muscle, for the compendium. Counted over
 * the whole catalog rather than the owned subset: the page explains the words,
 * and the words do not change when a box is ticked.
 *
 * Ordering by the count is locale-independent, so it is computed once here.
 * Ties are broken by id rather than by label, because a label is now a
 * translation and the order of the page should not change with the language.
 */
export const muscleUsage: MuscleUsage[] = MUSCLE_IDS.map((id) => ({
	id,
	primary: catalog.filter((e) => e.primaryMuscles.includes(id)).length,
	secondary: catalog.filter((e) => e.secondaryMuscles.includes(id)).length
})).sort((a, b) => b.primary - a.primary || a.id.localeCompare(b.id));

/** Every muscle name the catalog actually uses, primary or secondary. */
export function musclesInCatalog(): string[] {
	const seen = new Set<string>();
	for (const e of catalog) {
		for (const m of e.primaryMuscles) seen.add(m);
		for (const m of e.secondaryMuscles) seen.add(m);
	}
	return [...seen].sort();
}
