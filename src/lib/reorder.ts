/**
 * Dragging one item of a list into a new place
 * (docs/SPEC.md §12, "Ordering a routine by dragging").
 *
 * The arithmetic lives here rather than in the component, for the reason §15
 * gives for the other pure layers: "where does this land" is the part that can be
 * wrong, and it should be testable without a pointer or a DOM.
 *
 * The rule the whole file follows: **the list does not change while the finger is
 * down.** Only the dragged card moves, so every other item's measured position
 * stays true for the length of the gesture and there is nothing to re-measure.
 * The list is rewritten once, on release.
 */

/** The vertical extent of one card, in page coordinates. */
export interface Span {
	top: number;
	bottom: number;
}

export function centre(span: Span): number {
	return (span.top + span.bottom) / 2;
}

/**
 * The index the dragged item should occupy when released: how many of the *other*
 * items it has been carried past.
 *
 * Counting the items above it, rather than looking for a gap to fall into, is what
 * makes this work with cards of different heights — a routine card grows with its
 * notes and equipment chips, so there is no single row height to divide by.
 */
export function dropIndex(spans: Span[], from: number, draggedCentre: number): number {
	let to = 0;
	for (let i = 0; i < spans.length; i++) {
		if (i !== from && centre(spans[i]) < draggedCentre) to++;
	}
	return to;
}

/** A copy of `items` with the one at `from` moved to `to`. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
	if (from === to || from < 0 || from >= items.length) return [...items];
	const next = [...items];
	const [moved] = next.splice(from, 1);
	next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
	return next;
}

/**
 * Which way another card steps aside while one is being dragged over it: -1 up,
 * +1 down, 0 stay where it is.
 *
 * Every card that steps aside moves by exactly the *dragged* card's height, since
 * that is the size of the hole it left behind. So the gap always opens at the
 * position the card would land in, and a drop line becomes unnecessary — the space
 * is the cue, and unlike a line it cannot end up hidden under the card itself.
 */
export function displacement(from: number, to: number, index: number): -1 | 0 | 1 {
	if (index === from) return 0;
	if (to > from && index > from && index <= to) return -1;
	if (to < from && index >= to && index < from) return 1;
	return 0;
}
