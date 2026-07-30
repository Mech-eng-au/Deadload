import { describe, expect, it } from 'vitest';
import { centre, displacement, dropIndex, moveItem } from '../src/lib/reorder.js';

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
