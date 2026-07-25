import type { Session } from '../types.js';
import { getDb, toPlain } from './schema.js';

/**
 * Session log CRUD (§4.3). Sessions are append-only in spirit: a session is
 * always rewritten whole, never partially updated.
 */

export async function getSession(id: string): Promise<Session | undefined> {
	const db = await getDb();
	return db.get('sessions', id);
}

export async function putSession(session: Session): Promise<Session> {
	const db = await getDb();
	const saved = toPlain(session);
	await db.put('sessions', saved);
	return saved;
}

export async function deleteSession(id: string): Promise<void> {
	const db = await getDb();
	await db.delete('sessions', id);
}

/** Newest first. */
export async function listSessions(): Promise<Session[]> {
	const db = await getDb();
	return (await db.getAllFromIndex('sessions', 'startedAt')).reverse();
}

/**
 * A session with no endedAt is either in progress or was abandoned when the app
 * was killed. Either way it is what the home screen offers to resume (§7).
 */
export async function findUnfinishedSession(): Promise<Session | undefined> {
	const db = await getDb();
	const all = await db.getAllFromIndex('sessions', 'startedAt');
	return all.reverse().find((s) => !s.endedAt);
}

export async function countSessions(): Promise<number> {
	const db = await getDb();
	return db.count('sessions');
}
