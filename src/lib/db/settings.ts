import type { Settings } from '../types.js';
import { getDb, SETTINGS_KEY } from './schema.js';

const defaults: Settings = {
	persistRequested: false,
	persistGranted: false,
	createdAt: new Date().toISOString()
};

export async function getSettings(): Promise<Settings> {
	const db = await getDb();
	return (await db.get('settings', SETTINGS_KEY)) ?? { ...defaults };
}

export async function putSettings(settings: Settings): Promise<Settings> {
	const db = await getDb();
	await db.put('settings', settings, SETTINGS_KEY);
	return settings;
}

/**
 * Ask the browser to exempt this origin from storage eviction (§8). Called once
 * on first launch; afterwards we only re-read the current state, because a
 * repeated request cannot change a decision the user already made.
 */
export async function ensureStoragePersisted(): Promise<Settings> {
	const settings = await getSettings();
	if (!navigator.storage?.persist) return settings;

	let granted = await navigator.storage.persisted();
	if (!granted && !settings.persistRequested) {
		granted = await navigator.storage.persist();
	}

	return putSettings({ ...settings, persistRequested: true, persistGranted: granted });
}

/**
 * §8 asks for a backup reminder each time the session count crosses a multiple
 * of 20. Comparing against the count at the last export means the reminder
 * appears once per threshold and disappears the moment a backup is taken.
 */
export const BACKUP_REMINDER_EVERY = 20;

export function backupIsDue(sessionCount: number, settings: Settings | null): boolean {
	if (sessionCount < BACKUP_REMINDER_EVERY) return false;
	const since = settings?.lastExportSessionCount ?? 0;
	return (
		Math.floor(sessionCount / BACKUP_REMINDER_EVERY) > Math.floor(since / BACKUP_REMINDER_EVERY)
	);
}

export async function recordExport(sessionCount: number): Promise<Settings> {
	const settings = await getSettings();
	return putSettings({
		...settings,
		lastExportSessionCount: sessionCount,
		lastExportAt: new Date().toISOString()
	});
}

/** Bytes in use and available, when the browser is willing to say. */
export async function storageEstimate(): Promise<{ usage?: number; quota?: number }> {
	if (!navigator.storage?.estimate) return {};
	const { usage, quota } = await navigator.storage.estimate();
	return { usage, quota };
}
