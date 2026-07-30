import { formatKg } from '../catalog/load.js';
import type { Block, Routine, RoutineItem, Target } from '../types.js';
import { getDb, toPlain } from './schema.js';

export function uid(): string {
	return crypto.randomUUID();
}

function now(): string {
	return new Date().toISOString();
}

/** Newest first, so the home screen leads with what was last touched. */
export async function listRoutines(): Promise<Routine[]> {
	const db = await getDb();
	const all = await db.getAllFromIndex('routines', 'updatedAt');
	return all.reverse();
}

export async function getRoutine(id: string): Promise<Routine | undefined> {
	const db = await getDb();
	return db.get('routines', id);
}

export async function putRoutine(routine: Routine): Promise<Routine> {
	const db = await getDb();
	const saved: Routine = toPlain({ ...routine, updatedAt: now() });
	await db.put('routines', saved);
	return saved;
}

export async function deleteRoutine(id: string): Promise<void> {
	const db = await getDb();
	await db.delete('routines', id);
}

export function emptyRoutine(): Routine {
	const timestamp = now();
	return {
		id: uid(),
		name: '',
		tags: [],
		blocks: [emptyBlock()],
		source: 'user',
		createdAt: timestamp,
		updatedAt: timestamp
	};
}

export function emptyBlock(label = ''): Block {
	return { id: uid(), label, items: [] };
}

/**
 * Defaults for a freshly added exercise. Deliberately the same rules the import
 * parser applies (§6.1), so a routine built by hand and one imported from an
 * LLM behave identically.
 */
export function newItem(exercise: {
	id: string;
	unilateral: boolean;
	defaultMetric: 'reps' | 'duration';
	category: string;
}): RoutineItem {
	const timed = exercise.defaultMetric === 'duration';
	const target: Target = timed ? { kind: 'duration', seconds: 30 } : { kind: 'reps', reps: 10 };
	return {
		id: uid(),
		exerciseId: exercise.id,
		sets: 1,
		target,
		perSide: exercise.unilateral,
		restSeconds: exercise.category === 'stretch' || exercise.category === 'mobility' ? 0 : 30
	};
}

/** Human-readable target, e.g. "3 × 45 s per side". */
export function describeItem(item: RoutineItem): string {
	let target: string;
	switch (item.target.kind) {
		case 'reps':
			target = `${item.target.reps} reps`;
			break;
		case 'reps_range':
			target = `${item.target.min}–${item.target.max} reps`;
			break;
		case 'duration':
			target = `${item.target.seconds} s`;
			break;
		case 'amrap':
			target = 'as many as possible';
			break;
	}
	const sets = item.sets > 1 ? `${item.sets} × ` : '';
	const load = item.loadKg !== undefined ? ` at ${formatKg(item.loadKg)}` : '';
	return `${sets}${target}${load}${item.perSide ? ' per side' : ''}`;
}

export function countItems(routine: Routine): number {
	return routine.blocks.reduce((n, b) => n + b.items.length, 0);
}
