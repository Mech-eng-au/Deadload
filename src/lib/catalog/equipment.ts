import type { Messages } from '../i18n/index.js';
import type { EquipmentId, Exercise, Settings } from '../types.js';
import { catalog } from './index.js';

/**
 * The equipment table (docs/SPEC.md §5.1).
 *
 * §1 assumes a floor, a wall and a chair and nothing else. Everything in this
 * table beyond `chair` is something somebody had to buy, which is what makes it
 * worth asking about — and what makes it wrong to show unasked.
 */
export interface EquipmentType {
	id: EquipmentId;
	/**
	 * Gated types are filtered out of catalog browse and the exercise picker when
	 * unticked. `chair` is not gated: furniture is not a purchase, so it earns a
	 * chip and nothing more.
	 */
	gated: boolean;
}

export const EQUIPMENT: EquipmentType[] = [
	{ id: 'pull_up_bar', gated: true },
	{ id: 'jumping_rope', gated: true },
	{ id: 'dumbbells', gated: true },
	{ id: 'kettlebell', gated: true },
	{ id: 'resistance_band', gated: true },
	{ id: 'foam_roller', gated: true },
	{ id: 'yoga_ball', gated: true },
	{ id: 'suspension_trainer', gated: true },
	{ id: 'ab_wheel', gated: true },
	{ id: 'chair', gated: false }
];

const byId = new Map<EquipmentId, EquipmentType>(EQUIPMENT.map((t) => [t.id, t]));

/** The types worth a checkbox, in the order they appear in Settings. */
export const GATED_EQUIPMENT: EquipmentType[] = EQUIPMENT.filter((t) => t.gated);

/**
 * What `Settings.ownedEquipment === undefined` means: the question has never
 * been asked, and the catalog assumes a bar (§5.1).
 */
export const DEFAULT_OWNED: EquipmentId[] = ['pull_up_bar'];

export function equipmentLabel(id: EquipmentId, t: Messages): string {
	return t.equipment.labels[id] ?? id;
}

/** What owning it actually means, so the user can answer the question. */
export function equipmentNeeds(id: EquipmentId, t: Messages): string {
	return t.equipment.needs[id] ?? '';
}

/** Anything about this type worth one line in Settings, if there is any. */
export function equipmentNote(id: EquipmentId, t: Messages): string | undefined {
	return id === 'pull_up_bar' || id === 'chair' ? t.equipment.notes[id] : undefined;
}

export function isGated(id: EquipmentId): boolean {
	return byId.get(id)?.gated ?? false;
}

/**
 * The owned set, resolving the three-valued setting (§5.1).
 *
 * `undefined` is "never answered" and gets the default; `[]` is "owns nothing"
 * and is returned as it stands. Collapsing the two would hand pull-ups back to a
 * user who had deliberately unticked every box, which is why nothing reads
 * `settings.ownedEquipment` directly.
 */
export function ownedEquipment(settings: Settings | null | undefined): EquipmentId[] {
	const owned = settings?.ownedEquipment;
	return owned === undefined ? [...DEFAULT_OWNED] : owned;
}

/** True when the user has said they own this, or it is not something to own. */
export function owns(owned: EquipmentId[], id: EquipmentId): boolean {
	return !isGated(id) || owned.includes(id);
}

/**
 * The gated equipment an exercise needs that the user has not ticked. Empty for
 * anything they can do today — which is what the chips and warnings key off, so
 * an ungated `chair` never produces a warning.
 */
export function missingEquipment(exercise: Exercise, owned: EquipmentId[]): EquipmentId[] {
	return exercise.equipment.filter((id) => !owns(owned, id));
}

/**
 * Whether an exercise may be *offered* — catalog browse and the exercise picker,
 * and nowhere else (§5.1). A routine the user already has, a logged set and a
 * preset all keep showing theirs with a chip: hiding is about what the app
 * suggests, never about what the user has already decided to do.
 */
export function isAvailable(exercise: Exercise, owned: EquipmentId[]): boolean {
	return missingEquipment(exercise, owned).length === 0;
}

/** The catalog filtered to what can be offered. */
export function availableCatalog(owned: EquipmentId[]): Exercise[] {
	return catalog.filter((e) => isAvailable(e, owned));
}

/** How many exercises each type unlocks, for the Settings rows. */
export const countByEquipment: Record<EquipmentId, number> = EQUIPMENT.reduce(
	(acc, t) => {
		acc[t.id] = catalog.filter((e) => e.equipment.includes(t.id)).length;
		return acc;
	},
	{} as Record<EquipmentId, number>
);

/** "1 exercise" / "14 exercises" — the count is shown even when it is 1 (§5.1). */
export function exerciseCountLabel(id: EquipmentId, t: Messages): string {
	return t.equipment.exerciseCount(countByEquipment[id] ?? 0);
}

// Load (§4.5) lives in ./load.ts, which needs no catalog data. Re-exported here
// so a screen that already imports this module does not need a second import.
export { LOADABLE_EQUIPMENT, formatKg, isLoadable } from './load.js';
