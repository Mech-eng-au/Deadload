import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import catalogJson from '../src/lib/catalog/catalog.json' with { type: 'json' };
import {
	buildIndex,
	buildReview,
	ImportError,
	normalize,
	parseText,
	resolve,
	similarity,
	stripFences,
	toRoutine,
	type ReviewModel
} from '../src/lib/import/index.js';
import { parseJson } from '../src/lib/import/parse-json.js';
import { PRESET_FILES } from '../src/lib/import/index.js';
import type { Exercise } from '../src/lib/types.js';

const catalog = catalogJson as Exercise[];
const index = buildIndex(catalog);

const fixture = (name: string) =>
	readFileSync(join(import.meta.dirname, 'fixtures/imports', name), 'utf8');

let counter = 0;
const key = () => `k${counter++}`;

function review(text: string, filename?: string): ReviewModel {
	return buildReview(parseText(text, filename), index, new Map(), key);
}

const items = (r: ReviewModel) => r.blocks.flatMap((b) => b.items);

describe('normalization and similarity', () => {
	it('normalizes punctuation, case and diacritics identically', () => {
		expect(normalize("World's Greatest Stretch")).toBe('worlds greatest stretch');
		expect(normalize('worlds-greatest-stretch')).toBe('worlds greatest stretch');
		expect(normalize('  Child’s   Pose!  ')).toBe('childs pose');
	});

	it('scores identical strings 1 and unrelated strings low', () => {
		expect(similarity('plank', 'plank')).toBe(1);
		expect(similarity('plank', 'kettlebell swing')).toBeLessThan(0.3);
		expect(similarity('push ups', 'pushups')).toBeGreaterThan(0.8);
	});
});

describe('resolver cascade (§6.3)', () => {
	it('matches an exact catalog id', () => {
		const r = resolve('worlds_greatest_stretch', index);
		expect(r).toMatchObject({ status: 'resolved', via: 'id' });
	});

	it('matches a display name regardless of punctuation', () => {
		expect(resolve("World's Greatest Stretch", index)).toMatchObject({
			status: 'resolved',
			exerciseId: 'worlds_greatest_stretch',
			via: 'name'
		});
	});

	it('matches a hand-authored alias', () => {
		expect(resolve('cat cow', index)).toMatchObject({
			status: 'resolved',
			exerciseId: 'cat_stretch',
			via: 'alias'
		});
	});

	it('prefers a learned override over the catalog name', () => {
		const overrides = new Map([[normalize('Plank'), 'side_bridge']]);
		expect(resolve('Plank', index, overrides)).toMatchObject({
			status: 'resolved',
			exerciseId: 'side_bridge',
			via: 'override'
		});
	});

	it('suggests rather than auto-accepting a near miss', () => {
		// A plural the catalog does not list as an alias: close enough to suggest,
		// not close enough to accept silently.
		const r = resolve('bodyweight squats', index);
		expect(r.status).toBe('suggested');
		if (r.status === 'suggested') {
			expect(r.candidates.length).toBeLessThanOrEqual(3);
			expect(r.candidates[0].exerciseId).toBe('bodyweight_squat');
		}
	});

	it('leaves a real typo unresolved rather than guessing', () => {
		// One transposition scores 0.80 against a 17-character name, under the
		// 0.82 bar. The user still gets candidates to pick from.
		const r = resolve('mountian climbers', index);
		expect(r.status).toBe('unresolved');
		if (r.status === 'unresolved') expect(r.candidates[0].exerciseId).toBe('mountain_climbers');
	});

	it('returns candidates even when nothing is close', () => {
		const r = resolve('kettlebell swing', index);
		expect(r.status).toBe('unresolved');
		if (r.status === 'unresolved') expect(r.candidates).toHaveLength(5);
	});
});

describe('fence stripping', () => {
	it('removes fenced blocks, with or without a closing fence', () => {
		expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
		expect(stripFences('```\n{"a":1}')).toBe('{"a":1}');
		expect(stripFences('{"a":1}')).toBe('{"a":1}');
	});
});

describe('fixtures from §6.5', () => {
	it('imports a valid routine with every name resolvable', () => {
		const r = review(fixture('valid.json'));
		expect(r.name).toBe('Morning hip mobility');
		expect(r.blocks).toHaveLength(2);
		expect(items(r).every((i) => i.chosen)).toBe(true);
	});

	it('imports JSON still wrapped in markdown fences', () => {
		const r = review(fixture('fenced.json'));
		expect(r.name).toBe('Fenced routine');
		expect(items(r)[0].chosen).toBe('pushups');
	});

	it('coerces "3" to 3 and "false" to false', () => {
		const r = review(fixture('string-sets.json'));
		const { routine } = toRoutine(r, index, key);
		expect(routine.blocks[0].items[0].sets).toBe(3);
		expect(routine.blocks[0].items[0].target).toEqual({ kind: 'duration', seconds: 45 });
		expect(routine.blocks[0].items[0].perSide).toBe(false);
	});

	it('picks duration for stretches and reps otherwise when both are given', () => {
		const r = review(fixture('both-targets.json'));
		const { routine, notes } = toRoutine(r, index, key);
		const [stretch, strength] = routine.blocks[0].items;
		expect(stretch.target).toEqual({ kind: 'duration', seconds: 60 });
		expect(strength.target).toEqual({ kind: 'reps', reps: 12 });
		expect(notes.filter((n) => n.level === 'warning')).toHaveLength(2);
	});

	it('accepts a bare array with no blocks wrapper', () => {
		const r = review(fixture('bare-array.json'));
		expect(items(r)).toHaveLength(2);
		expect(items(r).every((i) => i.chosen)).toBe(true);
	});

	it('flags the three exercises that do not exist, keeping the one that does', () => {
		const r = review(fixture('unknown-exercises.json'));
		const unresolved = items(r).filter((i) => !i.chosen);
		expect(unresolved).toHaveLength(3);
		expect(unresolved.every((i) => i.result.status !== 'resolved')).toBe(true);
		expect(items(r).find((i) => i.chosen)?.chosen).toBe('pushups');
	});

	it('reads a CSV whose notes contain commas', () => {
		const r = review(fixture('quoted-notes.csv'), 'quoted-notes.csv');
		const all = items(r);
		expect(all).toHaveLength(2);
		expect(all[0].raw.notes).toBe('Move slowly, follow the breath');
		expect(all[1].chosen).toBe('worlds_greatest_stretch');
		expect(r.blocks.map((b) => b.label)).toEqual(['Warm-up', 'Main']);
	});

	it('ignores an empty trailing CSV row', () => {
		const r = review(fixture('trailing-row.csv'), 'trailing-row.csv');
		expect(items(r)).toHaveLength(1);
	});

	it('refuses something that is not a routine at all', () => {
		expect(() => review(fixture('not-a-routine.json'))).toThrow(ImportError);
		try {
			review(fixture('not-a-routine.json'));
		} catch (err) {
			expect((err as ImportError).message).toMatch(/no exercises/i);
		}
	});

	it('explains malformed JSON with the offending line', () => {
		try {
			parseJson('{\n "name": "Broken",\n "blocks": [ \n}');
			throw new Error('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(ImportError);
			expect((err as ImportError).message).toMatch(/not valid JSON/i);
			expect((err as ImportError).detail).toBeTruthy();
		}
	});
});

describe('defaults (§6.1)', () => {
	it('defaults sets, rest and per-side from the catalog', () => {
		const r = review('[{"exercise":"worlds_greatest_stretch"},{"exercise":"pushups"}]');
		const { routine } = toRoutine(r, index, key);
		const [stretch, strength] = routine.blocks[0].items;

		expect(stretch.sets).toBe(1);
		expect(stretch.restSeconds).toBe(0);
		expect(stretch.perSide).toBe(true); // unilateral in the catalog
		expect(stretch.target).toEqual({ kind: 'duration', seconds: 30 });

		expect(strength.restSeconds).toBe(30);
		expect(strength.perSide).toBe(false);
		expect(strength.target).toEqual({ kind: 'reps', reps: 10 });
	});

	it('keeps a rep range and an amrap intact', () => {
		const r = review('[{"exercise":"pushups","reps_min":8,"reps_max":12},{"exercise":"pullups","amrap":true}]');
		const { routine } = toRoutine(r, index, key);
		expect(routine.blocks[0].items[0].target).toEqual({ kind: 'reps_range', min: 8, max: 12 });
		expect(routine.blocks[0].items[1].target).toEqual({ kind: 'amrap' });
	});

	it('drops items the user rejected', () => {
		const r = review(fixture('unknown-exercises.json'));
		items(r).forEach((i) => {
			if (!i.chosen) i.dropped = true;
		});
		const { routine } = toRoutine(r, index, key);
		expect(routine.blocks[0].items).toHaveLength(1);
	});
});

describe('built-in presets (§9)', () => {
	it.each(PRESET_FILES)('%s resolves completely through the import path', (file) => {
		const text = readFileSync(join(import.meta.dirname, '../static/presets', file), 'utf8');
		const r = review(text, file);
		const unresolved = items(r).filter((i) => !i.chosen);
		expect(unresolved.map((i) => i.written)).toEqual([]);
		expect(items(r).length).toBeGreaterThan(3);

		const { routine } = toRoutine(r, index, key, 'builtin');
		expect(routine.source).toBe('builtin');
		expect(routine.name.length).toBeGreaterThan(0);
		expect(routine.blocks.flatMap((b) => b.items).length).toBe(items(r).length);
	});
});
