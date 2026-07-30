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
import { missingEquipment } from '../src/lib/catalog/equipment.js';
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

describe('circuit blocks (§6.1, §6.2)', () => {
	it('reads "circuit": true on a JSON block', () => {
		const r = review(
			'{"blocks":[{"label":"Main","circuit":true,"items":[{"exercise":"pushups"},{"exercise":"pullups"}]},{"label":"Cooldown","items":[{"exercise":"worlds_greatest_stretch"}]}]}'
		);
		const { routine } = toRoutine(r, index, key);
		expect(routine.blocks[0].mode).toBe('circuit');
		expect(routine.blocks[1].mode).toBeUndefined();
	});

	it('accepts "mode": "circuit" and a loose "yes" as synonyms', () => {
		const byMode = parseJson(
			'{"blocks":[{"mode":"Circuit","items":[{"exercise":"pushups"}]}]}'
		);
		expect(byMode.blocks[0].circuit).toBe(true);
		const byYes = parseJson('{"blocks":[{"circuit":"yes","items":[{"exercise":"pushups"}]}]}');
		expect(byYes.blocks[0].circuit).toBe(true);
	});

	it('marks a CSV block as a circuit from any truthy circuit cell', () => {
		const r = review(
			'block,exercise,sets,reps,circuit\nMain,Push-ups,3,10,true\nMain,Pull-ups,3,5,\nCooldown,Cat stretch,1,10,',
			'routine.csv'
		);
		const { routine } = toRoutine(r, index, key);
		expect(routine.blocks[0].mode).toBe('circuit');
		expect(routine.blocks[1].mode).toBeUndefined();
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

	it.each([
		['push-pull-supersets.json', 3],
		['full-body-circuit.json', 1]
	])('%s keeps its circuit blocks through the import path', (file, circuitBlocks) => {
		const text = readFileSync(join(import.meta.dirname, '../static/presets', file), 'utf8');
		const { routine } = toRoutine(review(text, file), index, key, 'builtin');
		expect(routine.blocks.filter((b) => b.mode === 'circuit')).toHaveLength(circuitBlocks);
	});

	it.each(['baby-floor-time.json', 'baby-in-arms.json'])(
		'%s keeps its per-item notes, which are the whole point of it',
		(file) => {
			// These two say where the baby goes, and the catalog cannot: the exercises
			// are ordinary, and `notes` is the only field carrying the instruction that
			// makes the routine what it is. Resolution passing while notes were
			// silently dropped would leave a preset that looks fine and is useless.
			const text = readFileSync(join(import.meta.dirname, '../static/presets', file), 'utf8');
			const { routine } = toRoutine(review(text, file), index, key, 'builtin');
			const withNotes = routine.blocks.flatMap((b) => b.items).filter((i) => i.notes?.trim());
			expect(withNotes.length).toBeGreaterThanOrEqual(5);
			expect(withNotes.some((i) => /bab(y|ies)/i.test(i.notes!))).toBe(true);
		}
	);

	it('keeps the baby presets free of the exercises a new parent should not be handed', () => {
		// Not medical advice, and not pretending to be — but a routine written for
		// somebody with a small baby has no business containing jumping or the
		// crunch family, and the catalog's `core` category is mostly that.
		const avoid = [
			'crunches',
			'sit_up',
			'jackknife_sit_up',
			'russian_twist',
			'air_bike',
			'freehand_jump_squat',
			'knee_tuck_jump',
			'plyo_push_up',
			'rope_jumping'
		];
		for (const file of ['baby-floor-time.json', 'baby-in-arms.json']) {
			const text = readFileSync(join(import.meta.dirname, '../static/presets', file), 'utf8');
			const { routine } = toRoutine(review(text, file), index, key, 'builtin');
			const ids = routine.blocks.flatMap((b) => b.items).map((i) => i.exerciseId);
			for (const bad of avoid) {
				expect(ids, `${file} contains ${bad}`).not.toContain(bad);
			}
		}
	});

	it('keeps the baby presets doable with nothing bought', () => {
		// A chair is furniture (§5.1) and allowed; anything gated is not, because the
		// person these are for is borrowing somebody else's phone to try the app.
		for (const file of ['baby-floor-time.json', 'baby-in-arms.json']) {
			const text = readFileSync(join(import.meta.dirname, '../static/presets', file), 'utf8');
			const { routine } = toRoutine(review(text, file), index, key, 'builtin');
			for (const item of routine.blocks.flatMap((b) => b.items)) {
				const exercise = index.byId.get(item.exerciseId)!;
				expect(missingEquipment(exercise, []), `${file}: ${item.exerciseId}`).toEqual([]);
			}
		}
	});
});
