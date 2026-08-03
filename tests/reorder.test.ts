import { describe, expect, it } from 'vitest';
import {
	centre,
	displacement,
	displacementAcross,
	dropIndex,
	dropTarget,
	moveAcross,
	moveItem,
	stepSlot,
	type SectionSpans,
	type Span
} from '../src/lib/reorder.js';

/** Three cards of different heights, stacked — the shape a routine actually has. */
const SPANS = [
	{ top: 0, bottom: 100 }, // centre 50
	{ top: 100, bottom: 180 }, // centre 140
	{ top: 180, bottom: 340 } // centre 260
];

describe('where a dragged card lands', () => {
	it('stays put while it has not passed anything', () => {
		expect(dropIndex(SPANS, 0, 50)).toBe(0);
		expect(dropIndex(SPANS, 0, 139)).toBe(0);
		expect(dropIndex(SPANS, 1, 140)).toBe(1);
		expect(dropIndex(SPANS, 2, 260)).toBe(2);
	});

	it('counts the cards it has been carried past, downwards', () => {
		expect(dropIndex(SPANS, 0, 141)).toBe(1);
		expect(dropIndex(SPANS, 0, 300)).toBe(2);
		expect(dropIndex(SPANS, 1, 261)).toBe(2);
	});

	it('counts them upwards too', () => {
		expect(dropIndex(SPANS, 2, 139)).toBe(1);
		expect(dropIndex(SPANS, 2, 49)).toBe(0);
		expect(dropIndex(SPANS, 1, 10)).toBe(0);
	});

	it('does not run off either end, however far the finger goes', () => {
		expect(dropIndex(SPANS, 0, -5000)).toBe(0);
		expect(dropIndex(SPANS, 0, 5000)).toBe(2);
		expect(dropIndex(SPANS, 2, -5000)).toBe(0);
	});

	it('uses the middle of a card, not its top', () => {
		// A tall card has to be dragged further to displace a short one, which is
		// what makes the gesture feel like it is about where the card *is*.
		expect(centre(SPANS[2])).toBe(260);
		// The swap happens as the dragged centre crosses the other card's centre,
		// not its edge: 141 is still below item 1's middle, 139 is above it.
		expect(dropIndex(SPANS, 2, 141)).toBe(2);
		expect(dropIndex(SPANS, 2, 139)).toBe(1);
	});

	it('is indifferent to a one-item list', () => {
		expect(dropIndex([{ top: 0, bottom: 50 }], 0, 999)).toBe(0);
	});
});

describe('moving the item', () => {
	const items = ['a', 'b', 'c', 'd'];

	it('moves down and up', () => {
		expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
		expect(moveItem(items, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
		expect(moveItem(items, 1, 2)).toEqual(['a', 'c', 'b', 'd']);
	});

	it('returns a copy and leaves the original alone', () => {
		const out = moveItem(items, 0, 3);
		expect(out).not.toBe(items);
		expect(items).toEqual(['a', 'b', 'c', 'd']);
	});

	it('is a no-op when nothing moved, or when the index is nonsense', () => {
		expect(moveItem(items, 2, 2)).toEqual(items);
		expect(moveItem(items, 9, 0)).toEqual(items);
		expect(moveItem(items, -1, 0)).toEqual(items);
	});

	it('clamps a target past the end rather than dropping the item', () => {
		expect(moveItem(items, 0, 99)).toEqual(['b', 'c', 'd', 'a']);
	});

	it('round-trips: dropIndex then moveItem puts it where the finger was', () => {
		const to = dropIndex(SPANS, 0, 300); // dragged the first card to the bottom
		expect(moveItem(['a', 'b', 'c'], 0, to)).toEqual(['b', 'c', 'a']);
	});
});

describe('the cards that step aside', () => {
	/** The whole row of five, as offsets, for one drag. */
	const row = (from: number, to: number) =>
		[0, 1, 2, 3, 4].map((i) => displacement(from, to, i));

	it('leaves everything alone while nothing has moved', () => {
		expect(row(2, 2)).toEqual([0, 0, 0, 0, 0]);
	});

	it('lifts the cards the dragged one has passed, going down', () => {
		expect(row(0, 2)).toEqual([0, -1, -1, 0, 0]);
		expect(row(1, 4)).toEqual([0, 0, -1, -1, -1]);
	});

	it('drops the cards it has passed, going up', () => {
		expect(row(4, 2)).toEqual([0, 0, 1, 1, 0]);
		expect(row(3, 0)).toEqual([1, 1, 1, 0, 0]);
	});

	it('never displaces the dragged card itself', () => {
		expect(displacement(2, 0, 2)).toBe(0);
		expect(displacement(2, 4, 2)).toBe(0);
	});

	it('leaves exactly one gap: as many cards step aside as places were crossed', () => {
		for (const [from, to] of [
			[0, 4],
			[4, 0],
			[1, 3],
			[3, 1],
			[2, 2]
		]) {
			expect(row(from, to).filter((d) => d !== 0)).toHaveLength(Math.abs(to - from));
		}
	});
});

// ---------------------------------------------------------------------------

describe('dragging between sections (§12, added 2026-08-03)', () => {
	/** Three sections stacked down the page, cards 20 tall with 10 of chrome between. */
	function layout(counts: number[]): SectionSpans[] {
		let y = 0;
		return counts.map((n) => {
			const top = y;
			y += 10; // the heading, or the editor's label row
			const spans: Span[] = [];
			for (let i = 0; i < n; i++) {
				spans.push({ top: y, bottom: y + 20 });
				y += 20;
			}
			y += 10; // the Add button, or the gap to the next section
			return { top, spans };
		});
	}

	const three = layout([2, 2, 2]);

	it('keeps a card in its own section while it stays there', () => {
		// Section 0's cards sit at 10-30 and 30-50, so their centres are 20 and 40.
		expect(dropTarget(three, { section: 0, index: 0 }, 45)).toEqual({ section: 0, index: 1 });
		expect(dropTarget(three, { section: 0, index: 1 }, 15)).toEqual({ section: 0, index: 0 });
	});

	it('lands in the section whose top it has been carried past', () => {
		// Section 1 starts at 60; anything below that belongs to it.
		const to = dropTarget(three, { section: 0, index: 0 }, 75);
		expect(to.section).toBe(1);
	});

	it('never goes backwards as the finger goes forwards', () => {
		// The property that makes this predictable to a hand rather than to a test:
		// drag steadily down and the target only ever advances.
		let last = { section: -1, index: -1 };
		for (let y = 0; y < 200; y += 3) {
			const to = dropTarget(three, { section: 0, index: 0 }, y);
			const forwards =
				to.section > last.section || (to.section === last.section && to.index >= last.index);
			expect(forwards, `went backwards at y=${y}`).toBe(true);
			last = to;
		}
	});

	it('can be dropped into a section with nothing in it', () => {
		// The capability this adds beyond convenience: an empty section could only
		// be filled from the picker before, because it had no cards to drop between.
		const withEmpty = layout([2, 0, 1]);
		const to = dropTarget(withEmpty, { section: 0, index: 0 }, withEmpty[1].top + 1);
		expect(to).toEqual({ section: 1, index: 0 });
	});

	it('does not count the dragged card against itself', () => {
		// Its own centre is above the pointer for the whole first half of a
		// downward drag, so counting it would put the card one place too far.
		const to = dropTarget(three, { section: 0, index: 0 }, 25);
		expect(to).toEqual({ section: 0, index: 0 });
	});

	it('clamps above the first section rather than falling off the top', () => {
		expect(dropTarget(three, { section: 2, index: 0 }, -500)).toEqual({ section: 0, index: 0 });
	});

	describe('what steps aside', () => {
		it('behaves exactly as it did inside one section', () => {
			for (let i = 0; i < 4; i++) {
				const across = displacementAcross(
					{ section: 0, index: 0 },
					{ section: 0, index: 2 },
					{ section: 0, index: i }
				);
				expect(across, `index ${i}`).toBe(displacement(0, 2, i));
			}
		});

		it('opens a gap in the destination and leaves the source alone', () => {
			const from = { section: 0, index: 0 };
			const to = { section: 1, index: 1 };
			// The destination opens up at and below the landing place.
			expect(displacementAcross(from, to, { section: 1, index: 0 })).toBe(0);
			expect(displacementAcross(from, to, { section: 1, index: 1 })).toBe(1);
			expect(displacementAcross(from, to, { section: 1, index: 2 })).toBe(1);
			// The section being left does not close up until the drop — see the note
			// in reorder.ts, this is deliberate and not an oversight.
			expect(displacementAcross(from, to, { section: 0, index: 1 })).toBe(0);
			// And a section nobody is touching never moves.
			expect(displacementAcross(from, to, { section: 2, index: 0 })).toBe(0);
		});

		it('never moves the card under the finger', () => {
			expect(
				displacementAcross({ section: 0, index: 1 }, { section: 1, index: 0 }, { section: 0, index: 1 })
			).toBe(0);
		});
	});

	describe('rewriting the lists', () => {
		const sections = () => [['a', 'b'], ['c', 'd'], ['e']];

		it('moves an item into another section at the right place', () => {
			expect(moveAcross(sections(), { section: 0, index: 0 }, { section: 1, index: 1 })).toEqual([
				['b'],
				['c', 'a', 'd'],
				['e']
			]);
		});

		it('appends past the end of the destination', () => {
			expect(moveAcross(sections(), { section: 0, index: 1 }, { section: 2, index: 9 })).toEqual([
				['a'],
				['c', 'd'],
				['e', 'b']
			]);
		});

		it('empties a section without losing the item', () => {
			expect(moveAcross(sections(), { section: 2, index: 0 }, { section: 0, index: 0 })).toEqual([
				['e', 'a', 'b'],
				['c', 'd'],
				[]
			]);
		});

		it('is the single-section move when both ends agree', () => {
			expect(moveAcross(sections(), { section: 0, index: 0 }, { section: 0, index: 1 })).toEqual([
				['b', 'a'],
				['c', 'd'],
				['e']
			]);
		});

		it('copies rather than mutating, so a cancelled drag changes nothing', () => {
			const before = sections();
			const after = moveAcross(before, { section: 0, index: 0 }, { section: 0, index: 0 });
			after[0].push('x');
			expect(before[0]).toEqual(['a', 'b']);
		});
	});

	describe('the keyboard reaches everywhere the finger does', () => {
		const sizes = [2, 2, 1];

		it('steps within a section', () => {
			expect(stepSlot(sizes, { section: 0, index: 0 }, 1)).toEqual({ section: 0, index: 1 });
		});

		it('steps off the bottom into the top of the next section', () => {
			expect(stepSlot(sizes, { section: 0, index: 1 }, 1)).toEqual({ section: 1, index: 0 });
		});

		it('steps off the top onto the end of the previous section', () => {
			// The end, not the last card: arriving from below means landing after
			// everything already there, which is where the finger would have put it.
			expect(stepSlot(sizes, { section: 1, index: 0 }, -1)).toEqual({ section: 0, index: 2 });
		});

		it('stops at both ends of the routine', () => {
			expect(stepSlot(sizes, { section: 0, index: 0 }, -1)).toBeUndefined();
			expect(stepSlot(sizes, { section: 2, index: 0 }, 1)).toBeUndefined();
		});

		it('steps through an empty section rather than into a dead end', () => {
			expect(stepSlot([1, 0, 1], { section: 0, index: 0 }, 1)).toEqual({ section: 1, index: 0 });
			expect(stepSlot([1, 0, 1], { section: 1, index: 0 }, 1)).toEqual({ section: 2, index: 0 });
		});
	});
});
