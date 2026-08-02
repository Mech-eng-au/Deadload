import { equipmentLabel } from '../catalog/equipment.js';
import { countItems, describeItem } from '../db/routines.js';
import { estimateSeconds, totalSets } from '../session/steps.js';
import { A4, PdfDoc, textWidth, wrapText, type JpegImage } from './writer.js';
import type { EquipmentId, Exercise, Routine, RoutineItem } from '../types.js';

/**
 * A routine on paper (docs/SPEC.md §8, "A routine on paper").
 *
 * The sheet is a **log**, not a printout of a screen: every set gets a box to
 * tick and a rule to write the number on. That is the only reason to want a
 * routine on paper — a phone that has to stay in a pocket, a gym without signal,
 * somebody else following your routine — and a picture of the app on A4 would
 * serve none of them.
 *
 * **Photographs are optional and on by default.** Somebody following the paper
 * instead of the app needs to see the movement, and a name is not a movement.
 * They are printed small — 20 mm — and scaled down before they are embedded
 * (see ./images.ts), which is what keeps a twelve-exercise sheet under 200 kB
 * rather than the 900 kB it would be at catalog resolution. Turning them off
 * leaves the layout otherwise identical, for a sheet that has to fax or photocopy.
 *
 * Pure per §15: it takes the routine, the exercises it names and the already
 * encoded photographs, and returns bytes. `describeItem` is borrowed from the
 * routine module on purpose, so the paper cannot start describing a set
 * differently from the screen.
 */

const MARGIN = 48;
const LINE = 12.5;

export interface SheetOptions {
	/** Stamped in the footer, so a sheet found later says when it was printed. */
	printedAt?: Date;
	/**
	 * One JPEG per exercise id, from `loadThumbnails`. Absent, or missing an id,
	 * simply prints that exercise without a picture.
	 */
	images?: Map<string, JpegImage>;
}

/** Printed size of a photograph: 23 mm wide, which is the smallest a movement reads at. */
const PHOTO_W = 64;
const PHOTO_H = 48;

/** What the sheet says a set is, next to its boxes. */
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

export function routineSheet(
	routine: Routine,
	exercises: Map<string, Exercise>,
	options: SheetOptions = {}
): Uint8Array {
	const printedAt = options.printedAt ?? new Date();
	const images = options.images;
	const indent = images?.size ? PHOTO_W + 10 : 0;
	const doc = new PdfDoc(A4);
	const right = A4.width - MARGIN;
	const width = right - MARGIN;
	const bottom = A4.height - MARGIN - 8; // the footer sits below this

	const stamp = printedAt.toLocaleDateString('en-GB', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});

	/** Every page says what it is and where in the routine it comes. */
	function footer(): void {
		doc.text(MARGIN, A4.height - MARGIN + 12, `Deadload  ·  ${routine.name}  ·  ${stamp}`, {
			size: 8,
			grey: 0.55
		});
		const n = `Page ${doc.pageCount}`;
		doc.text(right - textWidth(n, 8), A4.height - MARGIN + 12, n, { size: 8, grey: 0.55 });
	}

	doc.newPage();
	let y = MARGIN + 6;

	/** Start a fresh page when `needed` points will not fit below the current line. */
	function room(needed: number): void {
		if (y + needed <= bottom) return;
		footer();
		doc.newPage();
		y = MARGIN + 6;
	}

	// ---------------------------------------------------------------- the head
	doc.text(MARGIN, y, routine.name, { size: 20, font: 'bold' });
	y += 20;

	const facts = [
		`~${Math.max(1, Math.round(estimateSeconds(routine) / 60))} min`,
		`${countItems(routine)} exercise${countItems(routine) === 1 ? '' : 's'}`,
		`${totalSets(routine)} set${totalSets(routine) === 1 ? '' : 's'}`
	];
	if (routine.goal) facts.push(routine.goal);
	doc.text(MARGIN, y, facts.join('  ·  '), { size: 10, grey: 0.35 });
	y += LINE + 2;

	if (routine.description) {
		for (const line of wrapText(routine.description, 10, width)) {
			room(LINE);
			doc.text(MARGIN, y, line, { size: 10, grey: 0.2 });
			y += LINE;
		}
		y += 2;
	}

	const needs = equipmentNeeded(routine, exercises);
	if (needs.length) {
		doc.text(MARGIN, y, `Needs: ${needs.map(equipmentLabel).join(', ').toLowerCase()}`, {
			size: 9,
			grey: 0.4
		});
		y += LINE;
	}

	y += 4;
	doc.line(MARGIN, y, right, y, 1);
	y += 16;

	// ------------------------------------------------------------- the exercises
	for (const block of routine.blocks) {
		if (!block.items.length) continue;

		if (block.label || block.mode === 'circuit') {
			const rounds = Math.max(1, ...block.items.map((i) => Math.max(1, i.sets)));
			const circuit =
				block.mode === 'circuit' ? ` — circuit, ${rounds} round${rounds === 1 ? '' : 's'}` : '';
			room(LINE * 2);
			doc.text(MARGIN, y, (block.label || 'Circuit').toUpperCase() + circuit, {
				size: 9,
				font: 'bold',
				grey: 0.35
			});
			y += LINE + 2;
		}

		for (const item of block.items) {
			const exercise = exercises.get(item.exerciseId);
			const photo = images?.get(item.exerciseId);
			const left = MARGIN + indent;
			const notes = item.notes ? wrapText(item.notes, 9, right - left - 16) : [];
			// Kept together: an exercise split across a page break is a routine you
			// cannot follow while holding the paper. With a photograph the row cannot
			// be shorter than the photograph either.
			const textHeight = LINE * (2 + notes.length) + 18;
			room(indent ? Math.max(textHeight, PHOTO_H + 14) : textHeight);

			const top = y - 10;
			if (photo) {
				// Fitted inside the box rather than stretched to it: the catalog has a
				// few portrait frames among the landscape ones.
				const scale = Math.min(PHOTO_W / photo.width, PHOTO_H / photo.height);
				const w = photo.width * scale;
				const h = photo.height * scale;
				doc.image(doc.addImage(photo), MARGIN + (PHOTO_W - w) / 2, top + (PHOTO_H - h) / 2, w, h);
			}

			doc.text(left, y, exercise?.name ?? item.exerciseId, { size: 11, font: 'bold' });
			y += LINE + 1;

			const detail = [describeItem(item)];
			if (item.restSeconds > 0) detail.push(`${item.restSeconds} s rest`);
			if (item.tempo) detail.push(`tempo ${item.tempo}`);
			doc.text(left + 16, y, detail.join('  ·  '), { size: 9, grey: 0.35 });

			// The boxes: one per set, on the same line as the detail, right-aligned so
			// they form a column down the page whatever the exercise is called.
			const sets = Math.max(1, item.sets);
			const label = setLabel(item);
			const boxW = Math.max(30, textWidth(label, 8) + 14);
			const step = boxW + 6;
			let bx = right - sets * step + 6;
			for (let i = 0; i < sets; i++) {
				doc.box(bx, y - 9, boxW, 16);
				// The target, small and pale, inside the box the number gets written in:
				// it says what to aim for without competing with the pen.
				doc.text(bx + 3, y - 9 + 11, label, { size: 7, grey: 0.6 });
				bx += step;
			}
			// Extra air before a note, because the boxes hang below the detail line
			// they sit on and a long note would otherwise run underneath them.
			y += notes.length ? LINE + 4 : LINE;

			for (const line of notes) {
				doc.text(left + 16, y, line, { size: 9, grey: 0.45 });
				y += LINE - 1;
			}

			// The rule goes below whichever is deeper, the words or the photograph.
			if (photo) y = Math.max(y, top + PHOTO_H + 4);
			y += 5;
			doc.line(MARGIN, y, right, y, 0.3, 0.8);
			y += 8;
		}

		y += 6;
	}

	footer();
	return doc.bytes();
}
