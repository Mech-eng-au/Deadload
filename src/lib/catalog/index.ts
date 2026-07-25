import type { Attribution, Category, Exercise, ExerciseId } from '../types.js';
import catalogJson from './catalog.json' with { type: 'json' };
import attributionJson from './attribution.json' with { type: 'json' };

export const catalog = catalogJson as Exercise[];
export const attributions = attributionJson as Attribution[];

const byId = new Map<ExerciseId, Exercise>(catalog.map((e) => [e.id, e]));
const attributionById = new Map<string, Attribution>(attributions.map((a) => [a.id, a]));

export function getExercise(id: ExerciseId): Exercise | undefined {
	return byId.get(id);
}

export function getAttribution(id: string): Attribution | undefined {
	return attributionById.get(id);
}

export const categories: Category[] = ['strength', 'core', 'stretch', 'mobility', 'cardio'];

export const countByCategory: Record<string, number> = catalog.reduce(
	(acc, e) => ((acc[e.category] = (acc[e.category] ?? 0) + 1), acc),
	{} as Record<string, number>
);
