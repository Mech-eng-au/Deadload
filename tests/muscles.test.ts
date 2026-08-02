import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { attributions, catalog } from '../src/lib/catalog/index.js';
import {
	APPROXIMATED,
	MUSCLE_REGIONS,
	mappedMuscles,
	slugsFor
} from '../src/lib/catalog/body-map.js';
import {
	MUSCLE_IDS,
	muscleInfo,
	muscleLabel,
	muscleUsage,
	muscleWithHint,
	musclesInCatalog
} from '../src/lib/catalog/muscles.js';
import { LOCALES, messages } from '../src/lib/i18n/index.js';
import { en } from '../src/lib/i18n/en/index.js';

/**
 * The glossary is hand-authored and the catalog is generated, so the two can
 * drift apart exactly as the ladders can. Same referential-integrity rules as
 * tests/ladders.test.ts.
 *
 * **Amended 2026-08-02 (§16):** the writing moved to the locale dictionaries, so
 * every rule below now runs for **every** language. A Danish glossary missing a
 * muscle is the same defect as an English one missing it, and it has to fail
 * here rather than print a raw anatomy word at somebody in the wrong language.
 */
describe('muscle glossary (§4.6)', () => {
	it.each(LOCALES)('explains every muscle the catalog names, in $id', ({ id: locale }) => {
		// The failure this exists for: a regenerated catalog introducing a muscle
		// name nobody has written a translation for, which would print the raw word
		// at the user again.
		const t = messages(locale);
		for (const id of musclesInCatalog()) {
			expect(muscleInfo(id, t), `${locale}: no glossary entry for "${id}"`).toBeDefined();
		}
	});

	it.each(LOCALES)('has no entries the catalog never uses, in $id', ({ id: locale }) => {
		// Dead entries are how a glossary starts lying: it would claim the app knows
		// about a muscle nothing trains.
		const used = new Set(musclesInCatalog());
		for (const id of Object.keys(messages(locale).muscles.names)) {
			expect(used.has(id), `${locale}: "${id}" is in the glossary but not in the catalog`).toBe(
				true
			);
		}
	});

	it('covers the seventeen names this source uses, and no more', () => {
		expect(MUSCLE_IDS).toHaveLength(17);
		expect(musclesInCatalog()).toHaveLength(17);
		expect([...MUSCLE_IDS].sort()).toEqual(musclesInCatalog());
	});

	it('never repeats an id', () => {
		expect(new Set(MUSCLE_IDS).size).toBe(MUSCLE_IDS.length);
	});

	it.each(LOCALES)('says something real in every field, in $id', ({ id: locale }) => {
		const t = messages(locale);
		for (const id of MUSCLE_IDS) {
			const m = t.muscles.names[id];
			expect(m.label.length, `${locale} ${id}`).toBeGreaterThan(2);
			// `short` goes in brackets after a name, so it has to stay short.
			expect(
				m.short.length,
				`${locale}: ${id} short is too long for a bracket`
			).toBeLessThanOrEqual(24);
			// `where` and `does` are sentences a person could act on.
			expect(m.where.endsWith('.'), `${locale}: ${id} where is not a sentence`).toBe(true);
			expect(m.does.endsWith('.'), `${locale}: ${id} does is not a sentence`).toBe(true);
			expect(m.where.length, `${locale} ${id}`).toBeGreaterThan(20);
			expect(m.does.length, `${locale} ${id}`).toBeGreaterThan(20);
		}
	});

	it('formats a name with its hint', () => {
		expect(muscleWithHint('quadriceps', en)).toBe('quadriceps (front of thigh)');
		expect(muscleWithHint('adductors', en)).toBe('adductors (inner thigh)');
		expect(muscleLabel('lower back', en)).toBe('Lower back');
	});

	it('falls back to the raw id rather than throwing on an unknown muscle', () => {
		expect(muscleLabel('spleen', en)).toBe('spleen');
		expect(muscleWithHint('spleen', en)).toBe('spleen');
		expect(muscleInfo('spleen', en)).toBeUndefined();
	});

	it('counts the catalog per muscle, most-trained first', () => {
		const quads = muscleUsage.find((r) => r.id === 'quadriceps')!;
		expect(quads.primary).toBe(
			catalog.filter((e) => e.primaryMuscles.includes('quadriceps')).length
		);
		expect(muscleUsage).toHaveLength(17);
		for (let i = 1; i < muscleUsage.length; i++) {
			expect(muscleUsage[i - 1].primary).toBeGreaterThanOrEqual(muscleUsage[i].primary);
		}
	});
});

describe('the body map colours what the glossary explains (§4.6)', () => {
	const FIGURES = (['front', 'back'] as const).map((view) => ({
		view,
		svg: readFileSync(join(import.meta.dirname, `../static/muscles/${view}.svg`), 'utf8')
	}));

	/** Every `data-slug` the figures actually contain. */
	function slugsIn(svg: string): Set<string> {
		return new Set([...svg.matchAll(/data-slug="([^"]+)"/g)].map((m) => m[1]));
	}

	it('maps every muscle in the glossary to at least one region', () => {
		// The failure this exists for: adding a muscle to the glossary and forgetting
		// to map it, which leaves a compendium entry whose figure lights nothing.
		for (const id of MUSCLE_IDS) {
			expect(mappedMuscles(), `nothing on the figures for ${id}`).toContain(id);
			const total = slugsFor([id], 'front').length + slugsFor([id], 'back').length;
			expect(total, `${id} maps to no region in either view`).toBeGreaterThan(0);
		}
	});

	it('maps nothing the glossary does not explain', () => {
		const known = new Set<string>(MUSCLE_IDS);
		for (const id of mappedMuscles()) {
			expect(known.has(id), `the map knows "${id}", which is not a known muscle`).toBe(true);
		}
	});

	it('only names regions the figures really have', () => {
		// A typo like `hamstrings` for `hamstring` would silently colour nothing, and
		// nothing is exactly what a working diagram also looks like from code.
		for (const { view, svg } of FIGURES) {
			const available = slugsIn(svg);
			for (const [muscle, region] of Object.entries(MUSCLE_REGIONS)) {
				for (const slug of region[view] ?? []) {
					expect(available.has(slug), `${view}.svg has no "${slug}" (for ${muscle})`).toBe(true);
				}
			}
		}
	});

	it('shows a muscle in the view it is actually visible from', () => {
		for (const m of ['chest', 'abdominals', 'biceps', 'quadriceps']) {
			expect(slugsFor([m], 'front').length, `${m} should be on the front`).toBeGreaterThan(0);
			expect(slugsFor([m], 'back'), `${m} should not be on the back`).toEqual([]);
		}
		for (const m of ['glutes', 'hamstrings', 'lats', 'lower back', 'middle back', 'abductors']) {
			expect(slugsFor([m], 'back').length, `${m} should be on the back`).toBeGreaterThan(0);
			expect(slugsFor([m], 'front'), `${m} should not be on the front`).toEqual([]);
		}
		for (const m of ['neck', 'shoulders', 'forearms', 'calves', 'traps', 'triceps']) {
			expect(slugsFor([m], 'front').length && slugsFor([m], 'back').length, m).toBeTruthy();
		}
	});

	it('records the three approximations rather than hiding them', () => {
		// 14 of 17 map exactly. The rest share a region or sit on a neighbour, and
		// that is written down so nobody later reads it as a bug.
		expect([...APPROXIMATED].sort()).toEqual(['abductors', 'lats', 'middle back']);
		// Every locale has to explain all three, because the compendium prints the
		// phrase and an English sentence in a Danish app is worse than none.
		for (const { id: locale } of LOCALES) {
			const approximated = messages(locale).muscles.approximated;
			expect(Object.keys(approximated).sort(), locale).toEqual([...APPROXIMATED].sort());
			for (const phrase of Object.values(approximated)) {
				expect(phrase.endsWith('.'), `${locale}: "${phrase}" ends a sentence it is inside`).toBe(
					false
				);
			}
		}
		expect(slugsFor(['lats'], 'back')).toEqual(slugsFor(['middle back'], 'back'));
		expect(slugsFor(['abductors'], 'back')).toEqual(slugsFor(['glutes'], 'back'));
	});

	it('deduplicates when two muscles share a region', () => {
		// A push-pull routine hitting both would otherwise emit the same selector
		// twice.
		expect(slugsFor(['lats', 'middle back'], 'back')).toEqual(['upper-back']);
	});

	it('keeps the figures small enough to inline', () => {
		// They are inlined into the bundle with ?raw so CSS can reach the muscles, so
		// the size is paid on every page that shows one.
		for (const { view, svg } of FIGURES) {
			expect(svg.length, `${view}.svg is ${Math.round(svg.length / 1024)} kB`).toBeLessThan(60_000);
		}
	});

	it('strips the baked-in colours so the stylesheet decides', () => {
		// Left in place, the inline fill attributes beat the stylesheet in some
		// engines and the highlight silently does nothing.
		for (const { view, svg } of FIGURES) {
			expect(svg, `${view}.svg still has a hard-coded fill`).not.toMatch(/fill="#/);
			expect(svg, `${view}.svg still has a hard-coded stroke`).not.toMatch(/stroke="#/);
		}
	});

	it('is not shown during a session', () => {
		// §4.6: anatomy is setup-time information. Mid-set the one available glance
		// belongs to the set numbers and the countdown (§12).
		const player = readFileSync(
			join(import.meta.dirname, '../src/routes/session/[sessionId]/+page.svelte'),
			'utf8'
		);
		expect(player).not.toContain('BodyMap');
	});
});

describe('the figures are credited (§4.6)', () => {
	it('records the body model with its authors and licence', () => {
		// MIT requires the copyright notice to travel with the work, and §4.1 keeps
		// that in attribution.json. The About page reads this.
		const figure = attributions.find((a) => a.source === 'body-highlighter');
		expect(figure, 'no attribution entry for the body figures').toBeDefined();
		expect(figure!.license).toBe('MIT');
		expect(figure!.author).toContain('ELABBASSI Hicham');
		expect(figure!.author).toContain('Stefan Poindl');
		expect(figure!.covers, 'the About page would print "0 exercises" for it').toBeTruthy();
	});

	it('no longer claims the Wikimedia figures it stopped shipping', () => {
		expect(attributions.find((a) => a.source === 'wikimedia')).toBeUndefined();
	});
});
