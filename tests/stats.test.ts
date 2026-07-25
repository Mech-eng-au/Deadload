import { describe, expect, it } from 'vitest';
import {
	currentStreak,
	dayKey,
	exerciseProgress,
	longestStreak,
	routineUsage,
	sessionsPerWeek,
	totals,
	volumeByMuscle,
	weekStart
} from '../src/lib/stats/compute.js';
import type { Exercise, Session, SetEntry } from '../src/lib/types.js';

function entry(over: Partial<SetEntry> = {}): SetEntry {
	return {
		exerciseId: 'pushups',
		itemId: 'i',
		setIndex: 0,
		skipped: false,
		completedAt: '2026-07-20T07:00:00.000Z',
		...over
	};
}

/** `day` is a local-time day offset from 2026-07-20 (a Monday). */
function session(day: number, entries: SetEntry[], over: Partial<Session> = {}): Session {
	const start = new Date(2026, 6, 20 + day, 7, 0, 0);
	return {
		id: `s${day}-${Math.random()}`,
		routineId: 'r1',
		routineName: 'Morning',
		startedAt: start.toISOString(),
		endedAt: new Date(start.getTime() + 20 * 60000).toISOString(),
		entries,
		...over
	};
}

const catalog = new Map<string, Exercise>([
	[
		'pushups',
		{
			id: 'pushups',
			name: 'Pushups',
			aliases: [],
			category: 'strength',
			primaryMuscles: ['chest', 'triceps'],
			secondaryMuscles: [],
			level: 'beginner',
			unilateral: false,
			defaultMetric: 'reps',
			instructions: [],
			media: [],
			attributionId: 'a'
		}
	],
	[
		'plank',
		{
			id: 'plank',
			name: 'Plank',
			aliases: [],
			category: 'core',
			primaryMuscles: ['abdominals'],
			secondaryMuscles: [],
			level: 'beginner',
			unilateral: false,
			defaultMetric: 'duration',
			instructions: [],
			media: [],
			attributionId: 'a'
		}
	]
]);

describe('week bucketing', () => {
	it('starts weeks on Monday', () => {
		expect(weekStart(new Date(2026, 6, 23)).getDay()).toBe(1); // Thursday -> Monday
		expect(weekStart(new Date(2026, 6, 20)).getDate()).toBe(20); // Monday stays
		expect(weekStart(new Date(2026, 6, 26)).getDate()).toBe(20); // Sunday -> same week
	});

	it('returns every week including empty ones, oldest first', () => {
		const weeks = sessionsPerWeek([session(0, [entry()])], 12, new Date(2026, 6, 22));
		expect(weeks).toHaveLength(12);
		expect(weeks[11].count).toBe(1);
		expect(weeks.slice(0, 11).every((w) => w.count === 0)).toBe(true);
	});

	it('ignores sessions older than the window', () => {
		const old = session(-200, [entry()]);
		const weeks = sessionsPerWeek([old], 12, new Date(2026, 6, 22));
		expect(weeks.every((w) => w.count === 0)).toBe(true);
	});

	it('does not count unfinished sessions', () => {
		const abandoned = session(0, [entry()], { endedAt: undefined });
		const weeks = sessionsPerWeek([abandoned], 12, new Date(2026, 6, 22));
		expect(weeks.every((w) => w.count === 0)).toBe(true);
	});
});

describe('volume by muscle', () => {
	it('counts a set once for each primary muscle', () => {
		const rows = volumeByMuscle([session(0, [entry({ reps: 10 })])], catalog);
		expect(rows.map((r) => r.muscle).sort()).toEqual(['chest', 'triceps']);
		expect(rows.every((r) => r.sets === 1 && r.reps === 10)).toBe(true);
	});

	it('keeps reps and seconds apart', () => {
		const rows = volumeByMuscle(
			[session(0, [entry({ exerciseId: 'plank', seconds: 45 })])],
			catalog
		);
		expect(rows[0]).toMatchObject({ muscle: 'abdominals', sets: 1, reps: 0, seconds: 45 });
	});

	it('excludes skipped sets', () => {
		const rows = volumeByMuscle([session(0, [entry({ skipped: true, reps: 10 })])], catalog);
		expect(rows).toEqual([]);
	});
});

describe('exercise progression', () => {
	it('tracks best set, totals and one history point per day', () => {
		const sessions = [
			session(0, [entry({ reps: 10 }), entry({ reps: 12 })]),
			session(1, [entry({ reps: 8 })])
		];
		const [row] = exerciseProgress(sessions);
		expect(row.exerciseId).toBe('pushups');
		expect(row.sets).toBe(3);
		expect(row.bestReps).toBe(12);
		expect(row.totalReps).toBe(30);
		expect(row.history).toHaveLength(2);
		expect(row.history[0].bestReps).toBe(12);
		expect(row.history[0].sets).toBe(2);
	});

	it('orders exercises by how much they were done', () => {
		const rows = exerciseProgress([
			session(0, [entry(), entry(), entry({ exerciseId: 'plank', seconds: 30 })])
		]);
		expect(rows.map((r) => r.exerciseId)).toEqual(['pushups', 'plank']);
	});
});

describe('streaks', () => {
	it('counts consecutive days ending today', () => {
		const now = new Date(2026, 6, 22, 20, 0, 0);
		const sessions = [session(0, [entry()]), session(1, [entry()]), session(2, [entry()])];
		expect(currentStreak(sessions, now)).toBe(3);
	});

	it('still counts a streak that ended yesterday', () => {
		// The day's session may simply not have happened yet.
		const now = new Date(2026, 6, 23, 9, 0, 0);
		const sessions = [session(1, [entry()]), session(2, [entry()])];
		expect(currentStreak(sessions, now)).toBe(2);
	});

	it('breaks after a two-day gap', () => {
		const now = new Date(2026, 6, 24, 9, 0, 0);
		expect(currentStreak([session(0, [entry()])], now)).toBe(0);
	});

	it('counts two sessions on one day once', () => {
		const now = new Date(2026, 6, 20, 22, 0, 0);
		expect(currentStreak([session(0, [entry()]), session(0, [entry()])], now)).toBe(1);
	});

	it('finds the longest run anywhere in the history', () => {
		const sessions = [
			session(0, [entry()]),
			session(1, [entry()]),
			session(2, [entry()]),
			session(9, [entry()])
		];
		expect(longestStreak(sessions)).toBe(3);
	});
});

describe('routine usage', () => {
	it('counts sessions per routine and takes the most recent name', () => {
		const sessions = [
			session(0, [entry()], { routineName: 'Old name' }),
			session(3, [entry()], { routineName: 'New name' })
		];
		const [row] = routineUsage(sessions);
		expect(row.sessions).toBe(2);
		expect(row.routineName).toBe('New name');
	});
});

describe('totals', () => {
	it('separates logged sets from skipped ones', () => {
		const t = totals([
			session(0, [entry({ reps: 10 }), entry({ skipped: true }), entry({ seconds: 45 })])
		]);
		expect(t).toEqual({ sessions: 1, sets: 2, reps: 10, seconds: 45, skipped: 1 });
	});
});

describe('day keys', () => {
	it('groups by local calendar day', () => {
		const evening = new Date(2026, 6, 20, 23, 30).toISOString();
		const morning = new Date(2026, 6, 20, 6, 15).toISOString();
		expect(dayKey(evening)).toBe(dayKey(morning));
	});
});
