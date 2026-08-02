import type { Messages } from '../i18n/index.js';
import type { EquipmentId, Exercise } from '../types.js';

/**
 * Load (docs/SPEC.md §4.5). Separate from `equipment.ts` because that module
 * reads `catalog.json` for its counts, and these three functions need nothing
 * but the exercise handed to them — which keeps `src/lib/import/` and
 * `src/lib/session/steps.ts` as free of data dependencies as §15 asks.
 */

/**
 * Equipment that has a mass worth recording. Dumbbells and a kettlebell, and
 * deliberately nothing else:
 *
 * - A **resistance band** has no kilograms. Its tension depends on how far it is
 *   stretched, and a manufacturer's colour code is not a unit, so any number
 *   would be invented.
 * - A **pull-up bar** has no mass in the sense that matters. Hanging a plate off
 *   a belt makes the load the plate *plus the body*, and body weight is
 *   something §1 refuses to track — so `reps × plate` is not the work done, and
 *   weighted pull-ups and dips stay out of scope.
 */
export const LOADABLE_EQUIPMENT: EquipmentId[] = ['dumbbells', 'kettlebell'];

/** Whether a load in kilograms is a real measurement for this exercise. */
export function isLoadable(exercise: Pick<Exercise, 'equipment'>): boolean {
	return exercise.equipment.some((id) => LOADABLE_EQUIPMENT.includes(id));
}

/**
 * "10 kg", "2.5 kg" — trailing zeros trimmed, because "10.0 kg" reads as a
 * scale. The separator is the locale's, so the same number is "2,5 kg" in
 * Danish; that comes from `Intl.NumberFormat` rather than from a rule here.
 *
 * **Never used for a file.** The CSV and the backup are machine formats and
 * write the raw number, because a spreadsheet in one locale must not fail to
 * read a file written in another (§16).
 */
export function formatKg(kg: number, t: Messages): string {
	return t.units.kg(kg);
}
