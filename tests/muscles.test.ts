import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { attributions, catalog } from '../src/lib/catalog/index.js';
import {
	BACK,
	FIGURE_HEIGHT,
	FIGURE_WIDTH,
	FRONT,
	mappedMuscles
} from '../src/lib/catalog/body-map.js';
import {
	MUSCLES,
	muscleInfo,
	muscleLabel,
	muscleUsage,
	muscleWithHint,
	musclesInCatalog
} from '../src/lib/catalog/muscles.js';

/**
 * The glossary is hand-authored (src/lib/catalog/muscles.ts) and the catalog is
 * generated, so the two can drift apart exactly as the ladders can. Same
 * referential-integrity rules as tests/ladders.test.ts.
 */
describe('muscle glossary (§4.6)', () => {
	it('explains every muscle the catalog names', () => {
		// The failure this exists for: a regenerated catalog introducing a muscle
		// name nobody has written a translation for, which would print the raw word
		// at the user again.
		for (const id of musclesInCatalog()) {
			expect(muscleInfo(id), `no glossary entry for "${id}"`).toBeDefined();
		}
	});

	it('has no entries the catalog never uses', () => {
		// Dead entries are how a glossary starts lying: it would claim the app knows
		// about a muscle nothing trains.
		const used = new Set(musclesInCatalog());
		for (const m of MUSCLES) {
			expect(used.has(m.id), `"${m.id}" is in the glossary but not in the catalog`).toBe(true);
		}
	});

	it('covers the seventeen names this source uses, and no more', () => {
		expect(MUSCLES).toHaveLength(17);
		expect(musclesInCatalog()).toHaveLength(17);
	});

	it('never repeats an id', () => {
		expect(new Set(MUSCLES.map((m) => m.id)).size).toBe(MUSCLES.length);
	});

	it('says something real in every field', () => {
		for (const m of MUSCLES) {
			expect(m.label.length, m.id).toBeGreaterThan(2);
			// `short` goes in brackets after a name, so it has to stay short.
			expect(m.short.length, `${m.id} short is too long for a bracket`).toBeLessThanOrEqual(24);
			expect(m.short, `${m.id} short just repeats the jargon`).not.toBe(m.id);
			// `where` and `does` are sentences a person could act on.
			expect(m.where.endsWith('.'), `${m.id} where is not a sentence`).toBe(true);
			expect(m.does.endsWith('.'), `${m.id} does is not a sentence`).toBe(true);
			expect(m.where.length, m.id).toBeGreaterThan(20);
			expect(m.does.length, m.id).toBeGreaterThan(20);
		}
	});

	it('formats a name with its hint', () => {
		expect(muscleWithHint('quadriceps')).toBe('quadriceps (front of thigh)');
		expect(muscleWithHint('adductors')).toBe('adductors (inner thigh)');
		expect(muscleLabel('lower back')).toBe('Lower back');
	});

	it('falls back to the raw id rather than throwing on an unknown muscle', () => {
		expect(muscleLabel('spleen')).toBe('spleen');
		expect(muscleWithHint('spleen')).toBe('spleen');
		expect(muscleInfo('spleen')).toBeUndefined();
	});

	it('counts the catalog per muscle, most-trained first', () => {
		const quads = muscleUsage.find((r) => r.muscle.id === 'quadriceps')!;
		expect(quads.primary).toBe(
			catalog.filter((e) => e.primaryMuscles.includes('quadriceps')).length
		);
		expect(quads.secondary).toBe(
			catalog.filter((e) => e.secondaryMuscles.includes('quadriceps')).length
		);
		expect(muscleUsage).toHaveLength(17);
		for (let i = 1; i < muscleUsage.length; i++) {
			expect(muscleUsage[i - 1].primary).toBeGreaterThanOrEqual(muscleUsage[i].primary);
		}
	});
});

describe('the body map points at what the glossary explains (§4.6)', () => {
	it('has a region for every muscle in the glossary', () => {
		// The failure this exists for: adding a muscle to the glossary and forgetting
		// to place it, which leaves a compendium entry whose diagram lights nothing.
		for (const m of MUSCLES) {
			expect(mappedMuscles(), `nothing on the figures for ${m.id}`).toContain(m.id);
		}
	});

	it('points at nothing the glossary does not explain', () => {
		const known = new Set(MUSCLES.map((m) => m.id));
		for (const id of mappedMuscles()) {
			expect(known.has(id), `the figures highlight "${id}", which is not a known muscle`).toBe(true);
		}
	});

	it('keeps every region inside the figure', () => {
		for (const [view, regions] of [
			['front', FRONT],
			['back', BACK]
		] as const) {
			for (const r of regions) {
				expect(r.cx - r.rx, `${view} ${r.m} runs off the left`).toBeGreaterThanOrEqual(0);
				expect(r.cx + r.rx, `${view} ${r.m} runs off the right`).toBeLessThanOrEqual(FIGURE_WIDTH);
				expect(r.cy - r.ry, `${view} ${r.m} runs off the top`).toBeGreaterThanOrEqual(0);
				expect(r.cy + r.ry, `${view} ${r.m} runs off the bottom`).toBeLessThanOrEqual(FIGURE_HEIGHT);
			}
		}
	});

	it('shows a muscle in the view it is actually visible from', () => {
		// Chest and quads are not on the back; glutes and hamstrings are not on the
		// front. Getting this wrong would highlight a shape over the wrong anatomy.
		const front = new Set(FRONT.map((r) => r.m));
		const back = new Set(BACK.map((r) => r.m));
		for (const m of ['chest', 'abdominals', 'biceps', 'quadriceps', 'adductors']) {
			expect(front.has(m), `${m} should be on the front`).toBe(true);
			expect(back.has(m), `${m} should not be on the back`).toBe(false);
		}
		for (const m of ['glutes', 'hamstrings', 'lats', 'triceps', 'lower back', 'middle back']) {
			expect(back.has(m), `${m} should be on the back`).toBe(true);
			expect(front.has(m), `${m} should not be on the front`).toBe(false);
		}
		// Visible from either side.
		for (const m of ['neck', 'shoulders', 'forearms', 'calves', 'traps', 'abductors']) {
			expect(front.has(m) && back.has(m), `${m} should be on both views`).toBe(true);
		}
	});

	it('keeps the two adductor shapes apart, and off the crotch', () => {
		// The regression this is named for: the pair were once one bright bar
		// straddling the centreline with its top at the pelvis, and it looked like a
		// penis. Two shapes, a real gap between them, and nothing reaching the hip.
		const add = FRONT.filter((r) => r.m === 'adductors');
		expect(add).toHaveLength(2);
		const [left, right] = [...add].sort((a, b) => a.cx - b.cx);
		const gap = right.cx - right.rx - (left.cx + left.rx);
		expect(gap, 'the adductor shapes have merged into one bar').toBeGreaterThanOrEqual(8);
		expect(left.cy - left.ry, 'the adductor highlight reaches the pelvis').toBeGreaterThan(190);
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
	it('records the Wikimedia figures with author and licence', () => {
		// CC BY-SA 3.0 obliges attribution wherever the work appears, and §4.1 keeps
		// that in attribution.json. The About page reads this.
		const figure = attributions.find((a) => a.source === 'wikimedia');
		expect(figure, 'no attribution entry for the body figures').toBeDefined();
		expect(figure!.license).toBe('CC-BY-SA-3.0');
		expect(figure!.author).toBe('Termininja');
		expect(figure!.sourceUrl).toContain('commons.wikimedia.org');
		expect(figure!.covers, 'the About page would print "0 exercises" for it').toBeTruthy();
	});
});
