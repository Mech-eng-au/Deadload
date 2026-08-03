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

// ---------------------------------------------------------------------------
// Across sections (§12, amended 2026-08-03)
//
// The 2026-07-30 drag reordered within one section, exactly as far as the two
// arrow buttons it replaced could reach. Moving an exercise from Warm-up into
// Main still meant deleting it and adding it again in the editor.
//
// Everything above still applies — measure once, page coordinates, only the
// dragged card follows the finger — and the extension is one idea: a section
// has a **top**, so the question "which section is the card over?" is answered
// the same way as "which card is it past?", by counting what it has been
// carried beyond.

/** Where an item is: which section, and where in that section. */
export interface Slot {
	section: number;
	index: number;
}

/** One section's own box, plus the cards inside it. */
export interface SectionSpans {
	/** The top of the section's own element, in page coordinates. */
	top: number;
	spans: Span[];
}

export function sameSlot(a: Slot, b: Slot): boolean {
	return a.section === b.section && a.index === b.index;
}

/**
 * Where the dragged card lands: which section it has been carried into, and
 * how many of that section's cards it has been carried past.
 *
 * **The section is decided by its top, not by whether the card is inside its
 * box.** Sections are separated by their own chrome — a heading, and in the
 * editor a label field and an Add button — so a card dragged into that gap is
 * inside no section at all, and "nearest" would flip back and forth across the
 * midpoint. "The last section I have been carried past the top of" is monotonic:
 * dragging steadily downwards moves the target forwards and never back.
 *
 * An **empty section still has a top**, so it can be dragged into. That is new
 * capability rather than a side effect: before this, a section with nothing in
 * it could only be filled from the picker.
 */
export function dropTarget(
	sections: SectionSpans[],
	from: Slot,
	draggedCentre: number
): Slot {
	if (sections.length === 0) return from;

	let section = 0;
	for (let i = 0; i < sections.length; i++) {
		if (sections[i].top <= draggedCentre) section = i;
	}

	let index = 0;
	for (let i = 0; i < sections[section].spans.length; i++) {
		if (section === from.section && i === from.index) continue;
		if (centre(sections[section].spans[i]) < draggedCentre) index++;
	}
	return { section, index };
}

/**
 * Which way a card steps aside while another is dragged over it.
 *
 * Within one section this is `displacement` above, unchanged, so the gesture
 * that already worked still behaves exactly as it did.
 *
 * Across sections **only the destination opens a gap**, and the source is left
 * alone until the drop. Closing the hole in the source at the same time was the
 * obvious symmetric thing and it looks wrong: in the editor each section is a
 * bordered card, so cards sliding up inside the section they are leaving cross
 * that border and end up overlapping the chrome beneath them. The gap that
 * matters is the one you are aiming at.
 */
export function displacementAcross(from: Slot, to: Slot, at: Slot): -1 | 0 | 1 {
	if (sameSlot(at, from)) return 0;
	if (from.section === to.section) {
		return at.section === from.section ? displacement(from.index, to.index, at.index) : 0;
	}
	if (at.section === to.section && at.index >= to.index) return 1;
	return 0;
}

/** Move an item from one section to another, returning both lists. */
export function moveAcross<T>(sections: T[][], from: Slot, to: Slot): T[][] {
	if (sameSlot(from, to)) return sections.map((s) => [...s]);
	if (from.section === to.section) {
		return sections.map((s, i) => (i === from.section ? moveItem(s, from.index, to.index) : [...s]));
	}
	const next = sections.map((s) => [...s]);
	const [moved] = next[from.section].splice(from.index, 1);
	if (moved === undefined) return sections.map((s) => [...s]);
	next[to.section].splice(Math.max(0, Math.min(to.index, next[to.section].length)), 0, moved);
	return next;
}

/**
 * The slot an arrow key moves to, which is the only way to reorder without a
 * pointer. Past the end of a section it steps into the next one rather than
 * stopping, so the keyboard can reach everywhere the finger can.
 */
export function stepSlot(sizes: number[], at: Slot, by: -1 | 1): Slot | undefined {
	const next = at.index + by;
	if (next >= 0 && next <= sizes[at.section] - 1) return { section: at.section, index: next };
	if (by === 1) {
		// Off the bottom: the top of the next section that exists.
		if (at.section + 1 >= sizes.length) return undefined;
		return { section: at.section + 1, index: 0 };
	}
	if (at.section === 0) return undefined;
	return { section: at.section - 1, index: sizes[at.section - 1] };
}
