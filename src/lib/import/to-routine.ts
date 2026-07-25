import type { Exercise, ExerciseId, Routine, RoutineItem, Target } from '../types.js';
import type { ParsedRoutine } from './parse-json.js';
import { resolve, type ResolveResult, type ResolverIndex } from './resolve.js';
import type { ImportNote, WireItem } from './types.js';

/**
 * Mapping from the wire format to the internal model (§6.1). Pure: ids are
 * supplied so the caller controls uuid generation, and nothing here touches the
 * database or Svelte.
 */

export interface ReviewItem {
	key: string;
	/** The name exactly as it was written in the file. */
	written: string;
	raw: WireItem;
	result: ResolveResult;
	/** Set once resolved automatically, or picked by the user. */
	chosen?: ExerciseId;
	/** Whether to write the user's pick to aliasOverrides. */
	remember: boolean;
	dropped: boolean;
}

export interface ReviewBlock {
	key: string;
	label?: string;
	circuit?: boolean;
	items: ReviewItem[];
}

export interface ReviewModel {
	name: string;
	goal?: string;
	description?: string;
	tags: string[];
	blocks: ReviewBlock[];
	notes: ImportNote[];
}

export function buildReview(
	parsed: ParsedRoutine,
	index: ResolverIndex,
	overrides: Map<string, ExerciseId>,
	newKey: () => string
): ReviewModel {
	const blocks = parsed.blocks.map((b) => ({
		key: newKey(),
		label: b.label,
		circuit: b.circuit,
		items: b.items.map((raw) => {
			const result = resolve(raw.exercise, index, overrides);
			return {
				key: newKey(),
				written: raw.exercise,
				raw,
				result,
				chosen: result.status === 'resolved' ? result.exerciseId : undefined,
				remember: true,
				dropped: false
			} satisfies ReviewItem;
		})
	}));

	return {
		name: parsed.name?.trim() || 'Imported routine',
		goal: parsed.goal,
		description: parsed.description,
		tags: parsed.tags,
		blocks,
		notes: parsed.notes
	};
}

/** How many target fields the item actually specified. */
function targetKeys(raw: WireItem): string[] {
	const keys: string[] = [];
	if (raw.reps !== undefined) keys.push('reps');
	if (raw.reps_min !== undefined || raw.reps_max !== undefined) keys.push('reps_min/reps_max');
	if (raw.duration_seconds !== undefined) keys.push('duration_seconds');
	if (raw.amrap) keys.push('amrap');
	return keys;
}

function isTimed(exercise: Exercise): boolean {
	return exercise.category === 'stretch' || exercise.category === 'mobility';
}

export function deriveTarget(raw: WireItem, exercise: Exercise): Target {
	const specified = targetKeys(raw);

	// "If more than one is present, prefer duration_seconds for stretch|mobility
	// exercises and reps otherwise" (§6.1).
	if (specified.length > 1) {
		if (isTimed(exercise) && raw.duration_seconds !== undefined) {
			return { kind: 'duration', seconds: raw.duration_seconds };
		}
		if (raw.reps !== undefined) return { kind: 'reps', reps: raw.reps };
	}

	if (raw.duration_seconds !== undefined) return { kind: 'duration', seconds: raw.duration_seconds };
	if (raw.reps_min !== undefined || raw.reps_max !== undefined) {
		const min = raw.reps_min ?? raw.reps_max ?? 1;
		const max = raw.reps_max ?? raw.reps_min ?? min;
		return { kind: 'reps_range', min: Math.min(min, max), max: Math.max(min, max) };
	}
	if (raw.reps !== undefined) return { kind: 'reps', reps: raw.reps };
	if (raw.amrap) return { kind: 'amrap' };

	// Nothing specified at all: fall back to how the exercise is normally done.
	return exercise.defaultMetric === 'duration'
		? { kind: 'duration', seconds: 30 }
		: { kind: 'reps', reps: 10 };
}

export function toRoutineItem(
	raw: WireItem,
	exercise: Exercise,
	id: string,
	notes: ImportNote[]
): RoutineItem {
	const specified = targetKeys(raw);
	if (specified.length > 1) {
		notes.push({
			level: 'warning',
			message: `${exercise.name} specified ${specified.join(' and ')}; used ${
				isTimed(exercise) && raw.duration_seconds !== undefined ? 'the duration' : 'the reps'
			}.`
		});
	}

	return {
		id,
		exerciseId: exercise.id,
		sets: Math.max(1, raw.sets ?? 1),
		target: deriveTarget(raw, exercise),
		perSide: raw.per_side ?? exercise.unilateral,
		restSeconds: raw.rest_seconds ?? (isTimed(exercise) ? 0 : 30),
		tempo: raw.tempo,
		notes: raw.notes
	};
}

/** Every remaining item must be resolved; the caller enforces that in the UI. */
export function toRoutine(
	review: ReviewModel,
	index: ResolverIndex,
	newId: () => string,
	source: Routine['source'] = 'imported'
): { routine: Routine; notes: ImportNote[] } {
	const notes: ImportNote[] = [...review.notes];
	const timestamp = new Date().toISOString();

	const blocks = review.blocks
		.map((b) => ({
			id: newId(),
			label: b.label,
			mode: b.circuit ? ('circuit' as const) : undefined,
			items: b.items
				.filter((i) => !i.dropped && i.chosen)
				.map((i) => {
					const exercise = index.byId.get(i.chosen!);
					if (!exercise) throw new Error(`Unknown exercise ${i.chosen}`);
					return toRoutineItem(i.raw, exercise, newId(), notes);
				})
		}))
		.filter((b) => b.items.length > 0);

	return {
		routine: {
			id: newId(),
			name: review.name.trim() || 'Imported routine',
			description: review.description,
			goal: review.goal,
			tags: review.tags,
			blocks,
			source,
			createdAt: timestamp,
			updatedAt: timestamp
		},
		notes
	};
}
