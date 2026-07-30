import { describe, expect, it } from 'vitest';
import { activityCalendar, summarize } from '../src/lib/stats/compute.js';
import { csvCell, sessionsToCsv } from '../src/lib/stats/csv.js';
import type { Exercise, Session, SetEntry } from '../src/lib/types.js';

function entry(over: Partial<SetEntry> = {}): SetEntry {
	return {
		exerciseId: 'pushups',
		itemId: 'i',
		setIndex: 0,
		skipped: false,
		completedAt: new Date(2026, 6, 20, 7, 5).toISOString(),
		...over
	};
}

function session(dayOffset: number, entries: SetEntry[], over: Partial<Session> = {}): Session {
	const start = new Date(2026, 6, 20 + dayOffset, 7, 0);
	return {
		id: `s${dayOffset}`,
		routineId: 'r',
		routineName: 'Morning',
		startedAt: start.toISOString(),
		endedAt: new Date(start.getTime() + 22 * 60000).toISOString(),
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
			equipment: [],
			primaryMuscles: ['chest'],
			secondaryMuscles: [],
			level: 'beginner',
			unilateral: false,
			defaultMetric: 'reps',
			instructions: [],
			media: [],
			attributionId: 'a'
		}
	]
]);

describe('activity calendar', () => {
	it('is 16 columns of 7 days, Monday first', () => {
		const grid = activityCalendar([], 16, new Date(2026, 6, 22));
		expect(grid).toHaveLength(16);
		expect(grid.every((week) => week.length === 7)).toBe(true);
		expect(grid[0][0].date.getDay()).toBe(1);
	});

	it('counts logged sets onto the right day', () => {
		const grid = activityCalendar([session(0, [entry(), entry()])], 16, new Date(2026, 6, 22));
		const day = grid.flat().find((d) => d.key === '2026-07-20');
		expect(day?.sets).toBe(2);
		expect(day?.sessions).toBe(1);
	});

	it('excludes skipped sets and unfinished sessions', () => {
		const grid = activityCalendar(
			[session(0, [entry({ skipped: true })]), session(1, [entry()], { endedAt: undefined })],
			16,
			new Date(2026, 6, 22)
		);
		expect(grid.flat().find((d) => d.key === '2026-07-20')?.sets).toBe(0);
		expect(grid.flat().find((d) => d.key === '2026-07-21')?.sessions).toBe(0);
	});

	it('marks days after today so they can be drawn as blanks', () => {
		const grid = activityCalendar([], 16, new Date(2026, 6, 22));
		expect(grid.flat().find((d) => d.key === '2026-07-23')?.future).toBe(true);
		expect(grid.flat().find((d) => d.key === '2026-07-22')?.future).toBe(false);
	});
});

describe('session summaries', () => {
	it('separates logged from skipped and computes a duration', () => {
		const [row] = summarize([
			session(0, [entry({ reps: 10 }), entry({ skipped: true }), entry({ seconds: 45 })])
		]);
		expect(row).toMatchObject({ sets: 2, skipped: 1, reps: 10, seconds: 45, minutes: 22 });
		expect(row.finished).toBe(true);
	});

	it('reports an unfinished session without a duration', () => {
		const [row] = summarize([session(0, [entry()], { endedAt: undefined })]);
		expect(row.finished).toBe(false);
		expect(row.minutes).toBeUndefined();
	});

	it('lists newest first', () => {
		const rows = summarize([session(0, [entry()]), session(3, [entry()])]);
		expect(rows[0].id).toBe('s3');
	});
});

describe('CSV export', () => {
	it('writes a header and one row per set, oldest first', () => {
		const csv = sessionsToCsv([session(2, [entry({ reps: 9 })]), session(0, [entry({ reps: 12 })])], catalog);
		const lines = csv.trim().split('\n');
		expect(lines[0]).toContain('session_id,date,time,routine');
		expect(lines).toHaveLength(3);
		expect(lines[1]).toContain('12'); // the older session comes first
		expect(lines[2]).toContain('9');
	});

	it('resolves the exercise name and category from the catalog', () => {
		const csv = sessionsToCsv([session(0, [entry({ reps: 10 })])], catalog);
		expect(csv).toContain('pushups,Pushups,strength');
	});

	it('falls back to the id when the exercise is unknown', () => {
		const csv = sessionsToCsv([session(0, [entry({ exerciseId: 'gone' })])], catalog);
		expect(csv).toContain('gone,gone,');
	});

	it('keeps skipped sets, flagged', () => {
		const csv = sessionsToCsv([session(0, [entry({ skipped: true })])], catalog);
		expect(csv.trim().split('\n')).toHaveLength(2);
		expect(csv).toContain(',yes');
	});

	it('numbers sets from 1 and records the side and RPE', () => {
		const csv = sessionsToCsv(
			[session(0, [entry({ setIndex: 2, side: 'left', reps: 8, rpe: 9 })])],
			catalog
		);
		// set, side, reps, seconds, load_kg, rpe, skipped — the empty cell between
		// reps and rpe is seconds, and the one after it is the load (§4.5).
		expect(csv).toContain(',3,left,8,,,9,no');
	});

	it('quotes only what needs quoting, and escapes inner quotes', () => {
		expect(csvCell('plain')).toBe('plain');
		expect(csvCell('has, comma')).toBe('"has, comma"');
		expect(csvCell('say "hi"')).toBe('"say ""hi"""');
		expect(csvCell(undefined)).toBe('');
		expect(csvCell(0)).toBe('0');
	});

	it('survives a routine name containing a comma', () => {
		const csv = sessionsToCsv(
			[session(0, [entry()], { routineName: 'Full body, 15 minutes' })],
			catalog
		);
		expect(csv).toContain('"Full body, 15 minutes"');
		expect(csv.trim().split('\n')).toHaveLength(2);
	});
});
