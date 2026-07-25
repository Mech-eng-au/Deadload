import { z } from 'zod';
import type { ExerciseId, Routine, Session, Settings } from '../types.js';
import { DB_VERSION, getDb, SETTINGS_KEY, toPlain } from './schema.js';

/**
 * Whole-database backup (docs/SPEC.md §8).
 *
 * The format is a declared type with a schema version, not a JSON.stringify of
 * whatever the database happens to contain, so a file written today can still
 * be read after the stores change.
 */

export const BACKUP_SCHEMA = 'deadload.backup/1';

export interface BackupFile {
	schema: typeof BACKUP_SCHEMA;
	/** The IndexedDB version the file was written from. */
	schemaVersion: number;
	exportedAt: string;
	routines: Routine[];
	sessions: Session[];
	/** Normalized imported name -> ExerciseId. */
	aliasOverrides: Record<string, ExerciseId>;
	settings: Settings | null;
}

/**
 * Deliberately permissive about the records themselves: a backup should restore
 * even if a field was added since it was written. The envelope is what is
 * checked strictly, because that is what tells us the file is ours at all.
 */
const backupSchema = z.object({
	schema: z.literal(BACKUP_SCHEMA),
	schemaVersion: z.number().int().positive(),
	exportedAt: z.string(),
	routines: z.array(z.looseObject({ id: z.string() })),
	sessions: z.array(z.looseObject({ id: z.string() })),
	aliasOverrides: z.record(z.string(), z.string()).default({}),
	settings: z.looseObject({}).nullable().default(null)
});

export class BackupError extends Error {
	constructor(
		message: string,
		readonly detail?: string
	) {
		super(message);
		this.name = 'BackupError';
	}
}

export async function buildBackup(): Promise<BackupFile> {
	const db = await getDb();

	const aliasOverrides: Record<string, ExerciseId> = {};
	const tx = db.transaction('aliasOverrides');
	for await (const cursor of tx.store.iterate()) {
		aliasOverrides[String(cursor.key)] = cursor.value;
	}

	return {
		schema: BACKUP_SCHEMA,
		schemaVersion: DB_VERSION,
		exportedAt: new Date().toISOString(),
		routines: await db.getAll('routines'),
		sessions: await db.getAll('sessions'),
		aliasOverrides,
		settings: (await db.get('settings', SETTINGS_KEY)) ?? null
	};
}

export function serializeBackup(backup: BackupFile): string {
	return JSON.stringify(backup, null, '\t');
}

export function parseBackup(text: string): BackupFile {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		throw new BackupError('That file is not valid JSON.');
	}

	const parsed = backupSchema.safeParse(raw);
	if (!parsed.success) {
		const issue = parsed.error.issues[0];
		const where = issue.path.length ? issue.path.join(' → ') : 'the file';
		// A routine export is the likeliest wrong file to pick.
		const hint =
			raw && typeof raw === 'object' && 'blocks' in raw
				? 'That looks like a single routine. Use the import screen for those.'
				: `${where}: ${issue.message}`;
		throw new BackupError('That is not a Deadload backup.', hint);
	}

	if (parsed.data.schemaVersion > DB_VERSION) {
		throw new BackupError(
			'That backup came from a newer version of the app.',
			`The file is version ${parsed.data.schemaVersion}; this app reads up to ${DB_VERSION}. Update the app first.`
		);
	}

	return parsed.data as unknown as BackupFile;
}

export interface RestoreSummary {
	routinesAdded: number;
	routinesUpdated: number;
	routinesSkipped: number;
	sessionsAdded: number;
	sessionsSkipped: number;
	aliasesAdded: number;
}

/**
 * `replace` wipes the user data stores first. `merge` deduplicates by id (§8):
 * a routine is overwritten only when the file's copy is newer, and sessions and
 * learned aliases already on the device are always left alone, because the
 * device is the more recent authority on both.
 */
export async function restoreBackup(
	backup: BackupFile,
	mode: 'merge' | 'replace'
): Promise<RestoreSummary> {
	const db = await getDb();
	const summary: RestoreSummary = {
		routinesAdded: 0,
		routinesUpdated: 0,
		routinesSkipped: 0,
		sessionsAdded: 0,
		sessionsSkipped: 0,
		aliasesAdded: 0
	};

	if (mode === 'replace') {
		const wipe = db.transaction(['routines', 'sessions', 'aliasOverrides'], 'readwrite');
		await Promise.all([
			wipe.objectStore('routines').clear(),
			wipe.objectStore('sessions').clear(),
			wipe.objectStore('aliasOverrides').clear(),
			wipe.done
		]);
	}

	for (const routine of backup.routines) {
		const existing = mode === 'merge' ? await db.get('routines', routine.id) : undefined;
		if (!existing) {
			await db.put('routines', toPlain(routine as Routine));
			summary.routinesAdded++;
		} else if (Date.parse(routine.updatedAt) > Date.parse(existing.updatedAt)) {
			await db.put('routines', toPlain(routine as Routine));
			summary.routinesUpdated++;
		} else {
			summary.routinesSkipped++;
		}
	}

	for (const session of backup.sessions) {
		const existing = mode === 'merge' ? await db.get('sessions', session.id) : undefined;
		if (existing) {
			summary.sessionsSkipped++;
			continue;
		}
		await db.put('sessions', toPlain(session as Session));
		summary.sessionsAdded++;
	}

	for (const [name, exerciseId] of Object.entries(backup.aliasOverrides)) {
		if (mode === 'merge' && (await db.get('aliasOverrides', name))) continue;
		await db.put('aliasOverrides', exerciseId, name);
		summary.aliasesAdded++;
	}

	if (mode === 'replace' && backup.settings) {
		await db.put('settings', toPlain(backup.settings), SETTINGS_KEY);
	}

	return summary;
}

export function backupFilename(now = new Date()): string {
	const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, '-');
	return `deadload-backup-${stamp}.json`;
}
