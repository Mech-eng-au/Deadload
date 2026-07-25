import { ImportError, parseJson, stripFences, type ParsedRoutine } from './parse-json.js';
import { parseCsv } from './parse-csv.js';

export { ImportError, stripFences };
export type { ParsedRoutine };
export * from './resolve.js';
export * from './to-routine.js';
export * from './types.js';
export { parseJson, parseCsv };

/**
 * Pick a parser by file extension, falling back to sniffing. A file dragged in
 * with the wrong extension should still import.
 */
export function parseText(text: string, filename?: string): ParsedRoutine {
	const isCsv = filename?.toLowerCase().endsWith('.csv');
	if (isCsv) return parseCsv(text);

	try {
		return parseJson(text);
	} catch (jsonError) {
		const looksTabular = /^[^\n]*\bexercise\b[^\n]*,/im.test(text);
		if (looksTabular) {
			try {
				return parseCsv(text);
			} catch {
				// Report the JSON failure: that is what the user most likely meant.
			}
		}
		throw jsonError;
	}
}

/** Built-in routines, shipped as files in the wire format (§9). */
export const PRESET_FILES = [
	'hip-flexibility.json',
	'lower-back-relief.json',
	'upper-body-strength.json',
	'full-body-15.json',
	'desk-decompression.json'
] as const;
