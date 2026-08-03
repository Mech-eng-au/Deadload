import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Nothing user-visible is spelled out in a component (docs/SPEC.md §16).
 *
 * **This test exists because the rule was already broken the day it shipped.**
 * The 2026-08-02 language round translated 23 screens and missed six files —
 * the whole routine-building flow, which in Danish was entirely English:
 * `RoutineEditor`, both routine pages, the catalog picker, the exercise sheet
 * and the body map's legend. Nothing failed. `npm run check` was clean, 326
 * tests passed, and the dictionaries were in perfect parity with each other,
 * because parity only says the two locales agree — not that the screens use
 * them.
 *
 * The cause is worth writing down, because it is not "forgot a file". Every
 * verification that round pointed at the dictionaries or at the screens I had
 * just edited; the screenshot pass covered eight screens and never opened the
 * editor. **A translation is only as complete as the least-visited screen**, and
 * a human sweep will always be biased toward what was recently touched. So the
 * check has to be mechanical.
 *
 * What it looks for is deliberately crude — text between tags, and the
 * attributes a user can read — because the failure mode is crude too. It is a
 * lint, not a parser, and the `ALLOWED` list below is where the exceptions
 * argue for themselves.
 */

const SRC = join(import.meta.dirname, '../src');

/**
 * Text that is not translatable copy, with the reason it is not.
 *
 * Anything added here is a claim that a Danish reader is no worse off seeing
 * the English, so it should be a proper noun, a unit, or a symbol.
 */
const ALLOWED = new Set([
	'Deadload', // the app's name, which is not translated
	'RPE', // borrowed into Danish as-is, and already a key where it is a label
	'kg',
	'JSON',
	'CSV',
	'A4',
	'min',
	'PDF'
]);

/** Strip what is not markup: the script block, styles, and comments. */
function markup(source: string): string {
	return source
		.replace(/<script[\s\S]*?<\/script>/g, '')
		.replace(/<style[\s\S]*?<\/style>/g, '')
		.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Prose a user can read that did not come from the dictionary.
 *
 * A text node containing only `{...}` expressions is fine — that is a lookup.
 * A text node containing letters outside braces is not.
 */
function literals(source: string): string[] {
	const body = markup(source);
	const found: string[] = [];

	// Between tags: `>Save routine<`. Braces are excluded from the character
	// class, so anything interpolated is skipped by construction.
	for (const [, text] of body.matchAll(/>([^<>{}]+)</g)) {
		const trimmed = text.trim();
		if (!/[A-Za-z]{3,}/.test(trimmed)) continue;
		if (ALLOWED.has(trimmed)) continue;
		found.push(trimmed);
	}

	// Attributes a user reads. `alt` is deliberately not here: it is usually an
	// exercise name, which comes from the catalog and stays English (§16.1).
	//
	// Interpolations are stripped *before* judging, rather than the attribute
	// being skipped for containing one. `aria-label="Reorder {name}"` is exactly
	// as untranslated as `aria-label="Reorder"`, and the first version of this
	// test let both of those through — it excluded braces from the character
	// class, so any attribute with an expression in it was invisible. Two real
	// misses were hiding there.
	for (const [, , raw] of body.matchAll(/(placeholder|aria-label|title)="([^"]*)"/g)) {
		const outside = raw.replace(/\{[^{}]*\}/g, '').trim();
		if (!/[A-Za-z]{3,}/.test(outside)) continue;
		if (ALLOWED.has(outside)) continue;
		found.push(outside);
	}

	return found;
}

const files = globSync('**/*.svelte', { cwd: SRC }).sort();

describe('every user-visible string comes from a dictionary (§16)', () => {
	it('finds the components at all, so a broken glob cannot pass silently', () => {
		expect(files.length).toBeGreaterThan(20);
	});

	it.each(files)('%s spells out no prose of its own', (file) => {
		const found = literals(readFileSync(join(SRC, file), 'utf8'));
		expect(
			found,
			`${file} has ${found.length} literal string(s) a translation cannot reach:\n` +
				found.map((f) => `  "${f}"`).join('\n')
		).toEqual([]);
	});
});

describe('the dictionaries are actually used (§16)', () => {
	/**
	 * The other half of the same failure: a key can exist in both languages, be
	 * perfectly in parity, and be referenced by nothing. That is not a bug on the
	 * phone, but it is dead weight that reads as coverage — and it is how the
	 * editor's keys sat unused for a day while looking finished.
	 */
	it('has no message key that no component or module mentions', async () => {
		const { en } = await import('../src/lib/i18n/en/index.js');

		// Whitespace collapsed, because the formatter breaks a long expression
		// across lines — `t.importer\n\t.llmChangeInSettings` is a use, and a naive
		// substring search calls it dead.
		const sources = globSync('**/*.{svelte,ts}', { cwd: SRC })
			.filter((f) => !f.startsWith('lib/i18n/'))
			.map((f) => readFileSync(join(SRC, f), 'utf8'))
			.join('\n')
			.replace(/\s*\n\s*/g, '');

		/**
		 * Namespaces reached by a computed key — `t.nav[tab.key]`,
		 * `t.equipment.labels[id]` — where no member name appears in the source at
		 * all. Exempting the *namespace* rather than every key inside it keeps the
		 * exemption honest: it is a claim about how the group is accessed.
		 */
		const COMPUTED = new Set(['nav']);
		const COMPUTED_GROUPS = new Set([
			'labels',
			'needs',
			'notes',
			'names',
			'approximated',
			'categories',
			'levels',
			'targetKinds',
			'totals'
		]);

		const unused: string[] = [];
		for (const [namespace, group] of Object.entries(en)) {
			if (COMPUTED.has(namespace)) continue;
			for (const key of Object.keys(group as object)) {
				if (COMPUTED_GROUPS.has(key)) continue;
				if (!sources.includes(`${namespace}.${key}`)) unused.push(`${namespace}.${key}`);
			}
		}
		expect(unused, `${unused.length} key(s) nothing refers to:\n  ${unused.join('\n  ')}`).toEqual(
			[]
		);
	});
});
