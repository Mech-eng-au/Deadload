import type { ExerciseId } from '../types.js';
import { getDb } from './schema.js';

/**
 * Learned name mappings (§4.4). Keyed by the normalized imported name, so a
 * second import of the same phrasing resolves silently. This is what stops
 * repeated LLM imports being tedious.
 */

export async function loadAliasOverrides(): Promise<Map<string, ExerciseId>> {
	const db = await getDb();
	const tx = db.transaction('aliasOverrides');
	const map = new Map<string, ExerciseId>();
	for await (const cursor of tx.store.iterate()) {
		map.set(String(cursor.key), cursor.value);
	}
	return map;
}

export async function rememberAlias(normalizedName: string, exerciseId: ExerciseId): Promise<void> {
	const db = await getDb();
	await db.put('aliasOverrides', exerciseId, normalizedName);
}

export async function forgetAlias(normalizedName: string): Promise<void> {
	const db = await getDb();
	await db.delete('aliasOverrides', normalizedName);
}

export async function countAliasOverrides(): Promise<number> {
	const db = await getDb();
	return db.count('aliasOverrides');
}
