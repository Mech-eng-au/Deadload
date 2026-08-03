import { globSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Browser APIs that the Android WebView does not have, kept behind one door each
 * (docs/SPEC.md §14, amended 2026-08-03).
 *
 * **This test exists because the rule was broken by the one screen that did not
 * know it was a rule.** The import screen's catalog-file button built its own
 * `<a download>` and clicked it. In `vite dev` that downloads a file. In the
 * Android WebView it does nothing at all — no file, no error, no console
 * message, just a button that visibly does not work — so the first real attempt
 * to generate a routine on the phone reached the chat with no catalog attached,
 * and the model refused to invent exercise ids, which is exactly what §14 asks
 * it to refuse.
 *
 * The cause is not "used the wrong API". Every one of these lessons was already
 * written down: §8 says the WebView has no print dialog, §7 says it has no
 * `speechSynthesis`, and `export-file.ts` says a blob download does not reach
 * the download manager. The knowledge existed and the screen did not use it,
 * because prose in a doc cannot fail a build. So each lesson gets a wall here,
 * named for the one file allowed through it.
 *
 * Adding a file to an `ONLY_IN` list is a claim that it handles the native case
 * as well as the browser one. There is currently exactly one such file per API,
 * and there is no reason for there to be two.
 */

const SRC = join(import.meta.dirname, '../src');

interface Wall {
	/** What it looks for, and what it is called when it is found. */
	api: string;
	pattern: RegExp;
	/** The file that is allowed to use it, because it handles both platforms. */
	onlyIn: string[];
	/** Where to go instead. */
	instead: string;
}

const WALLS: Wall[] = [
	{
		api: 'a synthetic <a download> click',
		// The anchor and the blob URL that feeds it: either one on its own is
		// enough to show a download was hand-rolled.
		pattern: /createElement\(\s*['"]a['"]\s*\)|URL\.createObjectURL/,
		onlyIn: ['lib/db/export-file.ts'],
		instead: 'deliver() in $lib/db/export-file.ts — Filesystem + Share on the phone'
	},
	{
		api: 'window.print()',
		pattern: /\bwindow\s*\.\s*print\s*\(/,
		// Nothing may use it: §8 replaced printing with a generated PDF outright.
		onlyIn: [],
		instead: 'exportRoutinePdf() in $lib/db/export-file.ts (§8)'
	},
	{
		api: 'speechSynthesis',
		pattern: /\bspeechSynthesis\b/,
		onlyIn: ['lib/session/speech.ts'],
		instead: 'speak() in $lib/session/speech.ts, which falls back to the TTS plugin (§7)'
	}
];

const sources = globSync('**/*.{ts,svelte}', { cwd: SRC })
	.map((file) => file.replaceAll('\\', '/'))
	.sort();

describe('APIs the Android WebView does not have', () => {
	it('finds the source to scan', () => {
		expect(sources.length).toBeGreaterThan(20);
	});

	for (const wall of WALLS) {
		it(`only ${wall.onlyIn.length === 0 ? 'nothing' : wall.onlyIn.join(', ')} uses ${wall.api}`, () => {
			const offenders = sources.filter((file) => {
				if (wall.onlyIn.includes(file)) return false;
				const source = readFileSync(join(SRC, file), 'utf8');
				// Comments explain these APIs all over the codebase; only code counts.
				return wall.pattern.test(stripComments(source));
			});
			expect(
				offenders,
				`${wall.api} does nothing inside the Android WebView. Use ${wall.instead}.`
			).toEqual([]);
		});

		it(`${wall.api} is still reachable where it is allowed`, () => {
			// A wall that guards an API nobody uses any more is a stale wall, and
			// a typo in the pattern would look exactly like a passing test.
			for (const file of wall.onlyIn) {
				const source = stripComments(readFileSync(join(SRC, file), 'utf8'));
				expect(wall.pattern.test(source), `${file} no longer uses ${wall.api}`).toBe(true);
			}
		});
	}
});

/** Block and line comments, so a warning about an API does not read as a use of it. */
function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');
}

describe('the catalog file the LLM prompt depends on', () => {
	/**
	 * §14's prompt tells the model to use only exercises from the attached file.
	 * If the button that produces that file is not wired to a real delivery path,
	 * the prompt is an instruction to attach something that never arrives.
	 */
	it('is exported through the shared delivery path', () => {
		const page = readFileSync(join(SRC, 'routes/import/+page.svelte'), 'utf8');
		expect(page).toContain('exportCatalogFile');
		const exportFile = readFileSync(join(SRC, 'lib/db/export-file.ts'), 'utf8');
		expect(exportFile).toMatch(/export async function exportCatalogFile[\s\S]*?return deliver\(/);
	});
});

it.for(sources.filter((f) => f.startsWith('routes/')))(
	'%s does not import prompt.js to build a file by hand',
	(file) => {
		// The catalog JSON is built in `import/prompt.ts` and delivered in
		// `export-file.ts`. A route reaching for the builder directly is a route
		// about to hand-roll the download again.
		const source = readFileSync(join(SRC, file), 'utf8');
		expect(source).not.toContain('llmCatalogJson');
	}
);
