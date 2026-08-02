import { describe, expect, it } from 'vitest';
import { formatSet, formatWhen, pickLastPerformance } from '../src/lib/session/last-time.js';
import type { Session, SetEntry } from '../src/lib/types.js';
import { en } from '../src/lib/i18n/en/index.js';

function entry(over: Partial<SetEntry> = {}): SetEntry {
	return {
		exerciseId: 'pushups',
		itemId: 'i',
		setIndex: 0,
		skipped: false,
		completedAt: '2026-07-20T07:05:00.000Z',
		...over
	};
}

function session(id: string, dayOffset: number, entries: SetEntry[], ended = true): Session {
	const start = new Date(2026, 6, 20 + dayOffset, 7, 0, 0);
	return {
		id,
		routineId: 'r',
		routineName: 'Morning',
		startedAt: start.toISOString(),
		endedAt: ended ? new Date(start.getTime() + 20 * 60000).toISOString() : undefined,
		entries
	};
}

describe('picking the last performance', () => {
	it('takes the most recent finished session containing the exercise', () => {
		const sessions = [
			session('old', 0, [entry({ reps: 8 })]),
			session('new', 3, [entry({ reps: 12 })])
		];
		const found = pickLastPerformance(sessions, 'pushups');
		expect(found?.sessionId).toBe('new');
		expect(found?.sets.map((s) => s.reps)).toEqual([12]);
	});

	it('never treats the session in progress as its own last time', () => {
		const sessions = [
			session('previous', 0, [entry({ reps: 8 })]),
			session('current', 1, [entry({ reps: 99 })])
		];
		const found = pickLastPerformance(sessions, 'pushups', { excludeSessionId: 'current' });
		expect(found?.sessionId).toBe('previous');
	});

	it('ignores unfinished sessions', () => {
		const sessions = [
			session('done', 0, [entry({ reps: 8 })]),
			session('abandoned', 2, [entry({ reps: 20 })], false)
		];
		expect(pickLastPerformance(sessions, 'pushups')?.sessionId).toBe('done');
	});

	it('skips a session where the exercise was only skipped', () => {
		const sessions = [
			session('did-it', 0, [entry({ reps: 8 })]),
			session('skipped-it', 2, [entry({ skipped: true })])
		];
		expect(pickLastPerformance(sessions, 'pushups')?.sessionId).toBe('did-it');
	});

	it('compares left with left', () => {
		const sessions = [
			session('s', 0, [
				entry({ exerciseId: 'lunge', side: 'left', reps: 10 }),
				entry({ exerciseId: 'lunge', side: 'right', reps: 7 })
			])
		];
		expect(pickLastPerformance(sessions, 'lunge', { side: 'left' })?.sets.map((s) => s.reps)).toEqual(
			[10]
		);
		expect(
			pickLastPerformance(sessions, 'lunge', { side: 'right' })?.sets.map((s) => s.reps)
		).toEqual([7]);
	});

	it('returns the sets in set order', () => {
		const sessions = [
			session('s', 0, [
				entry({ setIndex: 2, reps: 9 }),
				entry({ setIndex: 0, reps: 12 }),
				entry({ setIndex: 1, reps: 11 })
			])
		];
		expect(pickLastPerformance(sessions, 'pushups')?.sets.map((s) => s.reps)).toEqual([12, 11, 9]);
	});

	it('returns nothing when the exercise has never been done', () => {
		expect(pickLastPerformance([session('s', 0, [entry()])], 'plank')).toBeUndefined();
		expect(pickLastPerformance([], 'pushups')).toBeUndefined();
	});
});

describe('formatting', () => {
	it('shows reps plainly and durations with a unit', () => {
		expect(formatSet(entry({ reps: 12 }), en)).toBe('12');
		expect(formatSet(entry({ seconds: 45 }), en)).toBe('45 s');
		expect(formatSet(entry(), en)).toBe('–');
	});

	it('reads as a person would say it', () => {
		const now = new Date(2026, 6, 25, 9, 0);
		expect(formatWhen(new Date(2026, 6, 25, 7, 0).toISOString(), en, now)).toBe('earlier today');
		expect(formatWhen(new Date(2026, 6, 24, 7, 0).toISOString(), en, now)).toBe('yesterday');
		expect(formatWhen(new Date(2026, 6, 22, 7, 0).toISOString(), en, now)).toBe('3 days ago');
		// Beyond a week it becomes a date rather than an ever-growing count.
		expect(formatWhen(new Date(2026, 6, 1, 7, 0).toISOString(), en, now)).toMatch(/1|Jul/);
	});
});
