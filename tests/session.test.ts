import { describe, expect, it } from 'vitest';
import { describeStep, expandRoutine, prefillFor, totalSets } from '../src/lib/session/steps.js';
import type { Routine } from '../src/lib/types.js';

function routine(
	items: Partial<Routine['blocks'][0]['items'][0]>[],
	label?: string,
	mode?: 'circuit'
): Routine {
	return {
		id: 'r',
		name: 'Test',
		tags: [],
		source: 'user',
		createdAt: '',
		updatedAt: '',
		blocks: [
			{
				id: 'b',
				label,
				mode,
				items: items.map((i, n) => ({
					id: `i${n}`,
					exerciseId: `e${n}`,
					sets: 1,
					target: { kind: 'reps', reps: 10 },
					perSide: false,
					restSeconds: 0,
					...i
				}))
			}
		]
	};
}

describe('step expansion (§7)', () => {
	it('produces one step per set', () => {
		const steps = expandRoutine(routine([{ sets: 3 }]));
		expect(steps).toHaveLength(3);
		expect(steps.map((s) => s.setIndex)).toEqual([0, 1, 2]);
		expect(steps.every((s) => s.setCount === 3)).toBe(true);
	});

	it('splits a per-side set into left and right rows', () => {
		const steps = expandRoutine(routine([{ sets: 2, perSide: true }]));
		expect(steps).toHaveLength(4);
		expect(steps.map((s) => s.side)).toEqual(['left', 'right', 'left', 'right']);
		expect(steps.map((s) => s.setIndex)).toEqual([0, 0, 1, 1]);
	});

	it('rests after the whole set, not between the two sides', () => {
		const steps = expandRoutine(routine([{ sets: 2, perSide: true, restSeconds: 30 }]));
		expect(steps.map((s) => s.restSeconds)).toEqual([0, 30, 0, 30]);
	});

	it('keeps rest between plain sets', () => {
		const steps = expandRoutine(routine([{ sets: 3, restSeconds: 45 }]));
		expect(steps.map((s) => s.restSeconds)).toEqual([45, 45, 45]);
	});

	it('carries the block label, notes and tempo onto every step', () => {
		const steps = expandRoutine(routine([{ sets: 2, notes: 'slow', tempo: '3-1-1-0' }], 'Warm-up'));
		expect(steps.every((s) => s.blockLabel === 'Warm-up')).toBe(true);
		expect(steps.every((s) => s.notes === 'slow' && s.tempo === '3-1-1-0')).toBe(true);
	});

	it('treats a zero or missing set count as one set', () => {
		expect(expandRoutine(routine([{ sets: 0 }]))).toHaveLength(1);
	});

	it('agrees with totalSets', () => {
		const r = routine([{ sets: 3, perSide: true }, { sets: 2 }]);
		expect(expandRoutine(r)).toHaveLength(totalSets(r));
		expect(totalSets(r)).toBe(8);
	});
});

describe('circuit blocks (§7)', () => {
	it('interleaves items round-robin instead of finishing one first', () => {
		const steps = expandRoutine(routine([{ sets: 3 }, { sets: 3 }], undefined, 'circuit'));
		expect(steps.map((s) => s.itemId)).toEqual(['i0', 'i1', 'i0', 'i1', 'i0', 'i1']);
		expect(steps.map((s) => s.setIndex)).toEqual([0, 0, 1, 1, 2, 2]);
	});

	it('keeps setIndex equal to the round, so the player invariants hold', () => {
		const steps = expandRoutine(routine([{ sets: 2 }, { sets: 3 }], undefined, 'circuit'));
		expect(steps.every((s) => s.setIndex === s.round)).toBe(true);
	});

	it('drops an item with fewer sets out of later rounds', () => {
		const steps = expandRoutine(routine([{ sets: 2 }, { sets: 3 }], undefined, 'circuit'));
		expect(steps.map((s) => s.itemId)).toEqual(['i0', 'i1', 'i0', 'i1', 'i1']);
		// The step count is unchanged by circuit ordering.
		expect(steps).toHaveLength(totalSets(routine([{ sets: 2 }, { sets: 3 }])));
	});

	it('keeps both sides of a per-side set together within a round', () => {
		const steps = expandRoutine(
			routine([{ sets: 2, perSide: true }, { sets: 2 }], undefined, 'circuit')
		);
		expect(steps.map((s) => `${s.itemId}${s.side ? ':' + s.side : ''}`)).toEqual([
			'i0:left',
			'i0:right',
			'i1',
			'i0:left',
			'i0:right',
			'i1'
		]);
	});

	it('still rests after each set as the item says', () => {
		const steps = expandRoutine(
			routine([{ sets: 2, restSeconds: 0 }, { sets: 2, restSeconds: 60 }], undefined, 'circuit')
		);
		expect(steps.map((s) => s.restSeconds)).toEqual([0, 60, 0, 60]);
	});

	it('labels circuit steps by round, not by set', () => {
		const [first] = expandRoutine(routine([{ sets: 3 }, { sets: 3 }], undefined, 'circuit'));
		expect(describeStep(first)).toBe('Round 1 of 3 · 10 reps');
	});

	it('does not label rounds on a single-round circuit', () => {
		const [only] = expandRoutine(routine([{ sets: 1 }, { sets: 1 }], undefined, 'circuit'));
		expect(describeStep(only)).toBe('10 reps');
	});

	it('leaves plain blocks exactly as before', () => {
		const sequence = expandRoutine(routine([{ sets: 2 }, { sets: 2 }]));
		expect(sequence.map((s) => s.itemId)).toEqual(['i0', 'i0', 'i1', 'i1']);
		expect(sequence.every((s) => s.round === undefined)).toBe(true);
	});
});

describe('step labels', () => {
	it('names the set, target and side the way the screen reads it', () => {
		const [first] = expandRoutine(
			routine([{ sets: 3, perSide: true, target: { kind: 'duration', seconds: 45 } }])
		);
		expect(describeStep(first)).toBe('Set 1 of 3 · 45 s · left');
	});

	it('omits the set counter for a single set', () => {
		const [only] = expandRoutine(routine([{ sets: 1, target: { kind: 'reps', reps: 12 } }]));
		expect(describeStep(only)).toBe('12 reps');
	});

	it('spells out amrap and rep ranges', () => {
		const [amrap] = expandRoutine(routine([{ target: { kind: 'amrap' } }]));
		expect(describeStep(amrap)).toBe('as many as possible');
		const [range] = expandRoutine(routine([{ target: { kind: 'reps_range', min: 8, max: 12 } }]));
		expect(describeStep(range)).toBe('8–12 reps');
	});
});

describe('log control prefill', () => {
	it('prefills so accepting the target is a single tap', () => {
		expect(prefillFor({ kind: 'reps', reps: 12 })).toBe(12);
		expect(prefillFor({ kind: 'duration', seconds: 45 })).toBe(45);
		// The top of a range: easier to count down than up when you fell short.
		expect(prefillFor({ kind: 'reps_range', min: 8, max: 12 })).toBe(12);
		expect(prefillFor({ kind: 'amrap' })).toBeUndefined();
	});
});
