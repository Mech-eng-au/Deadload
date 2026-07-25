import { describe, expect, it } from 'vitest';
import { describeStep, expandRoutine, prefillFor, totalSets } from '../src/lib/session/steps.js';
import type { Routine } from '../src/lib/types.js';

function routine(items: Partial<Routine['blocks'][0]['items'][0]>[], label?: string): Routine {
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
