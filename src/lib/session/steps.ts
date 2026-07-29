import type { ExerciseId, Routine, RoutineItem, Target } from '../types.js';

/** `RoutineItem.id` -> the exercise actually being performed (§4.3, §7). */
export type Swaps = Record<string, ExerciseId>;

/**
 * A routine flattened into the exact sequence of things the user will be asked
 * to do (docs/SPEC.md §7). Pure, so the ordering rules are unit-testable.
 *
 * One step per set, and per side when the item is unilateral, because §4.3
 * requires one SetEntry row per performed set.
 */
export interface Step {
	itemId: string;
	exerciseId: string;
	blockLabel?: string;
	/** 0-based, as stored on SetEntry. */
	setIndex: number;
	setCount: number;
	side?: 'left' | 'right';
	target: Target;
	/** Rest owed *after* this step. Zero on the last side of a per-side set. */
	restSeconds: number;
	notes?: string;
	tempo?: string;
	/** Set on steps from a circuit block: 0-based round, and the block's total. */
	round?: number;
	roundCount?: number;
}

/**
 * `swaps` substitutes the exercise on an item without touching anything else
 * about it: the number of sets, the target, the sides and the rest are the
 * item's, not the exercise's. That is what makes a swap safe mid-session — the
 * step sequence keeps its shape, so `entries.length` still identifies where the
 * user is on resume.
 */
export function expandRoutine(routine: Routine, swaps: Swaps = {}): Step[] {
	const steps: Step[] = [];

	for (const block of routine.blocks) {
		const pushSet = (item: (typeof block.items)[number], setIndex: number, round?: RoundInfo) => {
			const sides: (('left' | 'right') | undefined)[] = item.perSide
				? ['left', 'right']
				: [undefined];

			sides.forEach((side, sideIndex) => {
				// Rest belongs after the whole set, so the second side follows the
				// first immediately rather than resting in between.
				const isLastOfSet = sideIndex === sides.length - 1;
				steps.push({
					itemId: item.id,
					exerciseId: swaps[item.id] ?? item.exerciseId,
					blockLabel: block.label,
					setIndex,
					setCount: Math.max(1, item.sets),
					side,
					target: item.target,
					restSeconds: isLastOfSet ? item.restSeconds : 0,
					notes: item.notes,
					tempo: item.tempo,
					round: round?.index,
					roundCount: round?.count
				});
			});
		};

		if (block.mode === 'circuit') {
			// Round-robin: one set of each item in order, then the next round.
			// Items with fewer sets simply drop out of later rounds, so an item's
			// setIndex always equals the round it was performed in — which keeps
			// the entries-per-step invariant the player resumes by.
			const rounds = Math.max(1, ...block.items.map((i) => Math.max(1, i.sets)));
			for (let round = 0; round < rounds; round++) {
				for (const item of block.items) {
					if (round < Math.max(1, item.sets)) {
						pushSet(item, round, { index: round, count: rounds });
					}
				}
			}
		} else {
			for (const item of block.items) {
				for (let setIndex = 0; setIndex < Math.max(1, item.sets); setIndex++) {
					pushSet(item, setIndex);
				}
			}
		}
	}

	return steps;
}

interface RoundInfo {
	index: number;
	count: number;
}

/** "Set 2 of 3 · 45 s per side" — the line under the exercise name. */
export function describeStep(step: Step): string {
	let target: string;
	switch (step.target.kind) {
		case 'reps':
			target = `${step.target.reps} reps`;
			break;
		case 'reps_range':
			target = `${step.target.min}–${step.target.max} reps`;
			break;
		case 'duration':
			target = `${step.target.seconds} s`;
			break;
		case 'amrap':
			target = 'as many as possible';
			break;
	}
	// In a circuit the round is the number worth knowing; the per-item set
	// counter would just restate it.
	const set =
		step.round !== undefined && step.roundCount !== undefined && step.roundCount > 1
			? `Round ${step.round + 1} of ${step.roundCount} · `
			: step.setCount > 1
				? `Set ${step.setIndex + 1} of ${step.setCount} · `
				: '';
	const side = step.side ? ` · ${step.side}` : '';
	return `${set}${target}${side}`;
}

/**
 * Roughly how long a reps set takes, for the estimate below. Deliberately one
 * number rather than a per-exercise tempo: the estimate is a chip on a routine
 * screen, not a promise, and a table of made-up tempos would look more precise
 * than it is.
 */
const SECONDS_PER_REP = 3;
/** An AMRAP set has no target to add up, so it is counted as a typical set. */
const AMRAP_SECONDS = 30;

/**
 * Estimated length of a routine in seconds: every set's target plus the rest
 * owed after it. Used for the "~12 min" chip, so it is rounded and honest about
 * being an estimate — it cannot know how long you take to get onto the floor.
 */
export function estimateSeconds(routine: Routine): number {
	return expandRoutine(routine).reduce((total, step) => {
		let work: number;
		switch (step.target.kind) {
			case 'duration':
				work = step.target.seconds;
				break;
			case 'reps':
				work = step.target.reps * SECONDS_PER_REP;
				break;
			case 'reps_range':
				work = step.target.max * SECONDS_PER_REP;
				break;
			case 'amrap':
				work = AMRAP_SECONDS;
				break;
		}
		return total + work + step.restSeconds;
	}, 0);
}

/** What the log control should start at, so accepting the target is one tap. */
export function prefillFor(target: Target): number | undefined {
	switch (target.kind) {
		case 'reps':
			return target.reps;
		case 'reps_range':
			return target.max;
		case 'duration':
			return target.seconds;
		case 'amrap':
			return undefined;
	}
}

export function isTimed(target: Target): boolean {
	return target.kind === 'duration';
}

export function totalSets(routine: Routine): number {
	return routine.blocks.reduce(
		(n, b) => n + b.items.reduce((m, i) => m + Math.max(1, i.sets) * (i.perSide ? 2 : 1), 0),
		0
	);
}

/** Item-level progress, for the "3 of 12" line rather than per-side counting. */
export function stepLabelIndex(steps: Step[], index: number): { done: number; total: number } {
	return { done: index + 1, total: steps.length };
}

/**
 * Fold a session's swaps into the routine, for when the user keeps them (§7).
 * Returns a new routine; items with no swap are left alone, and a swap for an
 * item that has since been deleted is dropped rather than resurrecting it.
 *
 * `isUnilateral` lets `perSide` follow the new exercise — the same default an
 * exercise added by hand gets. Mid-session it deliberately does not: changing
 * the number of sides would change the number of steps, and the player finds
 * its place on resume by counting logged entries against them. Here the session
 * is over, so the routine can take the shape the exercise actually wants.
 */
export function applySwaps(
	routine: Routine,
	swaps: Swaps,
	isUnilateral?: (id: ExerciseId) => boolean
): Routine {
	return {
		...routine,
		blocks: routine.blocks.map((block) => ({
			...block,
			items: block.items.map((item) => {
				const exerciseId = swaps[item.id];
				if (!exerciseId) return item;
				return {
					...item,
					exerciseId,
					perSide: isUnilateral ? isUnilateral(exerciseId) : item.perSide
				};
			})
		}))
	};
}

export function itemOf(routine: Routine, itemId: string): RoutineItem | undefined {
	for (const block of routine.blocks) {
		const found = block.items.find((i) => i.id === itemId);
		if (found) return found;
	}
	return undefined;
}
