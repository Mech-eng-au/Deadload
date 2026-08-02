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
/**
 * Where a preset is read from, for a language (§16).
 *
 * Presets are **files in the import format**, and §9 requires them to go
 * through the very same parser and resolver as a user's own import so that any
 * drift between the two fails loudly on a fresh install. A translated preset is
 * therefore a translated *file*, not a layer of overrides applied afterwards —
 * so a Danish preset is validated by exactly the same code, and adding a third
 * language is a directory.
 *
 * The English originals are the fallback, and stay the canonical structure:
 * `tests/presets.test.ts` asserts that every translation names the same
 * exercises, with the same sets and the same targets, so a translation can
 * never quietly become a different workout.
 */
export function presetPath(file: string, locale: string): string {
	return locale === 'en' ? `/presets/${file}` : `/presets/${locale}/${file}`;
}

export const PRESET_FILES = [
	'hip-flexibility.json',
	'lower-back-relief.json',
	'upper-body-strength.json',
	'full-body-15.json',
	'desk-decompression.json',
	'push-pull-supersets.json',
	'full-body-circuit.json',
	// Added 2026-07-30. The only two presets whose `notes` carry instructions the
	// catalog cannot: where the baby goes (§9).
	'baby-floor-time.json',
	'baby-in-arms.json'
] as const;
