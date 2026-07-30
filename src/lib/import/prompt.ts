import type { EquipmentId } from '../types.js';
import { availableCatalog, equipmentLabel, GATED_EQUIPMENT } from '../catalog/equipment.js';

/**
 * The routine-generation prompt from docs/SPEC.md §14, shipped on the import
 * screen.
 *
 * Amended 2026-07-30: the equipment line is generated rather than left as a
 * blank to fill in, and the catalog file that goes with it is built here from
 * `catalog.json` instead of being a static build artefact. A file emitted on a
 * laptop months earlier cannot reflect what the user has ticked in Settings, so
 * the old one handed the model every kettlebell exercise in the catalog and the
 * routine that came back was unusable (§5.1).
 */

/** "dumbbells, jumping rope" — the owned gated types, in Settings order. */
export function equipmentSentence(owned: EquipmentId[]): string {
	const labels = GATED_EQUIPMENT.filter((t) => owned.includes(t.id)).map((t) =>
		t.label.toLowerCase()
	);
	if (labels.length === 0) return 'none — floor, wall and chair only';
	return labels.join(', ');
}

export function buildPrompt(owned: EquipmentId[]): string {
	return `You are writing a bodyweight training routine that will be imported into an app.

Use only exercises from the attached catalog file, and reference them by their exact \`id\` value. Do not invent exercises. If the routine needs a movement that is not in the catalog, pick the closest available one and note the substitution in the item's \`notes\`.

Output a single JSON object, no prose, no markdown fences, matching this shape:

{
  "schema": "deadload.routine/1",
  "name": "",
  "goal": "",
  "description": "",
  "tags": [],
  "blocks": [
    { "label": "Warm-up", "items": [
      { "exercise": "<catalog id>", "sets": 1, "reps": 10, "rest_seconds": 0, "notes": "" }
    ]}
  ]
}

Per item, use exactly one of \`reps\`, \`duration_seconds\`, \`reps_min\` + \`reps_max\`, or \`"amrap": true\`. Set \`per_side: true\` for anything performed one side at a time. All durations in seconds. Use metric units throughout.

To alternate exercises as a circuit or superset, set \`"circuit": true\` on the block: each round performs one set of every item in order. Rest is still taken after each set as its \`rest_seconds\` says, so for rest only between rounds give every item 0 except the block's last.

Every exercise in the catalog file lists what it needs in \`equipment\`. The file has already been filtered to what is available, so anything in it can be performed.

Goal: [describe the goal here]
Target duration: [minutes]
Equipment available: ${equipmentSentence(owned)}
Constraints: [injuries, available space, and so on]`;
}

/** One catalog entry as the model sees it. */
export interface LlmExercise {
	id: string;
	name: string;
	category: string;
	equipment: EquipmentId[];
}

/**
 * The catalog file that goes with the prompt, filtered to what the user owns.
 * `equipment` is on every entry so the model can see why an exercise is there —
 * and so a routine that came back with a kettlebell in it is traceable to the
 * box that was ticked.
 */
export function buildLlmCatalog(owned: EquipmentId[]): LlmExercise[] {
	return availableCatalog(owned).map(({ id, name, category, equipment }) => ({
		id,
		name,
		category,
		equipment
	}));
}

export function llmCatalogJson(owned: EquipmentId[]): string {
	return JSON.stringify(buildLlmCatalog(owned), null, '\t') + '\n';
}

/** Human-readable equipment list for the chip on the import screen. */
export function equipmentChipLabels(owned: EquipmentId[]): string[] {
	return owned.map(equipmentLabel);
}
