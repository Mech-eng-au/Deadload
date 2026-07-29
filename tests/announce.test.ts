import { describe, expect, it } from 'vitest';
import { announcementFor, spokenDuration } from '../src/lib/session/announce.js';
import { expandRoutine } from '../src/lib/session/steps.js';
import type { Routine } from '../src/lib/types.js';

function routine(
	items: Partial<Routine['blocks'][0]['items'][0]>[],
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
				mode,
				items: items.map((i, n) => ({
					id: `i${n}`,
					exerciseId: `e${n}`,
					sets: 1,
					target: { kind: 'reps', reps: 10 } as const,
					perSide: false,
					restSeconds: 0,
					...i
				}))
			}
		]
	};
}

const say = (r: Routine, index = 0, name = 'Push-Ups') =>
	announcementFor(expandRoutine(r)[index], name);

describe('spoken durations (§7)', () => {
	it('says seconds and minutes the way a person would', () => {
		expect(spokenDuration(45)).toBe('45 seconds');
		expect(spokenDuration(1)).toBe('1 second');
		expect(spokenDuration(60)).toBe('1 minute');
		expect(spokenDuration(90)).toBe('1 minute 30 seconds');
		expect(spokenDuration(120)).toBe('2 minutes');
		expect(spokenDuration(121)).toBe('2 minutes 1 second');
	});
});

describe('announcements (§7)', () => {
	it('leads with the exercise, which is what you are waiting to hear', () => {
		expect(say(routine([{ sets: 3 }]))).toBe('Next up, Push-Ups. Set 1 of 3. 10 reps.');
	});

	it('drops the set counter when there is only one set', () => {
		// "Set 1 of 1" is noise in a sentence you are listening to.
		expect(say(routine([{ sets: 1 }]))).toBe('Next up, Push-Ups. 10 reps.');
	});

	it('names the side, because you cannot see which one is on screen', () => {
		const r = routine([{ sets: 1, perSide: true, target: { kind: 'duration', seconds: 45 } }]);
		expect(say(r, 0, 'Side Bridge')).toBe('Next up, Side Bridge. 45 seconds. Left side.');
		expect(say(r, 1, 'Side Bridge')).toBe('Next up, Side Bridge. 45 seconds. Right side.');
	});

	it('counts rounds in a circuit, as the screen does', () => {
		const r = routine([{ sets: 2 }, { sets: 2 }], 'circuit');
		expect(say(r, 0)).toBe('Next up, Push-Ups. Round 1 of 2. 10 reps.');
		expect(say(r, 2)).toBe('Next up, Push-Ups. Round 2 of 2. 10 reps.');
	});

	it('speaks every target kind in words, never symbols', () => {
		const spoken = [
			say(routine([{ target: { kind: 'duration', seconds: 90 } }])),
			say(routine([{ target: { kind: 'reps_range', min: 8, max: 12 } }])),
			say(routine([{ target: { kind: 'amrap' } }])),
			say(routine([{ target: { kind: 'reps', reps: 1 } }]))
		];
		expect(spoken).toEqual([
			'Next up, Push-Ups. 1 minute 30 seconds.',
			'Next up, Push-Ups. 8 to 12 reps.',
			'Next up, Push-Ups. As many as possible.',
			'Next up, Push-Ups. 1 rep.'
		]);
		// Nothing a speech engine would read out as punctuation.
		for (const line of spoken) expect(line).not.toMatch(/[·×–]|\bs\b/);
	});
});
