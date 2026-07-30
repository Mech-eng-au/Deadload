import { z } from 'zod';

/**
 * The wire format an LLM is asked to emit (docs/SPEC.md §6.1). Deliberately
 * kept separate from the internal Routine model: tolerant on field names,
 * strict on structure, and never allowed to leak into src/lib/types.ts.
 *
 * This module must stay free of Svelte imports so it can be tested headlessly.
 */

/** LLMs emit "3" as often as 3. */
const looseInt = z.union([z.number(), z.string()]).transform((v, ctx) => {
	const n = typeof v === 'number' ? v : Number(v.trim());
	if (!Number.isFinite(n)) {
		ctx.addIssue({ code: 'custom', message: `expected a number, got ${JSON.stringify(v)}` });
		return z.NEVER;
	}
	return Math.round(n);
});

/**
 * Same tolerance, without the rounding: a load is 2.5 kg as often as 10 (§4.5).
 * Rounding it would silently turn a 7.5 kg dumbbell into an 8 kg one.
 */
const looseNumber = z.union([z.number(), z.string()]).transform((v, ctx) => {
	const n = typeof v === 'number' ? v : Number(v.trim().replace(/\s*kg$/i, ''));
	if (!Number.isFinite(n)) {
		ctx.addIssue({ code: 'custom', message: `expected a number, got ${JSON.stringify(v)}` });
		return z.NEVER;
	}
	return n;
});

const looseBool = z.union([z.boolean(), z.string()]).transform((v) => {
	if (typeof v === 'boolean') return v;
	return ['true', 'yes', '1', 'y'].includes(v.trim().toLowerCase());
});

export const wireItemSchema = z
	.object({
		exercise: z.union([z.string(), z.number()]).transform(String),
		sets: looseInt.optional(),
		reps: looseInt.optional(),
		reps_min: looseInt.optional(),
		reps_max: looseInt.optional(),
		duration_seconds: looseInt.optional(),
		amrap: looseBool.optional(),
		per_side: looseBool.optional(),
		rest_seconds: looseInt.optional(),
		load_kg: looseNumber.optional(),
		tempo: z.string().optional(),
		notes: z.string().optional()
	})
	// "Unknown top-level keys are ignored, not rejected. LLMs add fields."
	.loose();

export const wireBlockSchema = z
	.object({
		label: z.string().optional(),
		items: z.array(wireItemSchema).optional(),
		// "accept `exercises` as a synonym for `items`"
		exercises: z.array(wireItemSchema).optional(),
		// A circuit block: one set of each item per round. Accept either
		// `"circuit": true` or `"mode": "circuit"`.
		circuit: looseBool.optional(),
		mode: z.string().optional()
	})
	.loose();

export const wireRoutineSchema = z
	.object({
		schema: z.string().optional(),
		name: z.string().optional(),
		goal: z.string().optional(),
		description: z.string().optional(),
		tags: z.array(z.string()).optional(),
		blocks: z.array(wireBlockSchema).optional(),
		items: z.array(wireItemSchema).optional(),
		exercises: z.array(wireItemSchema).optional()
	})
	.loose();

/** "Accept a bare array of items with no `blocks` wrapper." */
export const wireDocumentSchema = z.union([wireRoutineSchema, z.array(wireItemSchema)]);

export type WireItem = z.infer<typeof wireItemSchema>;
export type WireBlock = z.infer<typeof wireBlockSchema>;
export type WireRoutine = z.infer<typeof wireRoutineSchema>;
export type WireDocument = z.infer<typeof wireDocumentSchema>;

/** Non-fatal observations to show the user on the review screen. */
export interface ImportNote {
	level: 'warning' | 'info';
	message: string;
	/** Index into the flattened item list, when the note is about one item. */
	itemIndex?: number;
}
