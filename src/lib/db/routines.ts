import { formatKg } from '../catalog/load.js';
import type { Messages } from '../i18n/index.js';
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

/**
 * Human-readable target, e.g. "3 × 45 s per side".
 *
 * Built rather than looked up, which is why every piece of it comes from the
 * dictionary separately: a language is free to put the set count after the
 * target, or to inflect "per side", and it can do that because the pieces are
 * message functions rather than slots in one template string.
 */
export function describeItem(item: RoutineItem, t: Messages): string {
	let target: string;
	switch (item.target.kind) {
		case 'reps':
			target = t.units.reps(item.target.reps);
			break;
		case 'reps_range':
			target = t.units.repsRange(item.target.min, item.target.max);
			break;
		case 'duration':
			target = t.units.seconds(item.target.seconds);
			break;
		case 'amrap':
			target = t.units.amrap;
			break;
	}
	const sets = t.units.setsPrefix(item.sets);
	const load = item.loadKg === undefined ? '' : t.units.atLoad(formatKg(item.loadKg, t));
	return `${sets}${target}${load}${item.perSide ? ` ${t.units.perSide}` : ''}`;
}

export function countItems(routine: Routine): number {
	return routine.blocks.reduce((n, b) => n + b.items.length, 0);
}

/**
 * Whether reordering is possible at all (§12). One exercise has nowhere to go,
 * however many sections there are to put it in.
 *
 * Here rather than inline on the routine screen because two things have to agree
 * about it: `SortableList` disables the handle, and the screen hides the toggle
 * that reveals the handle. Out of step, the toggle opens a mode in which every
 * control is dead.
 */
export function canReorder(routine: Routine): boolean {
	return countItems(routine) > 1;
}
