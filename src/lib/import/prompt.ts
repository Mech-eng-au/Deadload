import type { EquipmentId } from '../types.js';
import type { Messages } from '../i18n/index.js';
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
export function equipmentSentence(owned: EquipmentId[], t: Messages): string {
	const labels = GATED_EQUIPMENT.filter((type) => owned.includes(type.id)).map((type) =>
		equipmentLabel(type.id, t).toLowerCase()
	);
	if (labels.length === 0) return t.equipment.noneOwned;
	return labels.join(', ');
}

/**
 * The prompt stays **English whatever the interface language is** (§16): it is
 * an instruction to a model, its JSON keys are English, and the exercise ids it
 * has to quote are English. What is generated per language is the one line
 * telling the model which language to write the routine's prose in — because
 * the name, the description and the notes end up as the user's own data, on
 * their screen, in their language.
 */
export function buildPrompt(owned: EquipmentId[], t: Messages, language: string): string {
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

For an exercise whose \`equipment\` includes \`dumbbells\` or \`kettlebell\`, you may set \`load_kg\` to the mass of the implement in kilograms. Set it on nothing else: there is no load to record for a band, and a weighted pull-up is not supported because the real load includes body weight, which this app does not track.

${t.importer.promptLanguageLine(language)}

Goal: [describe the goal here]
Target duration: [minutes]
Equipment available: ${equipmentSentence(owned, t)}
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
export function equipmentChipLabels(owned: EquipmentId[], t: Messages): string[] {
	return owned.map((id) => equipmentLabel(id, t));
}
