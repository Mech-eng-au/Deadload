import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRESET_FILES, presetPath } from '../src/lib/import/index.js';
import { parseJson } from '../src/lib/import/parse-json.js';
import { LOCALES, BASE_LOCALE } from '../src/lib/i18n/index.js';

/**
 * Translated presets (docs/SPEC.md §16, §9).
 *
 * A preset is a file in the import format, and a translated preset is a
 * translated file — so it is parsed by the same parser as a user's own import,
 * and §9's "the preset path is the import path" still holds for every language.
 *
 * The rule these tests exist for: **a translation may change the words and
 * nothing else.** The exercises, the sets, the targets, the rest and the
 * structure are the routine; the name, the description, the section labels and
 * the notes are the words. Getting that wrong would mean a Dane and an
 * English speaker doing measurably different workouts from a preset with one
 * name, and nothing in the app would ever say so.
 */

const STATIC = join(import.meta.dirname, '../static');

function read(file: string, locale: string): unknown | undefined {
	const path = join(STATIC, presetPath(file, locale));
	return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : undefined;
}

/** Everything about a routine that is not words. */
function shape(raw: any) {
	return {
		blocks: raw.blocks.map((b: any) => ({
			circuit: b.circuit === true || b.mode === 'circuit',
			items: b.items.map((i: any) => ({
				exercise: i.exercise,
				sets: i.sets,
				reps: i.reps,
				reps_min: i.reps_min,
				reps_max: i.reps_max,
				duration_seconds: i.duration_seconds,
				amrap: i.amrap,
				per_side: i.per_side,
				rest_seconds: i.rest_seconds,
				load_kg: i.load_kg,
				/** Not the note itself — only whether there is one to translate. */
				hasNotes: typeof i.notes === 'string' && i.notes.length > 0
			}))
		}))
	};
}

const translated = LOCALES.filter((l) => l.id !== BASE_LOCALE);

describe('translated presets (§16)', () => {
	it('has an English original for every preset', () => {
		for (const file of PRESET_FILES) {
			expect(read(file, BASE_LOCALE), `${file} is missing`).toBeDefined();
		}
	});

	it.each(translated)('$id has a copy of every preset', ({ id }) => {
		// Not strictly required — the loader falls back to English per file — but a
		// language that ships eight of nine is a mistake, not a decision, and this
		// is where it gets noticed.
		for (const file of PRESET_FILES) {
			expect(read(file, id), `${file} has no ${id} translation`).toBeDefined();
		}
	});

	it.each(translated)('$id parses through the same importer as English', ({ id }) => {
		for (const file of PRESET_FILES) {
			const raw = read(file, id);
			if (!raw) continue;
			expect(() => parseJson(JSON.stringify(raw)), `${id}/${file}`).not.toThrow();
		}
	});

	it.each(translated)('$id prescribes exactly the same workout as English', ({ id }) => {
		for (const file of PRESET_FILES) {
			const original = read(file, BASE_LOCALE) as any;
			const copy = read(file, id) as any;
			if (!copy) continue;
			expect(shape(copy), `${id}/${file} is a different workout`).toEqual(shape(original));
		}
	});

	it.each(translated)('$id translates the words rather than copying them', ({ id }) => {
		for (const file of PRESET_FILES) {
			const original = read(file, BASE_LOCALE) as any;
			const copy = read(file, id) as any;
			if (!copy) continue;
			expect(copy.name, `${id}/${file} name is still English`).not.toBe(original.name);
			if (original.description) {
				expect(copy.description, `${id}/${file} description is still English`).not.toBe(
					original.description
				);
			}
			// Every note that exists in English exists here, and says something else.
			original.blocks.forEach((block: any, b: number) =>
				block.items.forEach((item: any, i: number) => {
					if (!item.notes) return;
					const note = copy.blocks[b].items[i].notes;
					expect(note, `${id}/${file} block ${b} item ${i} lost its note`).toBeTruthy();
					expect(note, `${id}/${file} block ${b} item ${i} note is still English`).not.toBe(
						item.notes
					);
				})
			);
		}
	});

	it.each(translated)('$id keeps the two baby presets free of jumping and crunches', ({ id }) => {
		// §9 has a test for this in English. A translation is a second copy of the
		// file, so it is a second chance to get it wrong.
		const banned = /crunch|jump|sit_up|situp/i;
		for (const file of ['baby-floor-time.json', 'baby-in-arms.json']) {
			const raw = read(file, id) as any;
			if (!raw) continue;
			for (const block of raw.blocks) {
				for (const item of block.items) {
					expect(banned.test(item.exercise), `${id}/${file} has ${item.exercise}`).toBe(false);
				}
			}
		}
	});
});
