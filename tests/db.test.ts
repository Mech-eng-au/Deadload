import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteDB } from 'idb';
import {
	countItems,
	deleteRoutine,
	describeItem,
	emptyBlock,
	emptyRoutine,
	getRoutine,
	listRoutines,
	newItem,
	putRoutine
} from '../src/lib/db/routines.js';
import { ensureStoragePersisted, getSettings, putSettings } from '../src/lib/db/settings.js';
import { closeDb, DB_NAME, getDb } from '../src/lib/db/schema.js';
import { en } from '../src/lib/i18n/en/index.js';

beforeEach(async () => {
	await closeDb();
	await deleteDB(DB_NAME);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('schema', () => {
	it('creates the v1 stores and indexes from SPEC §4.4', async () => {
		const db = await getDb();
		expect([...db.objectStoreNames].sort()).toEqual([
			'aliasOverrides',
			'routines',
			'sessions',
			'settings'
		]);
		expect(db.version).toBe(1);

		const tx = db.transaction(['routines', 'sessions']);
		expect([...tx.objectStore('routines').indexNames].sort()).toEqual(['source', 'updatedAt']);
		expect([...tx.objectStore('sessions').indexNames].sort()).toEqual(['routineId', 'startedAt']);
	});
});

describe('routine persistence', () => {
	it('round-trips a hand-built routine across a database reopen', async () => {
		const routine = emptyRoutine();
		routine.name = 'Morning hip mobility';
		routine.goal = 'hip flexibility';
		routine.tags = ['morning', 'mobility'];
		routine.blocks[0].label = 'Warm-up';
		routine.blocks[0].items.push(
			newItem({
				id: 'cat_stretch',
				unilateral: false,
				defaultMetric: 'duration',
				category: 'mobility'
			})
		);
		const main = emptyBlock('Main');
		main.items.push(
			newItem({
				id: 'worlds_greatest_stretch',
				unilateral: true,
				defaultMetric: 'duration',
				category: 'mobility'
			})
		);
		routine.blocks.push(main);

		await putRoutine(routine);

		// Simulate the app being killed and relaunched.
		await closeDb();

		const loaded = await getRoutine(routine.id);
		expect(loaded).toBeDefined();
		expect(loaded!.name).toBe('Morning hip mobility');
		expect(loaded!.tags).toEqual(['morning', 'mobility']);
		expect(loaded!.blocks).toHaveLength(2);
		expect(loaded!.blocks[1].label).toBe('Main');
		expect(countItems(loaded!)).toBe(2);
		expect(loaded!.blocks[1].items[0].perSide).toBe(true);
		expect(loaded!.blocks[1].items[0].target).toEqual({ kind: 'duration', seconds: 30 });
	});

	it('stamps updatedAt on save and lists newest first', async () => {
		const older = { ...emptyRoutine(), name: 'Older' };
		const saved = await putRoutine(older);
		expect(Date.parse(saved.updatedAt)).not.toBeNaN();

		await new Promise((r) => setTimeout(r, 2));
		await putRoutine({ ...emptyRoutine(), name: 'Newer' });

		const list = await listRoutines();
		expect(list.map((r) => r.name)).toEqual(['Newer', 'Older']);
	});

	it('stores a proxy-wrapped routine, as Svelte $state hands one over', async () => {
		// Regression: IndexedDB's structured clone rejects reactive proxies with
		// "[object Array] could not be cloned", so every save from the editor
		// failed until putRoutine started flattening its input.
		const wrap = <T extends object>(o: T): T =>
			new Proxy(o, {
				get(t, k, r) {
					const v = Reflect.get(t, k, r);
					return v && typeof v === 'object' ? wrap(v as object) : v;
				}
			});

		const routine = emptyRoutine();
		routine.name = 'Proxied';
		routine.blocks[0].items.push(
			newItem({ id: 'plank', unilateral: false, defaultMetric: 'duration', category: 'core' })
		);

		const saved = await putRoutine(wrap(routine));

		await closeDb();
		const loaded = await getRoutine(saved.id);
		expect(loaded?.name).toBe('Proxied');
		expect(countItems(loaded!)).toBe(1);
		expect(Array.isArray(loaded!.blocks)).toBe(true);
	});

	it('deletes a routine without touching the others', async () => {
		const keep = await putRoutine({ ...emptyRoutine(), name: 'Keep' });
		const drop = await putRoutine({ ...emptyRoutine(), name: 'Drop' });

		await deleteRoutine(drop.id);

		expect(await getRoutine(drop.id)).toBeUndefined();
		expect((await getRoutine(keep.id))?.name).toBe('Keep');
	});
});

describe('item defaults', () => {
	it('mirrors the import parser defaults (§6.1)', () => {
		const stretch = newItem({
			id: 'childs_pose',
			unilateral: false,
			defaultMetric: 'duration',
			category: 'stretch'
		});
		expect(stretch.target).toEqual({ kind: 'duration', seconds: 30 });
		expect(stretch.restSeconds).toBe(0);
		expect(stretch.sets).toBe(1);

		const strength = newItem({
			id: 'pushups',
			unilateral: false,
			defaultMetric: 'reps',
			category: 'strength'
		});
		expect(strength.target).toEqual({ kind: 'reps', reps: 10 });
		expect(strength.restSeconds).toBe(30);
	});

	it('describes every target kind', () => {
		const base = { id: 'x', exerciseId: 'e', sets: 1, perSide: false, restSeconds: 0 };
		expect(describeItem({ ...base, target: { kind: 'reps', reps: 10 } }, en)).toBe('10 reps');
		expect(describeItem({ ...base, sets: 3, target: { kind: 'duration', seconds: 45 } }, en)).toBe(
			'3 × 45 s'
		);
		expect(describeItem({ ...base, target: { kind: 'reps_range', min: 8, max: 12 } }, en)).toBe(
			'8–12 reps'
		);
		expect(describeItem({ ...base, perSide: true, target: { kind: 'amrap' } }, en)).toBe(
			'as many as possible per side'
		);
	});
});

describe('settings', () => {
	it('defaults before anything is written, then persists', async () => {
		expect((await getSettings()).persistRequested).toBe(false);

		await putSettings({
			persistRequested: true,
			persistGranted: true,
			createdAt: new Date().toISOString()
		});

		await closeDb();
		expect((await getSettings()).persistGranted).toBe(true);
	});

	it('records the outcome of a storage persistence request', async () => {
		vi.stubGlobal('navigator', {
			storage: {
				persist: async () => true,
				persisted: async () => false
			}
		});

		const settings = await ensureStoragePersisted();
		expect(settings.persistRequested).toBe(true);
		expect(settings.persistGranted).toBe(true);
	});

	it('survives a browser with no storage manager', async () => {
		vi.stubGlobal('navigator', {});
		const settings = await ensureStoragePersisted();
		expect(settings.persistRequested).toBe(false);
	});
});
