import { backupFilename, buildBackup, serializeBackup } from './backup.js';
import { catalog } from '../catalog/index.js';
import { sessionsToCsv } from '../stats/csv.js';
import { listSessions } from './sessions.js';

/** Shared by both exports: write it somewhere, then hand it to the system. */
async function deliver(
	filename: string,
	contents: string,
	mime: string
): Promise<{ filename: string; shared: boolean }> {
	const { Capacitor } = await import('@capacitor/core');

	if (Capacitor.isNativePlatform()) {
		const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
		// Cache needs no permission, and the file is meant to leave the device
		// immediately via the share sheet.
		await Filesystem.writeFile({
			path: filename,
			data: contents,
			directory: Directory.Cache,
			encoding: Encoding.UTF8
		});
		const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });

		const { Share } = await import('@capacitor/share');
		const { value } = await Share.canShare();
		if (value) {
			await Share.share({ title: filename, text: filename, url: uri, dialogTitle: 'Save or send' });
			return { filename, shared: true };
		}
		return { filename, shared: false };
	}

	const url = URL.createObjectURL(new Blob([contents], { type: mime }));
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	return { filename, shared: true };
}

/** Every logged set as CSV, for reading somewhere other than this app. */
export async function exportCsvFile(): Promise<{ filename: string; shared: boolean }> {
	const sessions = await listSessions();
	const csv = sessionsToCsv(sessions, new Map(catalog.map((e) => [e.id, e])));
	const stamp = backupFilename().replace('deadload-backup-', '').replace('.json', '');
	return deliver(`deadload-sets-${stamp}.csv`, csv, 'text/csv');
}

/**
 * Getting the backup off the device.
 *
 * A blob download does not reliably reach the Android download manager from
 * inside a WebView, so on the phone the file is written to app storage and
 * handed to the system share sheet — which is also how it reaches Drive or
 * email rather than sitting on the same device it is meant to protect.
 */
export async function exportBackupFile(): Promise<{ filename: string; shared: boolean }> {
	const json = serializeBackup(await buildBackup());
	return deliver(backupFilename(), json, 'application/json');
}
