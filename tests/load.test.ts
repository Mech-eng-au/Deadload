import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalog, getExercise } from '../src/lib/catalog/index.js';
import { LOADABLE_EQUIPMENT, formatKg, isLoadable } from '../src/lib/catalog/load.js';
import { announcementFor, spokenKg } from '../src/lib/session/announce.js';
import { describeStep, expandRoutine, type Step } from '../src/lib/session/steps.js';
import { formatSet, formatSetList, formatSetWithLoad } from '../src/lib/session/last-time.js';
import { describeItem } from '../src/lib/db/routines.js';
import { deriveLoad, toRoutineItem } from '../src/lib/import/to-routine.js';
import { parseJson } from '../src/lib/import/parse-json.js';
import { parseCsv } from '../src/lib/import/parse-csv.js';
import { sessionsToCsv } from '../src/lib/stats/csv.js';
import {
	exerciseProgress,
	hasLoggedLoad,
	kgRepsOf,
	loadedWorkPerWeek,
	totals,
	volumeByMuscle
} from '../src/lib/stats/compute.js';
import type { Exercise, Routine, Session, SetEntry } from '../src/lib/types.js';
import type { ImportNote, WireItem } from '../src/lib/import/types.js';
import { en } from '../src/lib/i18n/en/index.js';

const fixture = (name: string) =>
	readFileSync(join(import.meta.dirname, 'fixtures/imports', name), 'utf8');

function entry(over: Partial<SetEntry> = {}): SetEntry {
	return {
		exerciseId: 'one_arm_kettlebell_row',
		itemId: 'i1',
		setIndex: 0,
		skipped: false,
		completedAt: '2026-07-30T07:00:00.000Z',
		...over
	};
}

function session(entries: SetEntry[], over: Partial<Session> = {}): Session {
	const start = new Date(2026, 6, 30, 7, 0, 0);
	return {
		id: 's1',
		routineId: 'r1',
		routineName: 'Loaded',
		startedAt: start.toISOString(),
		endedAt: new Date(start.getTime() + 20 * 60000).toISOString(),
		entries,
		...over
	};
}

/** A dummy exercise, so the rules are tested rather than the catalog. */
function exercise(over: Partial<Exercise> = {}): Exercise {
	return {
		id: 'x',
		name: 'X',
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
		attributionId: 'a',
		...over
	};
}

describe('what can carry a load (§4.5)', () => {
	it('is dumbbells and a kettlebell, and nothing else', () => {
		expect(LOADABLE_EQUIPMENT).toEqual(['dumbbells', 'kettlebell']);
		expect(isLoadable(exercise({ equipment: ['dumbbells'] }))).toBe(true);
		expect(isLoadable(exercise({ equipment: ['kettlebell'] }))).toBe(true);
	});

	it('refuses a band, which has no kilograms', () => {
		// Tension depends on how far it is stretched, and a colour code is not a
		// unit, so any number would be invented.
		expect(isLoadable(exercise({ equipment: ['resistance_band'] }))).toBe(false);
	});

	it('refuses a pull-up bar, because that load includes the body', () => {
		// The decision behind weighted pull-ups being out of scope: reps × plate is
		// not the work done, and the honest number needs a body weight §1 refuses.
		expect(isLoadable(getExercise('pullups')!)).toBe(false);
		expect(isLoadable(getExercise('dips_triceps_version')!)).toBe(false);
	});

	it('refuses bodyweight work', () => {
		expect(isLoadable(exercise())).toBe(false);
		expect(isLoadable(getExercise('plank')!)).toBe(false);
	});

	it('marks a real slice of the catalog loadable and no more', () => {
		const loadable = catalog.filter(isLoadable);
		expect(loadable.length).toBe(23); // 14 dumbbell + 9 kettlebell
		for (const e of loadable) {
			expect(e.equipment.some((id) => id === 'dumbbells' || id === 'kettlebell')).toBe(true);
		}
	});

	it('trims a trailing zero rather than printing 10.0 kg', () => {
		expect(formatKg(10, en)).toBe('10 kg');
		expect(formatKg(2.5, en)).toBe('2.5 kg');
		expect(formatKg(7.25, en)).toBe('7.25 kg');
	});
});

describe('load on the routine and on the step', () => {
	const routine: Routine = {
		id: 'r1',
		name: 'Loaded',
		tags: [],
		source: 'user',
		createdAt: '2026-07-30T06:00:00.000Z',
		updatedAt: '2026-07-30T06:00:00.000Z',
		blocks: [
			{
				id: 'b1',
				items: [
					{
						id: 'i1',
						exerciseId: 'one_arm_kettlebell_row',
						sets: 2,
						target: { kind: 'reps', reps: 8 },
						perSide: true,
						restSeconds: 45,
						loadKg: 12
					},
					{
						id: 'i2',
						exerciseId: 'pushups',
						sets: 1,
						target: { kind: 'reps', reps: 10 },
						perSide: false,
						restSeconds: 30
					}
				]
			}
		]
	};

	it('carries the planned load onto every step of the item', () => {
		const steps = expandRoutine(routine);
		expect(steps.filter((s) => s.itemId === 'i1').every((s) => s.loadKg === 12)).toBe(true);
		expect(steps.find((s) => s.itemId === 'i2')?.loadKg).toBeUndefined();
	});

	it('shows the load on the step line and leaves it off where there is none', () => {
		// Two sets per side, so four loaded steps and then the bodyweight one.
		const steps = expandRoutine(routine);
		expect(steps).toHaveLength(5);
		expect(describeStep(steps[0], en)).toBe('Set 1 of 2 · 8 reps · 12 kg · left');
		expect(describeStep(steps[4], en)).toBe('10 reps');
	});

	it('shows the load in the routine item summary', () => {
		expect(describeItem(routine.blocks[0].items[0], en)).toBe('2 × 8 reps at 12 kg per side');
		expect(describeItem(routine.blocks[0].items[1], en)).toBe('10 reps');
	});
});

describe('what the app says out loud (§4.5)', () => {
	function step(over: Partial<Step> = {}): Step {
		return {
			itemId: 'i1',
			exerciseId: 'one_arm_kettlebell_row',
			setIndex: 0,
			setCount: 3,
			target: { kind: 'reps', reps: 8 },
			restSeconds: 45,
			...over
		};
	}

	it('says "at 10 kilos", spelled out for the ear', () => {
		expect(announcementFor(step({ loadKg: 10 }), 'One-Arm Kettlebell Row')).toBe(
			'Next up, One-Arm Kettlebell Row. Set 1 of 3. 8 reps at 10 kilos.'
		);
	});

	it('keeps the load with the target and the side after it', () => {
		expect(announcementFor(step({ loadKg: 12, side: 'left' }), 'Row')).toBe(
			'Next up, Row. Set 1 of 3. 8 reps at 12 kilos. Left side.'
		);
	});

	it('says nothing about load when there is none', () => {
		expect(announcementFor(step(), 'Row')).toBe('Next up, Row. Set 1 of 3. 8 reps.');
	});

	it('says halves the way a person would', () => {
		// "two point five kilos" is right and nobody says it.
		expect(spokenKg(2.5)).toBe('2 and a half kilos');
		expect(spokenKg(0.5)).toBe('half a kilo');
		expect(spokenKg(1)).toBe('1 kilo');
		expect(spokenKg(10)).toBe('10 kilos');
		expect(spokenKg(7.25)).toBe('7.25 kilos');
	});
});

describe('the last-time line (§4.5)', () => {
	it('states the unit once, then only when the weight moves', () => {
		const sets = [
			entry({ setIndex: 0, reps: 12, loadKg: 10 }),
			entry({ setIndex: 1, reps: 11, loadKg: 10 }),
			entry({ setIndex: 2, reps: 8, loadKg: 12 })
		];
		expect(formatSetList(sets, en)).toEqual(['12 × 10 kg', '11 × 10', '8 × 12 kg']);
	});

	it('is unchanged for bodyweight work', () => {
		const sets = [entry({ setIndex: 0, reps: 12 }), entry({ setIndex: 1, reps: 11 })];
		expect(formatSetList(sets, en)).toEqual(['12', '11']);
		expect(formatSet(sets[0], en)).toBe('12');
	});

	it('handles a timed set with a load', () => {
		expect(formatSetWithLoad(entry({ seconds: 45, loadKg: 8 }), en)).toBe('45 s × 8 kg');
	});
});

describe('importing a load (§6.1, §4.5)', () => {
	function item(over: Partial<WireItem> = {}): WireItem {
		return { exercise: 'x', ...over } as WireItem;
	}

	it('reads load_kg from JSON, as a number or a string', () => {
		const parsed = parseJson(fixture('loaded.json'));
		const main = parsed.blocks[0].items;
		expect(main[0].load_kg).toBe(12);
		expect(main[1].load_kg).toBe(10); // "10"
		expect(main[2].load_kg).toBe(7.5);
		expect(main[3].load_kg).toBe(16); // "16 kg"
	});

	it('does not round a fractional load', () => {
		// 7.5 kg is a real dumbbell; rounding it would silently make it 8.
		expect(parseJson(fixture('loaded.json')).blocks[0].items[2].load_kg).toBe(7.5);
	});

	it('reads load_kg from CSV, and leaves a blank cell alone', () => {
		const parsed = parseCsv(fixture('loaded.csv'));
		const main = parsed.blocks[0].items;
		expect(main[0].load_kg).toBe(12);
		expect(main[2].load_kg).toBe(7.5);
		expect(main[3].load_kg).toBeUndefined(); // Pullups, no cell value
	});

	it('keeps a load on a loadable exercise', () => {
		const notes: ImportNote[] = [];
		const built = toRoutineItem(
			item({ reps: 8, load_kg: 12 }),
			getExercise('one_arm_kettlebell_row')!,
			'i1',
			notes
		);
		expect(built.loadKg).toBe(12);
		expect(notes).toEqual([]);
	});

	it('drops a load on an exercise that is not held, and says so', () => {
		// An LLM will occasionally put a weight on a push-up. Storing it would make
		// the log claim a measurement nobody took.
		const notes: ImportNote[] = [];
		const built = toRoutineItem(
			item({ reps: 15, load_kg: 20 }),
			getExercise('pushups')!,
			'i1',
			notes
		);
		expect(built.loadKg).toBeUndefined();
		expect(notes).toHaveLength(1);
		expect(notes[0].level).toBe('warning');
		expect(notes[0].message).toContain('20 kg');
	});

	it('treats zero and negative as no load rather than as a load of nothing', () => {
		expect(deriveLoad(item({ load_kg: 0 }), getExercise('goblet_squat')!)).toBeUndefined();
		expect(deriveLoad(item({ load_kg: -5 }), getExercise('goblet_squat')!)).toBeUndefined();
	});

	it('leaves every routine without load_kg exactly as it was', () => {
		const built = toRoutineItem(item({ reps: 10 }), getExercise('pushups')!, 'i1', []);
		expect('loadKg' in built ? built.loadKg : undefined).toBeUndefined();
	});
});

describe('load in the CSV export (§8)', () => {
	it('adds a load_kg column between seconds and rpe', () => {
		const csv = sessionsToCsv([session([entry({ reps: 8, loadKg: 12, rpe: 8 })])]);
		const [header, row] = csv.trim().split('\n');
		expect(header.split(',')).toContain('load_kg');
		expect(header.split(',').indexOf('load_kg')).toBe(header.split(',').indexOf('seconds') + 1);
		expect(row.split(',')[header.split(',').indexOf('load_kg')]).toBe('12');
	});

	it('leaves the cell empty for a bodyweight set', () => {
		const csv = sessionsToCsv([session([entry({ reps: 12 })])]);
		const [header, row] = csv.trim().split('\n');
		expect(row.split(',')[header.split(',').indexOf('load_kg')]).toBe('');
	});
});

describe('load in statistics (§10.1)', () => {
	it('needs both a load and reps to be kilogram-reps', () => {
		expect(kgRepsOf(entry({ reps: 8, loadKg: 12 }))).toBe(96);
		// A loaded timed set is a loaded set; kilogram-seconds is a different
		// quantity and adding the two would be arithmetic on unlike units.
		expect(kgRepsOf(entry({ seconds: 45, loadKg: 12 }))).toBe(0);
		expect(kgRepsOf(entry({ reps: 8 }))).toBe(0);
		expect(kgRepsOf(entry({ reps: 8, loadKg: 12, skipped: true }))).toBe(0);
	});

	it('does not exist until a load has been logged', () => {
		expect(hasLoggedLoad([session([entry({ reps: 12 })])])).toBe(false);
		expect(hasLoggedLoad([session([entry({ reps: 8, loadKg: 12 })])])).toBe(true);
		// A skipped loaded set is not work done.
		expect(hasLoggedLoad([session([entry({ loadKg: 12, skipped: true })])])).toBe(false);
		// Nor is an unfinished session.
		expect(
			hasLoggedLoad([session([entry({ reps: 8, loadKg: 12 })], { endedAt: undefined })])
		).toBe(false);
	});

	it('reports loaded work per week, apart from the set counts', () => {
		const now = new Date(2026, 6, 30, 12, 0, 0);
		const weeks = loadedWorkPerWeek(
			[
				session([
					entry({ reps: 8, loadKg: 12 }),
					entry({ setIndex: 1, reps: 8, loadKg: 12 }),
					entry({ setIndex: 2, seconds: 45, loadKg: 16 }),
					entry({ setIndex: 3, reps: 12 })
				])
			],
			12,
			now
		);
		const current = weeks[weeks.length - 1];
		expect(current.kgReps).toBe(192); // 2 × 8 × 12; the timed set adds none
		expect(current.sets).toBe(3); // three sets carried a load
		expect(current.bestKg).toBe(16);
		// Bodyweight-only weeks are zero rather than absent, so the chart has no gaps.
		expect(weeks).toHaveLength(12);
		expect(weeks[0].kgReps).toBe(0);
	});

	it('gives volumeByMuscle a kgReps figure that is zero for bodyweight work', () => {
		const byId = new Map([
			['one_arm_kettlebell_row', getExercise('one_arm_kettlebell_row')!],
			['pushups', getExercise('pushups')!]
		]);
		const rows = volumeByMuscle(
			[
				session([
					entry({ reps: 8, loadKg: 12 }),
					entry({ exerciseId: 'pushups', setIndex: 1, reps: 20 })
				])
			],
			byId
		);
		const back = rows.find((r) => r.muscle === 'middle back')!;
		const chest = rows.find((r) => r.muscle === 'chest')!;
		expect(back.kgReps).toBe(96);
		expect(chest.kgReps).toBe(0);
		expect(chest.sets).toBe(1);
	});

	it('puts load on the per-exercise series, where the unit stays comparable', () => {
		const rows = exerciseProgress([
			session([entry({ reps: 8, loadKg: 10 }), entry({ setIndex: 1, reps: 8, loadKg: 12 })])
		]);
		const row = rows[0];
		expect(row.bestKg).toBe(12);
		expect(row.kgReps).toBe(176);
		expect(row.history[0].bestKg).toBe(12);
		expect(row.history[0].kgReps).toBe(176);
	});

	it('refuses any app-wide total volume number', () => {
		// §10.1. Sets, reps and seconds are three counts of three different things.
		// One number combining a plank, some push-ups and a loaded row would be
		// precise, prominent and meaningless — so `totals` has no load field, and
		// this test is here to fail if one is ever added.
		const summary = totals([session([entry({ reps: 8, loadKg: 12 })])]);
		expect(Object.keys(summary).sort()).toEqual([
			'reps',
			'seconds',
			'sessions',
			'sets',
			'skipped'
		]);
		expect('kgReps' in summary).toBe(false);
		expect('volume' in summary).toBe(false);
	});
});
