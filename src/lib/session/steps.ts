import type { Routine, RoutineItem, Target } from '../types.js';

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

export function expandRoutine(routine: Routine): Step[] {
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
					exerciseId: item.exerciseId,
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

export function itemOf(routine: Routine, itemId: string): RoutineItem | undefined {
	for (const block of routine.blocks) {
		const found = block.items.find((i) => i.id === itemId);
		if (found) return found;
	}
	return undefined;
}
