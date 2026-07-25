import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { deleteDB } from 'idb';
import {
	BackupError,
	backupFilename,
	buildBackup,
	parseBackup,
	restoreBackup,
	serializeBackup
} from '../src/lib/db/backup.js';
import { closeDb, DB_NAME, getDb } from '../src/lib/db/schema.js';
import { emptyRoutine, getRoutine, listRoutines, putRoutine } from '../src/lib/db/routines.js';
import { putSession, listSessions } from '../src/lib/db/sessions.js';
import { rememberAlias, loadAliasOverrides } from '../src/lib/db/aliases.js';
import { backupIsDue } from '../src/lib/db/settings.js';
import type { Session } from '../src/lib/types.js';

beforeEach(async () => {
	await closeDb();
	await deleteDB(DB_NAME);
});

function session(id: string, over: Partial<Session> = {}): Session {
	return {
		id,
		routineId: 'r1',
		routineName: 'Morning',
		startedAt: '2026-07-20T07:00:00.000Z',
		endedAt: '2026-07-20T07:20:00.000Z',
		entries: [
			{
				exerciseId: 'pushups',
				itemId: 'i',
				setIndex: 0,
				reps: 10,
				skipped: false,
				completedAt: '2026-07-20T07:05:00.000Z'
			}
		],
		...over
	};
}

async function seed() {
	const routine = await putRoutine({ ...emptyRoutine(), name: 'Morning' });
	await putSession(session('s1'));
	await rememberAlias('kettlebell swing', 'freehand_jump_squat');
	return routine;
}

describe('backup file', () => {
	it('captures every store', async () => {
		const routine = await seed();
		const backup = await buildBackup();

		expect(backup.schema).toBe('deadload.backup/1');
		expect(backup.schemaVersion).toBe(1);
		expect(backup.routines.map((r) => r.id)).toEqual([routine.id]);
		expect(backup.sessions.map((s) => s.id)).toEqual(['s1']);
		expect(backup.aliasOverrides).toEqual({ 'kettlebell swing': 'freehand_jump_squat' });
		expect(Date.parse(backup.exportedAt)).not.toBeNaN();
	});

	it('round-trips through serialize and parse', async () => {
		await seed();
		const original = await buildBackup();
		const reread = parseBackup(serializeBackup(original));
		expect(reread).toEqual(original);
	});

	it('rejects a file that is not a backup, and says what it looks like', () => {
		expect(() => parseBackup('{"name":"A routine","blocks":[]}')).toThrow(BackupError);
		try {
			parseBackup('{"name":"A routine","blocks":[]}');
		} catch (err) {
			expect((err as BackupError).detail).toMatch(/single routine/i);
		}
	});

	it('rejects malformed JSON and a backup from a newer app', () => {
		expect(() => parseBackup('{ not json')).toThrow(/not valid JSON/i);
		const future = JSON.stringify({
			schema: 'deadload.backup/1',
			schemaVersion: 99,
			exportedAt: new Date().toISOString(),
			routines: [],
			sessions: [],
			aliasOverrides: {},
			settings: null
		});
		expect(() => parseBackup(future)).toThrow(/newer version/i);
	});

	it('names the file by timestamp', () => {
		expect(backupFilename(new Date('2026-07-25T09:30:00Z'))).toBe(
			'deadload-backup-2026-07-25-09-30.json'
		);
	});
});

describe('restore', () => {
	it('replace wipes first, so the file is exactly what is left (§13 M4)', async () => {
		await seed();
		const backup = await buildBackup();

		// Simulate a wiped device that has since gained unrelated data.
		await closeDb();
		await deleteDB(DB_NAME);
		await putRoutine({ ...emptyRoutine(), name: 'Made after the backup' });

		const summary = await restoreBackup(backup, 'replace');
		expect(summary.routinesAdded).toBe(1);
		expect(summary.sessionsAdded).toBe(1);

		const routines = await listRoutines();
		expect(routines).toHaveLength(1);
		expect(routines[0].name).toBe('Morning');
		expect(await listSessions()).toHaveLength(1);
		expect(await loadAliasOverrides()).toEqual(
			new Map([['kettlebell swing', 'freehand_jump_squat']])
		);
	});

	it('merge adds what is missing and keeps what is here', async () => {
		await seed();
		const backup = await buildBackup();

		await closeDb();
		await deleteDB(DB_NAME);
		const local = await putRoutine({ ...emptyRoutine(), name: 'Local only' });
		await putSession(session('s-local'));

		const summary = await restoreBackup(backup, 'merge');
		expect(summary.routinesAdded).toBe(1);
		expect(summary.sessionsAdded).toBe(1);

		const names = (await listRoutines()).map((r) => r.name).sort();
		expect(names).toEqual(['Local only', 'Morning']);
		expect(await getRoutine(local.id)).toBeDefined();
		expect((await listSessions()).map((s) => s.id).sort()).toEqual(['s-local', 's1']);
	});

	it('merge updates a routine only when the file is newer', async () => {
		const routine = await putRoutine({ ...emptyRoutine(), name: 'Original' });
		const backup = await buildBackup();

		// Edit on the device after the backup was taken.
		await new Promise((r) => setTimeout(r, 5));
		await putRoutine({ ...routine, name: 'Edited on the phone' });

		const summary = await restoreBackup(backup, 'merge');
		expect(summary.routinesSkipped).toBe(1);
		expect(summary.routinesUpdated).toBe(0);
		expect((await getRoutine(routine.id))?.name).toBe('Edited on the phone');
	});

	it('merge does overwrite when the file is the newer copy', async () => {
		const routine = await putRoutine({ ...emptyRoutine(), name: 'Old on device' });
		const newer = {
			...routine,
			name: 'Newer in the file',
			updatedAt: new Date(Date.now() + 60_000).toISOString()
		};
		const backup = { ...(await buildBackup()), routines: [newer] };

		const summary = await restoreBackup(backup, 'merge');
		expect(summary.routinesUpdated).toBe(1);
		expect((await getRoutine(routine.id))?.name).toBe('Newer in the file');
	});

	it('merge never resurrects a session that was deleted locally twice over', async () => {
		await putSession(session('s1'));
		const backup = await buildBackup();
		const summary = await restoreBackup(backup, 'merge');
		expect(summary.sessionsSkipped).toBe(1);
		expect(await listSessions()).toHaveLength(1);
	});

	it('restores into an empty database, which is the wipe-and-restore case', async () => {
		await seed();
		const backup = await buildBackup();
		await closeDb();
		await deleteDB(DB_NAME);

		await restoreBackup(backup, 'replace');
		const db = await getDb();
		expect(await db.count('routines')).toBe(1);
		expect(await db.count('sessions')).toBe(1);
		expect(await db.count('aliasOverrides')).toBe(1);
	});
});

describe('backup reminder (§8)', () => {
	it('asks once each time the count crosses a multiple of 20', () => {
		expect(backupIsDue(0, null)).toBe(false);
		expect(backupIsDue(19, null)).toBe(false);
		expect(backupIsDue(20, null)).toBe(true);
		expect(backupIsDue(21, null)).toBe(true);
	});

	it('goes quiet after an export, until the next threshold', () => {
		const exported = {
			persistRequested: true,
			persistGranted: true,
			createdAt: '',
			lastExportSessionCount: 20
		};
		expect(backupIsDue(21, exported)).toBe(false);
		expect(backupIsDue(39, exported)).toBe(false);
		expect(backupIsDue(40, exported)).toBe(true);
	});
});
