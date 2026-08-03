import { describe, expect, it } from 'vitest';
import {
	DEFAULT_HANDLE_SIDE,
	HANDLE_SIDES,
	resolveHandleSide
} from '../src/lib/handle-side.js';

/**
 * Which edge the drag handle sits on (docs/SPEC.md §12).
 *
 * Two-valued on purpose, and this test is where that is written down as an
 * assertion rather than a comment. The language and the equipment settings are
 * both three-valued because a phone can be asked what it is set to; nothing can
 * be asked which hand is holding it, so there is no device answer here for a
 * third state to defer to and `undefined` means only "never chosen".
 */
describe('resolveHandleSide', () => {
	it('defaults to the left, which is what was asked for', () => {
		expect(DEFAULT_HANDLE_SIDE).toBe('left');
		expect(resolveHandleSide(undefined)).toBe('left');
	});

	it('keeps a chosen side', () => {
		for (const side of HANDLE_SIDES) expect(resolveHandleSide(side)).toBe(side);
	});

	it('treats a value it does not recognise as never having chosen', () => {
		// A restored backup is the realistic source: it carries whatever was in
		// Settings on the device that wrote it, including a side written by a
		// future version, and a routine screen with no handle at all would be a
		// worse answer than the default one.
		for (const junk of ['', 'centre', 'LEFT', 'right-handed']) {
			expect(resolveHandleSide(junk)).toBe(DEFAULT_HANDLE_SIDE);
		}
	});

	it('offers exactly two sides, in reading order', () => {
		expect([...HANDLE_SIDES]).toEqual(['left', 'right']);
	});
});
