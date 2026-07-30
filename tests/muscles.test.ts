import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalog } from '../src/lib/catalog/index.js';
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

describe('the body map draws what the glossary explains (§4.6)', () => {
	// A source-level check, because the shapes are literal SVG in a component that
	// vitest cannot render without a DOM. It still tests the invariant that
	// actually breaks: adding a muscle to the glossary and forgetting to draw it,
	// which would leave a compendium entry whose diagram highlights nothing.
	const source = readFileSync(
		join(import.meta.dirname, '../src/lib/components/BodyMap.svelte'),
		'utf8'
	);

	it('has a region for every muscle in the glossary', () => {
		for (const m of MUSCLES) {
			expect(source.includes(`tone('${m.id}')`), `BodyMap.svelte draws no ${m.id}`).toBe(true);
		}
	});

	it('draws both views, and labels every region for a long press', () => {
		expect(source).toContain("view === 'front'");
		for (const m of MUSCLES) {
			expect(source.includes(`title('${m.id}')`), `${m.id} has no <title>`).toBe(true);
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
