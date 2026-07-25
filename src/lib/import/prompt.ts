/** The routine-generation prompt from docs/SPEC.md §14, shipped on the import screen. */
export const LLM_PROMPT = `You are writing a bodyweight training routine that will be imported into an app.

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

Goal: [describe the goal here]
Target duration: [minutes]
Constraints: [injuries, available space, floor only, pull-up bar available, and so on]`;
