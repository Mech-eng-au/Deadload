import { equipmentLabel } from '../catalog/equipment.js';
import { countItems, describeItem } from '../db/routines.js';
import { estimateSeconds, totalSets } from '../session/steps.js';
import { A4, PdfDoc, textWidth, wrapText, type JpegImage, type PageSize } from './writer.js';
import type { EquipmentId, Exercise, Routine, RoutineItem } from '../types.js';

/**
 * A routine on paper (docs/SPEC.md §8, "A routine on paper").
 *
 * The sheet is a **log**, not a printout of a screen: every set gets a box with
 * its target printed pale inside it, and the box is there to write the number in.
 * That is the only reason to want a routine on paper — a phone that has to stay
 * in a pocket, somebody else following your routine, a week away from the app.
 *
 * **It is laid out in columns**, two on portrait paper and three on landscape.
 * One exercise takes a fifth of the width of an A4 line and a full-width row left
 * most of the page empty, which is what a routine printed in a single column
 * actually looks like. Columns also mean a twelve-exercise routine fits on one
 * side with its photographs, and that is the difference between a sheet you fold
 * into a pocket and a stapled document.
 *
 * **Photographs are on by default.** Somebody following the paper instead of the
 * app needs to see the movement, and a name is not a movement. They are scaled to
 * the size they print at before being embedded (see ./images.ts), which is what
 * keeps a twelve-exercise sheet under 100 kB rather than near a megabyte.
 *
 * Pure per §15: it takes the routine, the exercises it names and the already
 * encoded photographs, and returns bytes. `describeItem` is borrowed from the
 * routine module on purpose, so the paper cannot start describing a set
 * differently from the screen.
 */

const MARGIN = 40;
const GUTTER = 20;

/** A4 turned on its side. */
const A4_LANDSCAPE: PageSize = { width: A4.height, height: A4.width };

export type Orientation = 'portrait' | 'landscape';

export interface SheetOptions {
	/** Stamped in the footer, so a sheet found later says when it was printed. */
	printedAt?: Date;
	/** Portrait is two columns, landscape is three. */
	orientation?: Orientation;
	/**
	 * One JPEG per exercise id, from `loadThumbnails`. Absent, or missing an id,
	 * simply prints that exercise without a picture.
	 */
	images?: Map<string, JpegImage>;
}

/** Printed size of a photograph. Small, but a movement still reads at this size. */
const PHOTO_W = 52;
const PHOTO_H = 39;
/** Where a cell's words start, clear of the photograph. */
const TEXT_X = PHOTO_W + 8;

const NAME_SIZE = 9.5;
const DETAIL_SIZE = 8;
const NOTE_SIZE = 7.5;
const BOX_H = 15;

/** What the sheet says a set is, inside the box it is written in. */
function setLabel(item: RoutineItem): string {
	switch (item.target.kind) {
		case 'duration':
			return `${item.target.seconds} s`;
		case 'amrap':
			return 'max';
		case 'reps_range':
			return `${item.target.min}–${item.target.max}`;
		case 'reps':
			return `${item.target.reps}`;
	}
}

/** Every gated thing the routine needs, named once, in table order. */
export function equipmentNeeded(routine: Routine, exercises: Map<string, Exercise>): EquipmentId[] {
	const seen: EquipmentId[] = [];
	for (const block of routine.blocks) {
		for (const item of block.items) {
			for (const id of exercises.get(item.exerciseId)?.equipment ?? []) {
				if (!seen.includes(id)) seen.push(id);
			}
		}
	}
	return seen;
}

/**
 * Letters that are not an accented anything, so stripping combining marks leaves
 * a hyphen where a letter was. The user writes Danish; "Ryg og lænd" should not
 * come back as `ryg-og-l-nd`.
 */
const LETTERS: Record<string, string> = {
	æ: 'ae',
	ø: 'oe',
	å: 'aa',
	ß: 'ss',
	đ: 'd',
	ł: 'l',
	þ: 'th'
};

export function sheetFilename(routine: Routine, printedAt = new Date()): string {
	const slug =
		routine.name
			.toLowerCase()
			.replace(/[æøåßđłþ]/g, (ch) => LETTERS[ch])
			.normalize('NFKD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'routine';
	const day = printedAt.toISOString().slice(0, 10);
	return `deadload-${slug}-${day}.pdf`;
}

/**
 * One thing to place in a column: a section heading or an exercise. Measured
 * first and drawn later, because where it lands is not known until the column it
 * belongs to is known.
 */
interface Cell {
	height: number;
	/** Never leave a heading stranded at the foot of a column with nothing under it. */
	keepWithNext?: boolean;
	draw: (x: number, y: number) => void;
}

export function routineSheet(
	routine: Routine,
	exercises: Map<string, Exercise>,
	options: SheetOptions = {}
): Uint8Array {
	const printedAt = options.printedAt ?? new Date();
	const images = options.images;
	const landscape = options.orientation === 'landscape';
	const page = landscape ? A4_LANDSCAPE : A4;
	const columns = landscape ? 3 : 2;

	const doc = new PdfDoc(page);
	const right = page.width - MARGIN;
	const width = right - MARGIN;
	const colW = (width - GUTTER * (columns - 1)) / columns;
	const bottom = page.height - MARGIN - 6;

	const stamp = printedAt.toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});

	// ------------------------------------------------------------ measure first
	const cells: Cell[] = [];

	for (const block of routine.blocks) {
		if (!block.items.length) continue;

		if (block.label || block.mode === 'circuit') {
			const rounds = Math.max(1, ...block.items.map((i) => Math.max(1, i.sets)));
			const circuit =
				block.mode === 'circuit' ? ` — circuit, ${rounds} round${rounds === 1 ? '' : 's'}` : '';
			const label = (block.label || 'Circuit').toUpperCase() + circuit;
			cells.push({
				height: 16,
				keepWithNext: true,
				draw: (x, y) => {
					doc.text(x, y + 8, label, { size: 8, font: 'bold', grey: 0.35 });
					doc.line(x, y + 11, x + colW, y + 11, 0.5, 0.55);
				}
			});
		}

		for (const item of block.items) {
			const exercise = exercises.get(item.exerciseId);
			const photo = images?.get(item.exerciseId);
			const textW = colW - TEXT_X;

			const name = wrapText(exercise?.name ?? item.exerciseId, NAME_SIZE, textW, 'bold');
			const detail = [describeItem(item)];
			if (item.restSeconds > 0) detail.push(`${item.restSeconds} s rest`);
			if (item.tempo) detail.push(`tempo ${item.tempo}`);
			const detailLines = wrapText(detail.join('  ·  '), DETAIL_SIZE, textW);
			const notes = item.notes ? wrapText(item.notes, NOTE_SIZE, textW) : [];

			// Boxes wrap onto further rows rather than running out of the column: a
			// six-set exercise is rare but it must not print off the edge of the paper.
			const sets = Math.max(1, item.sets);
			const label = setLabel(item);
			const boxW = Math.max(28, textWidth(label, 7) + 12);
			const perRow = Math.max(1, Math.floor((textW + 5) / (boxW + 5)));
			const boxRows = Math.ceil(sets / perRow);

			const textH =
				name.length * (NAME_SIZE + 2.5) +
				detailLines.length * (DETAIL_SIZE + 2.5) +
				2 +
				boxRows * (BOX_H + 4) +
				notes.length * (NOTE_SIZE + 2.5);

			cells.push({
				height: Math.max(photo ? PHOTO_H : 0, textH) + 12,
				draw: (x, y) => {
					if (photo) {
						// Fitted inside the box rather than stretched to it: the catalog has
						// a few portrait frames among the landscape ones.
						const scale = Math.min(PHOTO_W / photo.width, PHOTO_H / photo.height);
						const w = photo.width * scale;
						const h = photo.height * scale;
						doc.image(doc.addImage(photo), x + (PHOTO_W - w) / 2, y + (PHOTO_H - h) / 2, w, h);
					}

					let ty = y + NAME_SIZE;
					for (const line of name) {
						doc.text(x + TEXT_X, ty, line, { size: NAME_SIZE, font: 'bold' });
						ty += NAME_SIZE + 2.5;
					}
					for (const line of detailLines) {
						doc.text(x + TEXT_X, ty, line, { size: DETAIL_SIZE, grey: 0.35 });
						ty += DETAIL_SIZE + 2.5;
					}

					ty += 2;
					for (let i = 0; i < sets; i++) {
						const bx = x + TEXT_X + (i % perRow) * (boxW + 5);
						const by = ty + Math.floor(i / perRow) * (BOX_H + 4);
						doc.box(bx, by, boxW, BOX_H);
						// The target, small and pale, inside the box the number gets written
						// in: it says what to aim for without competing with the pen.
						doc.text(bx + 3, by + 10, label, { size: 6.5, grey: 0.6 });
					}
					ty += boxRows * (BOX_H + 4);

					for (const line of notes) {
						doc.text(x + TEXT_X, ty + NOTE_SIZE - 2, line, { size: NOTE_SIZE, grey: 0.45 });
						ty += NOTE_SIZE + 2.5;
					}
				}
			});
		}
	}

	// -------------------------------------------------------------- then place
	let column = 0;
	let y = 0;

	function footer(): void {
		const foot = page.height - MARGIN + 14;
		doc.text(MARGIN, foot, `Deadload  ·  ${routine.name}  ·  ${stamp}`, { size: 7.5, grey: 0.55 });
		const n = `Page ${doc.pageCount}`;
		doc.text(right - textWidth(n, 7.5), foot, n, { size: 7.5, grey: 0.55 });
	}

	/** The head, full width, on the first page only: it is the title of the sheet. */
	function head(): number {
		let hy = MARGIN + 4;
		doc.text(MARGIN, hy, routine.name, { size: 18, font: 'bold' });
		hy += 16;

		const facts = [
			`~${Math.max(1, Math.round(estimateSeconds(routine) / 60))} min`,
			`${countItems(routine)} exercise${countItems(routine) === 1 ? '' : 's'}`,
			`${totalSets(routine)} set${totalSets(routine) === 1 ? '' : 's'}`
		];
		if (routine.goal) facts.push(routine.goal);
		const needs = equipmentNeeded(routine, exercises);
		if (needs.length) facts.push(`needs ${needs.map(equipmentLabel).join(', ').toLowerCase()}`);
		doc.text(MARGIN, hy, facts.join('  ·  '), { size: 9, grey: 0.35 });
		hy += 12;

		if (routine.description) {
			for (const line of wrapText(routine.description, 9, width)) {
				doc.text(MARGIN, hy, line, { size: 9, grey: 0.2 });
				hy += 11;
			}
		}
		hy += 4;
		doc.line(MARGIN, hy, right, hy, 1);
		return hy + 12;
	}

	doc.newPage();
	const top = head();
	let pageIndex = 1;
	let columnTop = top;
	let limit = bottom;
	let remaining = cells.reduce((sum, c) => sum + c.height, 0);

	/**
	 * Where this column stops — decided **once, as the column opens**.
	 *
	 * Filling each column to the bottom before starting the next is what a
	 * newspaper does, and on a routine it looks broken: twelve exercises came out
	 * as one full column and a third of another. So a column takes an even share of
	 * what is left to place.
	 *
	 * Two things this got wrong on the way, both worth not repeating. Recomputing
	 * the share per cell makes the target slide down as the column fills, so the
	 * column breaks early, and the next one breaks earlier still — twelve exercises
	 * over three pages. And balancing when the remainder does *not* fit on this page
	 * ends a column short and spills onto a page that need not exist, so past that
	 * point the page bottom is the only limit.
	 */
	function startColumn(): void {
		y = columnTop;
		const columnsLeft = columns - column;
		const capacity = bottom - columnTop;
		const share = remaining <= capacity * columnsLeft ? remaining / columnsLeft : capacity;
		limit = columnTop + Math.min(capacity, share);
	}

	function nextColumn(): void {
		column++;
		if (column >= columns) {
			footer();
			doc.newPage();
			column = 0;
			pageIndex++;
		}
		// Only the first page carries the head; every later page is all columns.
		columnTop = pageIndex === 1 ? top : MARGIN + 4;
		startColumn();
	}

	startColumn();

	for (let i = 0; i < cells.length; i++) {
		const cell = cells[i];
		const needed = cell.keepWithNext ? cell.height + (cells[i + 1]?.height ?? 0) : cell.height;
		if (y > columnTop && y + needed > limit) nextColumn();
		cell.draw(MARGIN + column * (colW + GUTTER), y);
		y += cell.height;
		remaining -= cell.height;
	}

	/**
	 * Whatever is left at the foot of the last column, ruled. A log sheet with a
	 * third of a page of nothing on it invites the question of why it is blank;
	 * ruled lines answer it, and "how that felt" is the one thing the app's own
	 * fields cannot hold while you are still on the floor.
	 */
	const spare = bottom - y;
	if (spare > 70) {
		const x = MARGIN + column * (colW + GUTTER);
		doc.text(x, y + 12, 'NOTES', { size: 8, font: 'bold', grey: 0.35 });
		doc.line(x, y + 15, x + colW, y + 15, 0.5, 0.55);
		for (let ly = y + 33; ly <= bottom; ly += 18) doc.line(x, ly, x + colW, ly, 0.3, 0.82);
	}

	footer();
	return doc.bytes();
}
