import { describe, expect, it } from 'vitest';
import { catalog, getExercise } from '../src/lib/catalog/index.js';
import {
	DEFAULT_OWNED,
	EQUIPMENT,
	GATED_EQUIPMENT,
	availableCatalog,
	countByEquipment,
	equipmentLabel,
	exerciseCountLabel,
	isAvailable,
	isGated,
	missingEquipment,
	owns,
	ownedEquipment
} from '../src/lib/catalog/equipment.js';
import { buildLlmCatalog, buildPrompt, equipmentSentence } from '../src/lib/import/prompt.js';
import { ladders } from '../src/lib/catalog/ladders.js';
import type { EquipmentId, Settings } from '../src/lib/types.js';
import { en } from '../src/lib/i18n/en/index.js';

const ALL: EquipmentId[] = EQUIPMENT.map((t) => t.id);

function settings(ownedEquipment?: EquipmentId[]): Settings {
	return {
		persistRequested: true,
		persistGranted: true,
		createdAt: '2026-07-30T06:00:00.000Z',
		...(ownedEquipment === undefined ? {} : { ownedEquipment })
	};
}

/**
 * The equipment tags in catalog.json are generated, but the lists that produce
 * them (scripts/curation.yaml) are hand-authored, so they can drift away from a
 * regenerated catalog exactly as the ladders can. Same rules as
 * tests/ladders.test.ts, applied to the tagging.
 */
describe('equipment tags (§5.1)', () => {
	it('tags every exercise with known equipment ids only', () => {
		for (const e of catalog) {
			for (const id of e.equipment) {
				expect(ALL, `${e.id} is tagged "${id}"`).toContain(id);
			}
		}
	});

	it('never tags the same equipment twice on one exercise', () => {
		for (const e of catalog) {
			expect(new Set(e.equipment).size, `${e.id} repeats an equipment tag`).toBe(e.equipment.length);
		}
	});

	it('gives every gated type at least one exercise', () => {
		// A gated type with nothing behind it is a checkbox that does nothing.
		for (const type of GATED_EQUIPMENT) {
			expect(countByEquipment[type.id], `${type.id} has no exercises`).toBeGreaterThan(0);
		}
	});

	it('keeps the curation narrow, per type', () => {
		// The budgets in curation.yaml, restated here so a regenerated catalog that
		// blew one cannot slip through with only the build script having complained.
		expect(countByEquipment.jumping_rope).toBe(1);
		expect(countByEquipment.pull_up_bar).toBeLessThanOrEqual(10);
		expect(countByEquipment.dumbbells).toBeLessThanOrEqual(16);
		expect(countByEquipment.kettlebell).toBeLessThanOrEqual(12);
		expect(countByEquipment.resistance_band).toBeLessThanOrEqual(12);
		expect(countByEquipment.foam_roller).toBeLessThanOrEqual(10);
	});

	it('keeps roughly 120 exercises reachable with nothing owned', () => {
		// The number §5's cap is actually about: what one user sees having ticked no
		// boxes. The whole catalog is larger and that is fine — a dumbbell entry
		// cannot make a browse screen a chore for somebody who cannot see it.
		const reachable = availableCatalog([]).length;
		expect(reachable).toBeGreaterThan(90);
		expect(reachable).toBeLessThanOrEqual(125);
		expect(catalog.length).toBeGreaterThan(reachable);
	});

	it('still ships the eight pull-up-bar exercises the catalog was built with', () => {
		// These predate the gate. If a curation edit drops one, a preset and a
		// progression ladder break, which is why pull_up_bar starts ticked.
		const expected = [
			'bodyweight_mid_row',
			'chin_up',
			'gorilla_chin_crunch',
			'hanging_leg_raise',
			'hanging_pike',
			'inverted_row',
			'pullups',
			'scapular_pull_up'
		];
		for (const id of expected) {
			expect(getExercise(id)?.equipment, `${id}`).toContain('pull_up_bar');
		}
		expect(countByEquipment.pull_up_bar).toBe(expected.length);
	});

	it('leaves every ladder rung reachable with the default equipment', () => {
		// A ladder the user cannot climb is worse than no ladder: the player offers
		// "harder" and the exercise behind it would be one they cannot do.
		for (const chain of ladders) {
			for (const id of chain) {
				const e = getExercise(id)!;
				expect(isAvailable(e, DEFAULT_OWNED), `${id} is not available by default`).toBe(true);
			}
		}
	});

	it('treats a chair as furniture rather than a purchase', () => {
		expect(isGated('chair')).toBe(false);
		expect(GATED_EQUIPMENT.map((t) => t.id)).not.toContain('chair');
		// So a chair exercise is offered to somebody who owns nothing.
		const chairExercise = catalog.find((e) => e.equipment.includes('chair'))!;
		expect(chairExercise).toBeDefined();
		expect(isAvailable(chairExercise, [])).toBe(true);
		expect(missingEquipment(chairExercise, [])).toEqual([]);
	});
});

describe('ownedEquipment: undefined is not the same as empty (§5.1)', () => {
	it('treats undefined as never answered, and assumes a pull-up bar', () => {
		expect(ownedEquipment(settings())).toEqual(['pull_up_bar']);
		expect(ownedEquipment(null)).toEqual(['pull_up_bar']);
		expect(ownedEquipment(undefined)).toEqual(['pull_up_bar']);
	});

	it('treats an empty array as answered, and owning nothing', () => {
		expect(ownedEquipment(settings([]))).toEqual([]);
	});

	it('does not hand pull-ups back to somebody who unticked every box', () => {
		// The regression this test exists for: an `ownedEquipment ?? DEFAULT` written
		// anywhere in the app makes `[]` indistinguishable from "never asked", so the
		// next launch silently re-ticks the bar.
		const nothing = ownedEquipment(settings([]));
		const pullups = getExercise('pullups')!;
		expect(isAvailable(pullups, nothing)).toBe(false);
		expect(missingEquipment(pullups, nothing)).toEqual(['pull_up_bar']);

		const neverAsked = ownedEquipment(settings());
		expect(isAvailable(pullups, neverAsked)).toBe(true);
	});

	it('does not let the returned default be mutated into the shared one', () => {
		const first = ownedEquipment(settings());
		first.push('kettlebell');
		expect(ownedEquipment(settings())).toEqual(['pull_up_bar']);
		expect(DEFAULT_OWNED).toEqual(['pull_up_bar']);
	});
});

describe('what a gate hides (§5.1)', () => {
	const nothing: EquipmentId[] = [];

	it('hides an exercise whose equipment is not owned', () => {
		const kb = catalog.find((e) => e.equipment.includes('kettlebell'))!;
		expect(isAvailable(kb, nothing)).toBe(false);
		expect(isAvailable(kb, ['kettlebell'])).toBe(true);
	});

	it('gates each type independently', () => {
		// The failure a single "I have equipment" switch would cause: a bar owner
		// being offered kettlebell work.
		const owned: EquipmentId[] = ['pull_up_bar'];
		const kb = catalog.find((e) => e.equipment.includes('kettlebell'))!;
		const bar = catalog.find((e) => e.equipment.includes('pull_up_bar'))!;
		expect(isAvailable(bar, owned)).toBe(true);
		expect(isAvailable(kb, owned)).toBe(false);
	});

	it('needs every piece of equipment an exercise lists, not just one', () => {
		// The reason `equipment` is an array: a band-assisted pull-up needs both.
		const both = { ...catalog[0], equipment: ['pull_up_bar', 'resistance_band'] as EquipmentId[] };
		expect(isAvailable(both, ['pull_up_bar'])).toBe(false);
		expect(isAvailable(both, ['resistance_band'])).toBe(false);
		expect(isAvailable(both, ['pull_up_bar', 'resistance_band'])).toBe(true);
		expect(missingEquipment(both, ['pull_up_bar'])).toEqual(['resistance_band']);
	});

	it('never hides an exercise that needs nothing', () => {
		for (const e of catalog.filter((x) => x.equipment.length === 0)) {
			expect(isAvailable(e, nothing), `${e.id}`).toBe(true);
		}
	});

	it('shrinks and grows the offered catalog with the boxes ticked', () => {
		const none = availableCatalog(nothing).length;
		const all = availableCatalog(ALL).length;
		expect(all).toBe(catalog.length);
		expect(none).toBeLessThan(all);
		expect(availableCatalog(['kettlebell']).length).toBe(none + countByEquipment.kettlebell);
	});

	it('owns() is true for ungated equipment whatever is ticked', () => {
		expect(owns([], 'chair')).toBe(true);
		expect(owns([], 'kettlebell')).toBe(false);
		expect(owns(['kettlebell'], 'kettlebell')).toBe(true);
	});
});

describe('labels', () => {
	it('labels every type', () => {
		for (const id of ALL) expect(equipmentLabel(id, en)).not.toBe(id);
	});

	it('says "1 exercise" rather than hiding a count of one', () => {
		// jumping_rope really is one exercise in this source, and the row says so.
		expect(exerciseCountLabel('jumping_rope', en)).toBe('1 exercise');
		expect(exerciseCountLabel('dumbbells', en)).toMatch(/^\d+ exercises$/);
	});
});

describe('the LLM catalog file and prompt (§14)', () => {
	it('only offers the model exercises the user owns', () => {
		const entries = buildLlmCatalog(['jumping_rope']);
		const ids = entries.map((e) => e.id);
		expect(ids).toContain('rope_jumping');
		expect(ids).not.toContain('goblet_squat');
		expect(entries.length).toBe(availableCatalog(['jumping_rope']).length);
	});

	it('puts the equipment on every entry', () => {
		const rope = buildLlmCatalog(['jumping_rope']).find((e) => e.id === 'rope_jumping')!;
		expect(rope.equipment).toEqual(['jumping_rope']);
		expect(Object.keys(rope).sort()).toEqual(['category', 'equipment', 'id', 'name']);
	});

	it('writes the equipment line rather than leaving a blank to fill in', () => {
		expect(equipmentSentence(['dumbbells', 'jumping_rope'], en)).toBe('jumping rope, dumbbells');
		expect(buildPrompt(['dumbbells'], en, 'English')).toContain('Equipment available: dumbbells');
	});

	it('says none, out loud, when nothing is owned', () => {
		expect(equipmentSentence([], en)).toBe('none — floor, wall and chair only');
		expect(buildPrompt([], en, 'English')).toContain('Equipment available: none — floor, wall and chair only');
	});

	it('does not mention a chair as equipment the model can choose', () => {
		// It is not a gate, so it is not a thing to declare owning.
		expect(equipmentSentence(['chair'], en)).toBe('none — floor, wall and chair only');
	});
});
