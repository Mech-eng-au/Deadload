import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	PdfDoc,
	codePointsOf,
	missingGlyphs,
	textWidth,
	wrapText,
	type JpegImage,
	type PdfFonts
} from '../src/lib/pdf/writer.js';
import { parseFont } from '../src/lib/pdf/truetype.js';
import { equipmentNeeded, routineSheet, sheetFilename } from '../src/lib/pdf/routine-sheet.js';
import { LOCALES, messages } from '../src/lib/i18n/index.js';
import { en } from '../src/lib/i18n/en/index.js';
import type { Exercise, Routine, RoutineItem } from '../src/lib/types.js';

const ascii = (bytes: Uint8Array) => String.fromCharCode(...bytes);

/** The committed subsets, exactly as the app loads them (§16). */
function loadFont(name: string) {
	return parseFont(
		new Uint8Array(readFileSync(join(import.meta.dirname, `../src/lib/pdf/fonts/${name}.ttf`)))
	);
}
const fonts: PdfFonts = { regular: loadFont('noto-sans-regular'), bold: loadFont('noto-sans-bold') };

/**
 * Read the text back out of a finished PDF.
 *
 * Text is written as **glyph ids** now that the font is embedded, so `(Morning)
 * Tj` has become `<004D006F…> Tj` and no assertion can look for a word
 * directly. This resolves the file's own object graph — page → `/Font` →
 * `/ToUnicode` — and decodes each run through the map belonging to the weight
 * it was set in.
 *
 * Doing it properly rather than by scanning for hex pairs is not fussiness. The
 * two weights are separate subsets, so glyph 12 is a different letter in each,
 * and a single flat map decodes bold text into nonsense. That is exactly what
 * the first version of this helper did.
 *
 * The upshot is that every assertion below also checks that `/ToUnicode` is
 * right, which is what makes the text selectable and searchable in a reader.
 */
function textIn(bytes: Uint8Array): string[] {
	const file = ascii(bytes);

	const objects = new Map<string, string>();
	for (const [, id, body] of file.matchAll(/(\d+) 0 obj\n([\s\S]*?)\nendobj/g)) {
		objects.set(id, body);
	}

	/** `/ToUnicode` for each `/Fn`, followed from the page's resource dictionary. */
	const maps = new Map<string, Map<string, string>>();
	const page = [...objects.values()].find((o) => o.includes('/Type /Page\b') || o.includes('/Type /Page '));
	for (const [, name, fontId] of (page ?? '').matchAll(/\/(F\d) (\d+) 0 R/g)) {
		const toUnicodeId = objects.get(fontId)?.match(/\/ToUnicode (\d+) 0 R/)?.[1];
		const cmap = toUnicodeId ? (objects.get(toUnicodeId) ?? '') : '';
		const map = new Map<string, string>();
		// Only inside the bfchar blocks: the codespace range is `<0000> <FFFF>`
		// and looks exactly like a mapping from outside.
		for (const [, block] of cmap.matchAll(/beginbfchar\n([\s\S]*?)\nendbfchar/g)) {
			for (const [, glyph, value] of block.matchAll(/<([0-9A-F]{4})> <([0-9A-F]{4,})>/g)) {
				map.set(
					glyph,
					String.fromCharCode(...(value.match(/.{4}/g) ?? []).map((h) => parseInt(h, 16)))
				);
			}
		}
		maps.set(name, map);
	}

	return [...file.matchAll(/BT \/(F\d)[^\n]*?<([0-9A-F]*)> Tj/g)].map(([, font, hex]) => {
		const map = maps.get(font) ?? new Map();
		return (hex.match(/.{4}/g) ?? []).map((g) => map.get(g) ?? '\uFFFD').join('');
	});
}

/** Everything the sheet says, as one string, for a plain `toContain`. */
const said = (bytes: Uint8Array) => textIn(bytes).join('\n');

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

describe('the embedded font (§16)', () => {
	/**
	 * The check that makes "adding a language is a file" true of the printable
	 * sheet as well as of the screens. Before the font was embedded the writer
	 * rendered anything outside Latin-1 as `?` — silently, on paper, where nobody
	 * would see it until it was printed.
	 */
	it.each(LOCALES)('can print every word of $id', ({ id: locale }) => {
		const walk = (value: unknown, path: string): void => {
			if (typeof value === 'string') {
				for (const font of [fonts.regular, fonts.bold]) {
					expect(missingGlyphs(font, value), `${locale} ${path}: "${value}"`).toEqual([]);
				}
			} else if (value && typeof value === 'object') {
				for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
			}
			// Message functions are skipped: their output depends on arguments, and
			// what they interpolate is covered by the alphabets below.
		};
		walk(messages(locale).pdf, 'pdf');
		walk(messages(locale).units, 'units');
	});

	it('covers the alphabets the repertoire promises', () => {
		// One representative word per script `scripts/build-fonts.ts` includes, so
		// shrinking the repertoire fails here rather than on somebody's printer.
		for (const word of ['Ryg og lænd', 'Ćwiczenia mięśni', 'žluťoučký', 'İstanbul ğüşiöç', 'Ασκήσεις', 'Упражнения']) {
			expect(missingGlyphs(fonts.regular, word), word).toEqual([]);
			expect(missingGlyphs(fonts.bold, word), word).toEqual([]);
		}
	});

	it('spells out what no font would have, rather than dropping it', () => {
		expect(String.fromCodePoint(...codePointsOf('more →'))).toBe('more ->');
	});

	it('names what it cannot print, so the locale test above can fail usefully', () => {
		expect(missingGlyphs(fonts.regular, '日本語')).toEqual(['日', '本', '語']);
	});
});

describe('measuring and wrapping', () => {
	it('measures narrow letters as narrower than wide ones', () => {
		expect(textWidth(fonts.regular, 'iii', 10)).toBeLessThan(textWidth(fonts.regular, 'MMM', 10));
	});

	it('scales with the point size', () => {
		expect(textWidth(fonts.regular, 'hello', 20)).toBeCloseTo(
			textWidth(fonts.regular, 'hello', 10) * 2,
			5
		);
	});

	it('makes bold wider than regular for the same word', () => {
		expect(textWidth(fonts.bold, 'Squat', 11)).toBeGreaterThan(textWidth(fonts.regular, 'Squat', 11));
	});

	it('measures an accented letter, rather than guessing at it', () => {
		// The old WinAnsi table only held ASCII and measured "ø" as an "n". With the
		// font's own metrics there is nothing to approximate.
		expect(textWidth(fonts.regular, 'ø', 10)).toBeGreaterThan(0);
		expect(textWidth(fonts.regular, 'lænd', 10)).toBeGreaterThan(textWidth(fonts.regular, 'lnd', 10));
	});

	it('wraps on spaces and keeps every line inside the width', () => {
		const text = 'Baby held at your chest, or in the carrier. Down slowly, up as you breathe out.';
		const lines = wrapText(fonts.regular, text, 9, 200);
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) expect(textWidth(fonts.regular, line, 9)).toBeLessThanOrEqual(200);
		expect(lines.join(' ')).toBe(text);
	});

	it('cuts a word that cannot fit at all, rather than letting it run off the page', () => {
		const lines = wrapText(fonts.regular, 'supercalifragilistic', 12, 40);
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) expect(textWidth(fonts.regular, line, 12)).toBeLessThanOrEqual(40);
		expect(lines.join('')).toBe('supercalifragilistic');
	});

	it('keeps a deliberate line break', () => {
		expect(wrapText(fonts.regular, 'one\ntwo', 10, 500)).toEqual(['one', 'two']);
	});
});

describe('the file itself', () => {
	const bytes = routineSheet(routine([item()]), catalog, {
		fonts,
		t: en,
		printedAt: new Date('2026-07-30T12:00:00Z')
	});
	const text = ascii(bytes);

	it('is a PDF, opened and closed', () => {
		expect(text.startsWith('%PDF-1.4\n')).toBe(true);
		expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
	});

	/**
	 * It **used** to be pure ASCII with no photographs in it, on the base-14
	 * fonts. Embedding a font (§16) gave that up deliberately: the file now
	 * carries the subset as binary, exactly as it already carried the JPEGs. What
	 * has not changed, and must not, is that every byte of the file is one
	 * character of the string it was built from — that is what makes the
	 * cross-reference offsets below equal to string lengths.
	 */
	it('carries its font, and stays one character per byte', () => {
		expect(text.length).toBe(bytes.length);
		expect(text).toContain('/FontFile2');
		expect(text).toContain('/Subtype /Type0');
		expect(text).toContain('/Encoding /Identity-H');
		// A subset name is six capitals and a plus, and it has to be there or a
		// reader may treat the font as the whole of Noto Sans.
		expect(text).toMatch(/\/BaseFont \/[A-Z]{6}\+NotoSans/);
	});

	it('embeds only the weights the sheet actually used', () => {
		// The sheet sets the routine name in bold and everything else regular, so
		// both are here; a document with no bold on it should carry no bold font.
		expect((text.match(/\/FontFile2/g) ?? []).length).toBe(2);
		const plain = new PdfDoc(fonts);
		plain.text(10, 10, 'regular only');
		expect((ascii(plain.bytes()).match(/\/FontFile2/g) ?? []).length).toBe(1);
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
		const words = said(bytes);
		expect(words).toContain('Morning');
		expect(words).toContain('Push-Ups');
		expect(words).toContain('3 × 10 reps'); // the same words the screen uses
		expect(words).toContain('30 July 2026');
	});

	it('is printed in the language the app is in (§16)', () => {
		const danish = routineSheet(routine([item()]), catalog, {
			fonts,
			t: messages('da'),
			printedAt: new Date('2026-07-30T12:00:00Z')
		});
		const words = said(danish);
		// The routine's own name is the user's and is never translated; everything
		// the sheet says for itself is.
		expect(words).toContain('Morning');
		expect(words).toContain('3 × 10 reps');
		expect(words).toContain('40 s pause');
		expect(words).toContain('Side 1');
		// The date used to be hard-coded en-GB whatever the app was set to.
		expect(words).toContain('30. juli 2026');
	});

	it('prints Danish letters rather than question marks', () => {
		const words = said(
			routineSheet(routine([item({ notes: 'Ryg og lænd — træk vejret på vej op' })]), catalog, {
				fonts,
				t: messages('da')
			})
		);
		expect(words).toContain('Ryg og lænd — træk vejret på vej op');
		expect(words).not.toContain('?');
	});

	it('draws one box per set, to write the number in', () => {
		const boxes = (text.match(/ re S/g) ?? []).length;
		expect(boxes).toBe(3);
	});

	it('runs onto more pages when the routine is long, and numbers them', () => {
		const many = Array.from({ length: 40 }, (_, i) => item({ id: `i${i}` }));
		const long = routineSheet(routine(many), catalog, { fonts, t: en });
		expect((ascii(long).match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
		expect(said(long)).toContain('Page 1');
		expect(said(long)).toContain('Page 2');
	});

	it('names an exercise the catalog has never heard of by its id', () => {
		const orphan = routineSheet(routine([item({ exerciseId: 'gone' })]), catalog, { fonts, t: en });
		expect(said(orphan)).toContain('gone');
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
			routineSheet(routine([item()]), catalog, { fonts, t: en, images: new Map([['pushups', photo(1)]]) })
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
		const text = ascii(routineSheet(twice, catalog, { fonts, t: en, images: new Map([['pushups', photo(2)]]) }));
		expect((text.match(/\/Subtype \/Image/g) ?? []).length).toBe(1);
		expect((text.match(/\/Im1 Do/g) ?? []).length).toBe(2);
	});

	it('prints an exercise with no photograph, rather than nothing', () => {
		const sheet = routineSheet(routine([item(), item({ id: 'b', exerciseId: 'gone' })]), catalog, {
			fonts,
			t: en,
			images: new Map([['pushups', photo(3)]])
		});
		expect((ascii(sheet).match(/\/Subtype \/Image/g) ?? []).length).toBe(1);
		expect(said(sheet)).toContain('gone');
	});

	it('leaves the layout alone when there are no photographs at all', () => {
		const withEmpty = ascii(routineSheet(routine([item()]), catalog, { fonts, t: en, images: new Map() }));
		const without = ascii(routineSheet(routine([item()]), catalog, { fonts, t: en }));
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
		const doc = new PdfDoc(fonts);
		expect(doc.pageCount).toBe(0);
		doc.newPage();
		doc.text(10, 10, 'hi');
		expect(doc.pageCount).toBe(1);
		doc.newPage();
		doc.text(10, 10, 'again');
		expect(doc.pageCount).toBe(2);
	});

	it('produces a valid one-page file even with nothing on it', () => {
		const text = ascii(new PdfDoc(fonts).bytes());
		expect(text).toContain('/Count 1');
		expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
	});
});
