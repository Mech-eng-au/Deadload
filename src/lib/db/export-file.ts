import { backupFilename, buildBackup, serializeBackup } from './backup.js';
import { catalog } from '../catalog/index.js';
import { loadThumbnails } from '../pdf/images.js';
import { routineSheet, sheetFilename, type Orientation } from '../pdf/routine-sheet.js';
import { sessionsToCsv } from '../stats/csv.js';
import { listSessions } from './sessions.js';
import type { Routine } from '../types.js';

/** Base64 for the Filesystem plugin, which is how it takes anything not text. */
function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

/** Shared by every export: write it somewhere, then hand it to the system. */
async function deliver(
	filename: string,
	contents: string | Uint8Array,
	mime: string
): Promise<{ filename: string; shared: boolean }> {
	const { Capacitor } = await import('@capacitor/core');

	if (Capacitor.isNativePlatform()) {
		const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
		// Cache needs no permission, and the file is meant to leave the device
		// immediately via the share sheet. Binary goes as base64 with no encoding
		// named: `Encoding.UTF8` on PDF bytes would mangle them.
		await Filesystem.writeFile({
			path: filename,
			data: typeof contents === 'string' ? contents : toBase64(contents),
			directory: Directory.Cache,
			...(typeof contents === 'string' ? { encoding: Encoding.UTF8 } : {})
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

	const url = URL.createObjectURL(new Blob([contents as BlobPart], { type: mime }));
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

/**
 * One routine as a printable A4 sheet (§8). Built in the browser like everything
 * else here — there is no server to render it and there is not going to be one.
 */
export async function exportRoutinePdf(
	routine: Routine,
	options: { photos?: boolean; orientation?: Orientation } = {}
): Promise<{ filename: string; shared: boolean; bytes: number }> {
	const byId = new Map(catalog.map((e) => [e.id, e]));
	const used = routine.blocks
		.flatMap((b) => b.items.map((i) => byId.get(i.exerciseId)))
		.filter((e): e is NonNullable<typeof e> => !!e);
	const images = options.photos === false ? undefined : await loadThumbnails(used);
	const bytes = routineSheet(routine, byId, { images, orientation: options.orientation });
	return { ...(await deliver(sheetFilename(routine), bytes, 'application/pdf')), bytes: bytes.length };
}
