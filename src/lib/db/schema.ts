import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { ExerciseId, Routine, Session, Settings } from '../types.js';

/** Database `deadload`, stores per docs/SPEC.md §4.4. */
export interface DeadloadDB extends DBSchema {
	routines: {
		key: string;
		value: Routine;
		indexes: { updatedAt: string; source: string };
	};
	sessions: {
		key: string;
		value: Session;
		indexes: { startedAt: string; routineId: string };
	};
	/** Normalized imported name -> ExerciseId. Written by the import mapper (M3). */
	aliasOverrides: { key: string; value: ExerciseId };
	/** Single record under the fixed key `app`. */
	settings: { key: string; value: Settings };
}

export const DB_NAME = 'deadload';
export const DB_VERSION = 1;
export const SETTINGS_KEY = 'app';

/**
 * IndexedDB stores values with the structured clone algorithm, which throws on
 * the reactive proxies Svelte 5 returns from `$state` ("[object Array] could
 * not be cloned"). Everything in the data model is JSON-native by design (§4:
 * strings, numbers, booleans, ISO 8601 timestamps), so a JSON round trip is a
 * faithful and total way to hand the store plain data.
 *
 * Done here at the write boundary rather than at each call site, because a
 * forgotten snapshot fails at runtime while saving the user's work.
 */
export function toPlain<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

let dbPromise: Promise<IDBPDatabase<DeadloadDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<DeadloadDB>> {
	dbPromise ??= openDB<DeadloadDB>(DB_NAME, DB_VERSION, {
		// Migration scaffolding: one guarded block per version, always run in
		// order, never rewritten in place. There is nothing to migrate yet, but
		// adding this later with real data on the device is worse (§4.4).
		upgrade(db, oldVersion) {
			if (oldVersion < 1) {
				const routines = db.createObjectStore('routines', { keyPath: 'id' });
				routines.createIndex('updatedAt', 'updatedAt');
				routines.createIndex('source', 'source');

				const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
				sessions.createIndex('startedAt', 'startedAt');
				sessions.createIndex('routineId', 'routineId');

				db.createObjectStore('aliasOverrides');
				db.createObjectStore('settings');
			}
			// if (oldVersion < 2) { ... }
		},
		blocked() {
			console.warn('deadload: another tab is holding an older version of the database open');
		},
		blocking() {
			console.warn('deadload: this tab is blocking a database upgrade elsewhere');
		}
	});
	return dbPromise;
}

/**
 * Close the connection and force the next getDb() to reopen. An open handle
 * blocks both deleteDB and a version upgrade in another tab, so this has to
 * actually close rather than just drop the cached promise.
 */
export async function closeDb(): Promise<void> {
	if (!dbPromise) return;
	const pending = dbPromise;
	dbPromise = null;
	try {
		(await pending).close();
	} catch {
		// A connection that never opened needs no closing.
	}
}
