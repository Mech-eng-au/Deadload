import { backupFilename, buildBackup, serializeBackup } from './backup.js';

/**
 * Getting the backup off the device.
 *
 * A blob download does not reliably reach the Android download manager from
 * inside a WebView, so on the phone the file is written to app storage and
 * handed to the system share sheet — which is also how it reaches Drive or
 * email rather than sitting on the same device it is meant to protect.
 */
export async function exportBackupFile(): Promise<{ filename: string; shared: boolean }> {
	const backup = await buildBackup();
	const json = serializeBackup(backup);
	const filename = backupFilename();

	const { Capacitor } = await import('@capacitor/core');

	if (Capacitor.isNativePlatform()) {
		const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
		// Cache needs no permission, and the file is meant to leave the device
		// immediately via the share sheet.
		await Filesystem.writeFile({
			path: filename,
			data: json,
			directory: Directory.Cache,
			encoding: Encoding.UTF8
		});
		const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });

		const { Share } = await import('@capacitor/share');
		const { value } = await Share.canShare();
		if (value) {
			await Share.share({
				title: 'Deadload backup',
				text: filename,
				url: uri,
				dialogTitle: 'Save your Deadload backup'
			});
			return { filename, shared: true };
		}
		return { filename, shared: false };
	}

	const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	return { filename, shared: true };
}
