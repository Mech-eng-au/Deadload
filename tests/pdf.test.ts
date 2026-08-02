import { describe, expect, it } from 'vitest';
import { PdfDoc, pdfString, textWidth, wrapText, type JpegImage } from '../src/lib/pdf/writer.js';
import { equipmentNeeded, routineSheet, sheetFilename } from '../src/lib/pdf/routine-sheet.js';
import type { Exercise, Routine, RoutineItem } from '../src/lib/types.js';

const ascii = (bytes: Uint8Array) => String.fromCharCode(...bytes);

function exercise(over: Partial<Exercise> = {}): Exercise {
	return {
		id: 'pushups',
		name: 'Push-Ups',
		aliases: [],
		category: 'strength',
		equipment: [],
		primaryMuscles: ['chest'],
		secondaryMuscles: [],
		level: 'beginner',
		unilateral: false,
		defaultMetric: 'reps',
		instructions: [],
		media: [],
		attributionId: 'a',
		...over
	};
}

function item(over: Partial<RoutineItem> = {}): RoutineItem {
	return {
		id: 'i1',
		exerciseId: 'pushups',
		sets: 3,
		target: { kind: 'reps', reps: 10 },
		perSide: false,
		restSeconds: 40,
		...over
	};
}

function routine(items: RoutineItem[], over: Partial<Routine> = {}): Routine {
	return {
		id: 'r1',
		name: 'Morning',
		tags: [],
		source: 'user',
		createdAt: '2026-07-30T07:00:00.000Z',
		updatedAt: '2026-07-30T07:00:00.000Z',
		blocks: [{ id: 'b1', label: 'Main', items }],
		...over
	};
}

const catalog = new Map<string, Exercise>([['pushups', exercise()]]);

describe('PDF strings', () => {
	it('leaves ASCII alone', () => {
		expect(pdfString('Push-Ups 3 x 10')).toBe('Push-Ups 3 x 10');
	});

	it('escapes what would end the literal', () => {
		expect(pdfString('a(b)c\\d')).toBe('a\\(b\\)c\\\\d');
	});

	it('writes Latin-1 as octal, which is what WinAnsi wants', () => {
		// Danish is the first language after English that this app will meet.
		expect(pdfString('øl')).toBe('\\370l');
		expect(pdfString('3 × 10')).toBe('3 \\327 10'); // multiplication sign, from describeItem
		expect(pdfString('a · b')).toBe('a \\267 b');
	});

	it('maps the punctuation WinAnsi keeps somewhere else', () => {
		expect(pdfString('a — b')).toBe('a \\227 b'); // em dash
		expect(pdfString('a – b')).toBe('a \\226 b'); // en dash
		expect(pdfString('it’s')).toBe('it\\222s');
	});

	it('spells out what the font cannot say, rather than dropping it', () => {
		expect(pdfString('more →')).toBe('more ->');
		expect(pdfString('日本語')).toBe('???');
	});
});

describe('measuring and wrapping', () => {
	it('measures narrow letters as narrower than wide ones', () => {
		expect(textWidth('iii', 10)).toBeLessThan(textWidth('MMM', 10));
	});

	it('scales with the point size', () => {
		expect(textWidth('hello', 20)).toBeCloseTo(textWidth('hello', 10) * 2, 5);
	});

	it('makes bold wider than regular for the same word', () => {
		expect(textWidth('Squat', 11, 'bold')).toBeGreaterThan(textWidth('Squat', 11));
	});

	it('wraps on spaces and keeps every line inside the width', () => {
		const text = 'Baby held at your chest, or in the carrier. Down slowly, up as you breathe out.';
		const lines = wrapText(text, 9, 200);
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) expect(textWidth(line, 9)).toBeLessThanOrEqual(200);
		expect(lines.join(' ')).toBe(text);
	});

	it('cuts a word that cannot fit at all, rather than letting it run off the page', () => {
		const lines = wrapText('supercalifragilistic', 12, 40);
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) expect(textWidth(line, 12)).toBeLessThanOrEqual(40);
		expect(lines.join('')).toBe('supercalifragilistic');
	});

	it('keeps a deliberate line break', () => {
		expect(wrapText('one\ntwo', 10, 500)).toEqual(['one', 'two']);
	});
});

describe('the file itself', () => {
	const bytes = routineSheet(routine([item()]), catalog, {
		printedAt: new Date('2026-07-30T12:00:00Z')
	});
	const text = ascii(bytes);

	it('is a PDF, opened and closed', () => {
		expect(text.startsWith('%PDF-1.4\n')).toBe(true);
		expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
	});

	it('is pure ASCII when there are no photographs in it', () => {
		expect(bytes.every((b) => b < 128)).toBe(true);
	});

	/**
	 * The xref table is the one part of a PDF that a reader will reject outright,
	 * and a wrong byte offset is invisible in the text. So check every entry points
	 * at the object it claims.
	 */
	it('has a cross-reference table whose offsets are right', () => {
		const start = Number(text.slice(text.lastIndexOf('startxref')).split('\n')[1]);
		expect(text.slice(start, start + 4)).toBe('xref');
		const rows = text
			.slice(start)
			.split('\n')
			.filter((l) => /^\d{10} \d{5} [nf]/.test(l));
		expect(rows.length).toBeGreaterThan(4);
		rows.slice(1).forEach((row, i) => {
			const offset = Number(row.slice(0, 10));
			expect(text.slice(offset, offset + 8)).toContain(`${i + 1} 0 obj`);
		});
	});

	it('declares one page object per page', () => {
		const pages = text.match(/\/Type \/Page\b/g) ?? [];
		expect(pages).toHaveLength(1);
		expect(text).toContain('/Count 1');
	});

	it('says what the routine is', () => {
		expect(text).toContain('(Morning) Tj');
		expect(text).toContain('(Push-Ups) Tj');
		expect(text).toContain('3 \\327 10 reps'); // the same words the screen uses
		expect(text).toContain('30 July 2026');
	});

	it('draws one box per set, to write the number in', () => {
		const boxes = (text.match(/ re S/g) ?? []).length;
		expect(boxes).toBe(3);
	});

	it('runs onto more pages when the routine is long, and numbers them', () => {
		const many = Array.from({ length: 40 }, (_, i) => item({ id: `i${i}` }));
		const long = ascii(routineSheet(routine(many), catalog));
		expect((long.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
		expect(long).toContain('(Page 1) Tj');
		expect(long).toContain('(Page 2) Tj');
	});

	it('names an exercise the catalog has never heard of by its id', () => {
		const orphan = ascii(routineSheet(routine([item({ exerciseId: 'gone' })]), catalog));
		expect(orphan).toContain('(gone) Tj');
	});
});

describe('columns', () => {
	/** Twelve exercises, three sections, notes on some — a real routine's shape. */
	const twelve = routine(
		Array.from({ length: 12 }, (_, i) =>
			item({ id: `i${i}`, notes: i % 3 === 0 ? 'A note that takes a line or two of the column.' : undefined })
		)
	);

	it('is portrait by default and landscape on request', () => {
		expect(ascii(routineSheet(twelve, catalog))).toContain('/MediaBox [0 0 595.28 841.89]');
		expect(ascii(routineSheet(twelve, catalog, { orientation: 'landscape' }))).toContain(
			'/MediaBox [0 0 841.89 595.28]'
		);
	});

	/**
	 * The regression that mattered: balancing the columns by recomputing the share
	 * per cell made every column break early, and twelve exercises came out over
	 * three pages instead of one.
	 */
	it('puts a twelve-exercise routine on one page, either way up', () => {
		for (const orientation of ['portrait', 'landscape'] as const) {
			const text = ascii(routineSheet(twelve, catalog, { orientation }));
			expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
		}
	});

	// An exercise's words start 60 pt into its column, which is what these look for:
	// a column nobody put anything in has no text at its own x.
	it('actually uses the second column rather than one long first one', () => {
		const text = ascii(routineSheet(twelve, catalog));
		// Portrait: 40 pt margins, two columns of 247.64, a 20 pt gutter.
		expect(text).toContain('1 0 0 1 100 ');
		expect(text).toContain('1 0 0 1 367.64 ');
	});

	it('fills three columns on landscape paper', () => {
		const text = ascii(routineSheet(twelve, catalog, { orientation: 'landscape' }));
		expect(text).toContain('1 0 0 1 100 ');
		expect(text).toContain('1 0 0 1 360.63 ');
		expect(text).toContain('1 0 0 1 621.26 ');
	});

	it('rules the space left at the foot for notes', () => {
		expect(ascii(routineSheet(routine([item()]), catalog))).toContain('(NOTES) Tj');
	});

	it('leaves no notes block when the page is full', () => {
		const many = routine(Array.from({ length: 60 }, (_, i) => item({ id: `i${i}` })));
		const pages = ascii(routineSheet(many, catalog));
		expect((pages.match(/\(NOTES\) Tj/g) ?? []).length).toBeLessThanOrEqual(1);
	});
});

describe('photographs', () => {
	// Not a real JPEG: the writer copies the bytes through verbatim and never looks
	// inside them, which is the point of using the one format a PDF stores as it is.
	const photo = (n: number): JpegImage => ({
		bytes: new Uint8Array([0xff, 0xd8, 0xff, n, 0xff, 0xd9]),
		width: 240,
		height: 160
	});

	it('embeds one image object per exercise, with its size and no re-encoding', () => {
		const text = ascii(
			routineSheet(routine([item()]), catalog, { images: new Map([['pushups', photo(1)]]) })
		);
		expect(text).toContain('/Subtype /Image');
		expect(text).toContain('/Width 240 /Height 160');
		expect(text).toContain('/Filter /DCTDecode');
		expect(text).toContain('/XObject << /Im1');
		expect(text).toContain('/Im1 Do');
		expect(text).toContain('\xff\xd8\xff\x01\xff\xd9'.replace(/\\x(..)/g, (_, h) =>
			String.fromCharCode(parseInt(h, 16))
		));
	});

	it('stores an exercise used twice only once', () => {
		const twice = routine([item({ id: 'a' }), item({ id: 'b' })]);
		const text = ascii(routineSheet(twice, catalog, { images: new Map([['pushups', photo(2)]]) }));
		expect((text.match(/\/Subtype \/Image/g) ?? []).length).toBe(1);
		expect((text.match(/\/Im1 Do/g) ?? []).length).toBe(2);
	});

	it('prints an exercise with no photograph, rather than nothing', () => {
		const text = ascii(
			routineSheet(routine([item(), item({ id: 'b', exerciseId: 'gone' })]), catalog, {
				images: new Map([['pushups', photo(3)]])
			})
		);
		expect((text.match(/\/Subtype \/Image/g) ?? []).length).toBe(1);
		expect(text).toContain('(gone) Tj');
	});

	it('leaves the layout alone when there are no photographs at all', () => {
		const withEmpty = ascii(routineSheet(routine([item()]), catalog, { images: new Map() }));
		const without = ascii(routineSheet(routine([item()]), catalog));
		expect(withEmpty).toBe(without);
		expect(without).not.toContain('/XObject');
	});
});

describe('what the sheet says it needs', () => {
	it('lists each piece of equipment once, and nothing for floor work', () => {
		const ball = exercise({ id: 'ball', equipment: ['yoga_ball'] });
		const both = exercise({ id: 'both', equipment: ['yoga_ball', 'chair'] });
		const map = new Map([
			['pushups', exercise()],
			['ball', ball],
			['both', both]
		]);
		const r = routine([
			item({ id: 'a', exerciseId: 'ball' }),
			item({ id: 'b', exerciseId: 'both' }),
			item({ id: 'c', exerciseId: 'pushups' })
		]);
		expect(equipmentNeeded(r, map)).toEqual(['yoga_ball', 'chair']);
		expect(equipmentNeeded(routine([item()]), map)).toEqual([]);
	});
});

describe('the filename', () => {
	const at = new Date('2026-07-30T12:00:00Z');

	it('is the routine and the day', () => {
		expect(sheetFilename(routine([], { name: 'Morning mobility' }), at)).toBe(
			'deadload-morning-mobility-2026-07-30.pdf'
		);
	});

	it('survives punctuation, accents and an empty name', () => {
		expect(sheetFilename(routine([], { name: 'Ryg & lænd!' }), at)).toBe(
			'deadload-ryg-laend-2026-07-30.pdf'
		);
		expect(sheetFilename(routine([], { name: '???' }), at)).toBe('deadload-routine-2026-07-30.pdf');
	});
});

describe('the writer on its own', () => {
	it('counts pages as they are started', () => {
		const doc = new PdfDoc();
		expect(doc.pageCount).toBe(0);
		doc.newPage();
		doc.text(10, 10, 'hi');
		expect(doc.pageCount).toBe(1);
		doc.newPage();
		doc.text(10, 10, 'again');
		expect(doc.pageCount).toBe(2);
	});

	it('produces a valid one-page file even with nothing on it', () => {
		const text = ascii(new PdfDoc().bytes());
		expect(text).toContain('/Count 1');
		expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
	});
});
