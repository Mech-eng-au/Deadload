/**
 * A very small PDF writer (docs/SPEC.md §8, "A routine on paper").
 *
 * Enough to put text, rules and boxes on A4 pages, and nothing else. Written by
 * hand rather than pulled from npm because the whole feature is a page of text: a
 * PDF library is several hundred kilobytes of machinery to draw a list, and
 * this app ships inside an APK that has to work in airplane mode.
 *
 * **Amended 2026-08-02 for §16.** It used to use the base-14 Helvetica, which
 * every reader already has and which cost nothing — but its WinAnsi encoding is
 * Latin-1, so the writer rendered anything outside that as `?`. Danish was fine;
 * Polish, Czech, Turkish, Greek and Cyrillic were not, and the failure was
 * silent and landed on paper. The sheet now embeds a **subset of Noto Sans**,
 * cut to the glyphs the document actually uses (see ./truetype.ts). Two things
 * follow, and both are visible in the tests:
 *
 * - Text is written as **glyph ids, not characters** — `<00480065> Tj` rather
 *   than `(He) Tj` — because that is what an embedded font is addressed by. A
 *   `/ToUnicode` map goes in beside it so the text can still be selected and
 *   searched in a reader, which is also how the tests read the file back.
 * - The file is **no longer pure ASCII**: it carries the font, as it already
 *   carried the JPEGs. The one-character-per-byte invariant is unchanged, which
 *   is what keeps the cross-reference offsets equal to string lengths.
 *
 * Pure, per §15: no DOM, no Blob, no Capacitor. It returns bytes and the caller
 * decides what to do with them. Loading the font is ./fonts.ts.
 */
import { parseFont, subsetFont, type TrueTypeFont } from './truetype.js';

export interface PageSize {
	width: number;
	height: number;
}

/** A4 in PostScript points, which is the only unit a PDF has. */
export const A4: PageSize = { width: 595.28, height: 841.89 };

export type Font = 'regular' | 'bold';

/** The two weights the sheet sets type in. */
export interface PdfFonts {
	regular: TrueTypeFont;
	bold: TrueTypeFont;
}

/**
 * Characters with no glyph in any font we would ship, spelled out rather than
 * dropped. Kept from the WinAnsi era: these are arrows and maths that read
 * perfectly well as ASCII and would otherwise depend on a font's goodwill.
 */
const TRANSLITERATE: Record<string, string> = {
	'→': '->',
	'←': '<-',
	'≤': '<=',
	'≥': '>=',
	'≡': '=',
	'″': '"',
	'′': "'"
};

/** Characters spelled out before anything is measured, so "→" survives as "->". */
function expand(text: string): string {
	let out = '';
	for (const ch of text) out += TRANSLITERATE[ch] ?? ch;
	return out;
}

/**
 * The code points a string needs, after transliteration. What the locale test
 * in `tests/pdf.test.ts` walks to decide whether a language can be printed at
 * all — the check that turns "adding Polish is a file" into something CI can
 * confirm rather than something a user finds on paper.
 */
export function codePointsOf(text: string): number[] {
	return [...expand(text)].map((ch) => ch.codePointAt(0)!);
}

/** Every character in `text` the font has no glyph for. Empty means printable. */
export function missingGlyphs(font: TrueTypeFont, text: string): string[] {
	const missing: string[] = [];
	for (const ch of expand(text)) {
		if (ch === ' ') continue;
		if (font.glyphFor(ch.codePointAt(0)!) === 0 && !missing.includes(ch)) missing.push(ch);
	}
	return missing;
}

/** Width of a string at a given size, in points, using the font's own metrics. */
export function textWidth(
	font: TrueTypeFont,
	text: string,
	size: number
): number {
	let units = 0;
	for (const ch of expand(text)) {
		const cp = ch.codePointAt(0)!;
		const glyph = font.glyphFor(cp);
		// An unrepresentable character is printed as "?" (see `glyphRun`), so it is
		// measured as one too — otherwise the line would wrap in the wrong place.
		units += font.advance(glyph === 0 ? font.glyphFor(0x3f) : glyph);
	}
	return (units * size) / font.unitsPerEm;
}

/**
 * Break text into lines that fit `maxWidth`, on spaces where possible. A single
 * word longer than the line is cut mid-word rather than allowed to run off the
 * page — a URL in a note should look wrong, not disappear into the margin.
 */
export function wrapText(
	font: TrueTypeFont,
	text: string,
	size: number,
	maxWidth: number
): string[] {
	const lines: string[] = [];
	for (const paragraph of text.split('\n')) {
		let line = '';
		for (const word of paragraph.split(/\s+/).filter(Boolean)) {
			const candidate = line ? `${line} ${word}` : word;
			if (textWidth(font, candidate, size) <= maxWidth) {
				line = candidate;
				continue;
			}
			if (line) lines.push(line);
			line = word;
			while (textWidth(font, line, size) > maxWidth && line.length > 1) {
				let cut = line.length;
				while (cut > 1 && textWidth(font, line.slice(0, cut), size) > maxWidth) cut--;
				lines.push(line.slice(0, cut));
				line = line.slice(cut);
			}
		}
		lines.push(line);
	}
	return lines;
}

/** A photograph, already JPEG — the one image format a PDF takes as it stands. */
export interface JpegImage {
	bytes: Uint8Array;
	width: number;
	height: number;
}

interface TextOptions {
	size?: number;
	font?: Font;
	/** 0 is black, 1 is white. */
	grey?: number;
}

/** A line of text, held until the glyph numbering of the subset is known. */
interface TextOp {
	x: number;
	y: number;
	value: string;
	size: number;
	font: Font;
	grey: number;
}

type Op = string | TextOp;

/**
 * A document being built. Coordinates are given with **y measured down from the
 * top of the page**, which is how the layout above thinks, and flipped on the way
 * into the content stream.
 */
export class PdfDoc {
	readonly size: PageSize;
	readonly fonts: PdfFonts;
	private pages: Op[][] = [];
	private current: Op[] = [];
	private images: JpegImage[] = [];
	private imageNames = new Map<JpegImage, string>();
	/** Code points written in each weight, which decides what gets embedded. */
	private used: Record<Font, Set<number>> = { regular: new Set(), bold: new Set() };

	constructor(fonts: PdfFonts, size: PageSize = A4) {
		this.fonts = fonts;
		this.size = size;
	}

	/** Finish the current page and start a blank one. */
	newPage(): void {
		if (this.current.length) this.pages.push(this.current);
		this.current = [];
	}

	get pageCount(): number {
		return this.pages.length + (this.current.length ? 1 : 0);
	}

	text(x: number, y: number, value: string, options: TextOptions = {}): void {
		const { size = 10, font = 'regular', grey = 0 } = options;
		for (const cp of codePointsOf(value)) this.used[font].add(cp);
		this.current.push({ x, y, value, size, font, grey });
	}

	/** Width of a string in the weight it will be drawn in. */
	width(value: string, size: number, font: Font = 'regular'): number {
		return textWidth(this.fonts[font], value, size);
	}

	line(x1: number, y1: number, x2: number, y2: number, width = 0.5, grey = 0): void {
		this.current.push(
			`${grey} G ${width} w ${round(x1)} ${round(this.size.height - y1)} m ` +
				`${round(x2)} ${round(this.size.height - y2)} l S`
		);
	}

	/**
	 * Register a photograph, returning the name to draw it by. The same image
	 * handed in twice is stored once — an exercise that appears in two sections
	 * should not double the size of the file.
	 */
	addImage(image: JpegImage): string {
		const existing = this.imageNames.get(image);
		if (existing) return existing;
		const name = `Im${this.images.length + 1}`;
		this.images.push(image);
		this.imageNames.set(image, name);
		return name;
	}

	/** Draw a registered photograph into the given rectangle. */
	image(name: string, x: number, y: number, w: number, h: number): void {
		this.current.push(
			`q ${round(w)} 0 0 ${round(h)} ${round(x)} ${round(this.size.height - y - h)} cm /${name} Do Q`
		);
	}

	/** An empty box, for writing in with a pen. */
	box(x: number, y: number, w: number, h: number, width = 0.6, grey = 0.45): void {
		this.current.push(
			`${grey} G ${width} w ${round(x)} ${round(this.size.height - y - h)} ${round(w)} ${round(h)} re S`
		);
	}

	/** The whole file. Every offset in the cross-reference table is a byte count. */
	bytes(): Uint8Array {
		if (this.current.length) {
			this.pages.push(this.current);
			this.current = [];
		}
		if (!this.pages.length) this.pages.push([]);

		// Only a weight that was actually written gets embedded: a sheet with no
		// bold on it should not carry a bold font.
		const embedded: Partial<Record<Font, EmbeddedFont>> = {};
		for (const weight of ['regular', 'bold'] as const) {
			if (this.used[weight].size) {
				embedded[weight] = embed(this.fonts[weight], this.used[weight]);
			}
		}

		const objects: string[] = [];
		const alloc = (): number => objects.push('') as number;

		const catalogId = alloc();
		const pagesId = alloc();

		const fontIds: Partial<Record<Font, number>> = {};
		for (const weight of ['regular', 'bold'] as const) {
			const font = embedded[weight];
			if (!font) continue;
			const fileId = alloc();
			const descriptorId = alloc();
			const toUnicodeId = alloc();
			const cidId = alloc();
			const typeId = alloc();
			fontIds[weight] = typeId;

			objects[fileId] =
				`<< /Length ${font.file.length} /Length1 ${font.file.length} >>\n` +
				`stream\n${latin1(font.file)}\nendstream`;
			objects[descriptorId] =
				`<< /Type /FontDescriptor /FontName /${font.name} /Flags 32 ` +
				`/FontBBox [${font.bbox.join(' ')}] /ItalicAngle ${font.italicAngle} ` +
				`/Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} ` +
				`/StemV ${weight === 'bold' ? 140 : 80} /FontFile2 ${fileId} 0 R >>`;
			objects[toUnicodeId] =
				`<< /Length ${font.toUnicode.length} >>\nstream\n${font.toUnicode}\nendstream`;
			objects[cidId] =
				`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${font.name} ` +
				`/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ` +
				`/FontDescriptor ${descriptorId} 0 R /DW 1000 /W [0 [${font.widths.join(' ')}]] ` +
				`/CIDToGIDMap /Identity >>`;
			objects[typeId] =
				`<< /Type /Font /Subtype /Type0 /BaseFont /${font.name} /Encoding /Identity-H ` +
				`/DescendantFonts [${cidId} 0 R] /ToUnicode ${toUnicodeId} 0 R >>`;
		}

		const imageIds = this.images.map(() => alloc());
		this.images.forEach((image, i) => {
			objects[imageIds[i]] =
				`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
				`/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\n` +
				`stream\n${latin1(image.bytes)}\nendstream`;
		});

		const fontResource = (['regular', 'bold'] as const)
			.map((w, i) => (fontIds[w] === undefined ? '' : `/F${i + 1} ${fontIds[w]} 0 R`))
			.filter(Boolean)
			.join(' ');
		const xobjects = this.images.length
			? ` /XObject << ${this.images.map((_, i) => `/Im${i + 1} ${imageIds[i]} 0 R`).join(' ')} >>`
			: '';

		const pageIds: number[] = [];
		for (const page of this.pages) {
			const pageId = alloc();
			const contentId = alloc();
			pageIds.push(pageId);
			const content = page
				.map((op) => (typeof op === 'string' ? op : this.render(op, embedded)))
				.join('\n');
			objects[pageId] =
				`<< /Type /Page /Parent ${pagesId} 0 R ` +
				`/MediaBox [0 0 ${round(this.size.width)} ${round(this.size.height)}] ` +
				`/Resources << /Font << ${fontResource} >>${xobjects} >> /Contents ${contentId} 0 R >>`;
			objects[contentId] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
		}

		objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
		objects[pagesId] =
			`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] ` +
			`/Count ${this.pages.length} >>`;

		let file = '%PDF-1.4\n';
		const offsets: number[] = [];
		for (let i = 1; i <= objects.length; i++) {
			offsets[i] = file.length;
			file += `${i} 0 obj\n${objects[i]}\nendobj\n`;
		}

		const xref = file.length;
		file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
		for (let i = 1; i <= objects.length; i++) {
			file += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
		}
		file += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

		// One character per byte by construction (see the file comment).
		const bytes = new Uint8Array(file.length);
		for (let i = 0; i < file.length; i++) bytes[i] = file.charCodeAt(i) & 0xff;
		return bytes;
	}

	/** One line of text as a content-stream operator, in the subset's glyph ids. */
	private render(op: TextOp, embedded: Partial<Record<Font, EmbeddedFont>>): string {
		const font = embedded[op.font];
		const hex = font ? font.encode(op.value) : '';
		return (
			`BT /F${op.font === 'bold' ? 2 : 1} ${op.size} Tf ${op.grey} g ` +
			`1 0 0 1 ${round(op.x)} ${round(this.size.height - op.y)} Tm <${hex}> Tj ET`
		);
	}
}

interface EmbeddedFont {
	/** `ABCDEF+NotoSans`, the subset name a PDF wants. */
	name: string;
	file: Uint8Array;
	widths: number[];
	toUnicode: string;
	bbox: number[];
	ascent: number;
	descent: number;
	capHeight: number;
	italicAngle: number;
	encode(text: string): string;
}

/** Cut the font to the code points used and describe it the way a PDF wants. */
function embed(font: TrueTypeFont, codePoints: Set<number>): EmbeddedFont {
	const question = font.glyphFor(0x3f);
	// A code point the font has no glyph for is printed as "?", which is visible
	// and obviously wrong, rather than as the empty box `.notdef` draws. The
	// locale test is what stops it reaching a user in the first place.
	const glyphOf = (cp: number): number => {
		const g = font.glyphFor(cp);
		return g === 0 ? question : g;
	};

	const glyphs = new Set<number>([question]);
	for (const cp of codePoints) glyphs.add(glyphOf(cp));
	const subset = subsetFont(font, glyphs);

	const scale = 1000 / font.unitsPerEm;
	const widths = subset.advances.map((w) => Math.round(w * scale));

	// New glyph id → the character it came from, for /ToUnicode. Built from the
	// code points actually written, which is exactly the set that needs it.
	//
	// A code point with no glyph maps to "?", not to itself: it is drawn as a
	// question mark, and a /ToUnicode saying otherwise would make the file claim
	// in copied text to contain letters that were never printed. Caught by
	// reading a proof sheet back with MuPDF, where "日本語" came out as "日日日"
	// — three question marks on the page, three copies of one character in the
	// text layer, because all three shared the substituted glyph.
	const toChar = new Map<number, number>();
	for (const cp of codePoints) {
		const g = subset.glyphMap.get(glyphOf(cp));
		if (g !== undefined && !toChar.has(g)) toChar.set(g, font.glyphFor(cp) === 0 ? 0x3f : cp);
	}

	const gid = (cp: number): number => subset.glyphMap.get(glyphOf(cp)) ?? 0;

	return {
		name: `${subsetTag(subset.glyphMap)}+NotoSans`,
		file: subset.bytes,
		widths,
		toUnicode: toUnicodeCMap(toChar),
		bbox: font.bbox.map((v) => Math.round(v * scale)),
		ascent: Math.round(font.ascent * scale),
		descent: Math.round(font.descent * scale),
		capHeight: Math.round(font.capHeight * scale),
		italicAngle: font.italicAngle,
		encode: (text) =>
			codePointsOf(text)
				.map((cp) => gid(cp).toString(16).padStart(4, '0').toUpperCase())
				.join('')
	};
}

/**
 * The six-letter tag a PDF puts in front of a subset's name. Derived from the
 * glyphs in the subset so two different subsets of one font cannot claim to be
 * the same font — and deterministic, so the same routine produces the same file.
 */
function subsetTag(glyphMap: Map<number, number>): string {
	let hash = 0x811c9dc5;
	for (const g of glyphMap.keys()) {
		hash ^= g;
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	let tag = '';
	for (let i = 0; i < 6; i++) {
		tag += String.fromCharCode(65 + (hash % 26));
		hash = Math.floor(hash / 26);
	}
	return tag;
}

/**
 * The map from glyph id back to character, so a reader can select and search
 * the text — and so the tests can read the file back in words rather than in
 * glyph numbers, which also proves the map is right.
 */
function toUnicodeCMap(toChar: Map<number, number>): string {
	const entries = [...toChar.entries()].sort((a, b) => a[0] - b[0]);
	const lines: string[] = [];
	// The format takes at most 100 mappings per block.
	for (let i = 0; i < entries.length; i += 100) {
		const chunk = entries.slice(i, i + 100);
		lines.push(`${chunk.length} beginbfchar`);
		for (const [glyph, cp] of chunk) {
			lines.push(
				`<${glyph.toString(16).padStart(4, '0').toUpperCase()}> ` +
					`<${utf16be(cp)}>`
			);
		}
		lines.push('endbfchar');
	}
	return [
		'/CIDInit /ProcSet findresource begin',
		'12 dict begin',
		'begincmap',
		'/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def',
		'/CMapName /Adobe-Identity-UCS def',
		'/CMapType 2 def',
		'1 begincodespacerange',
		'<0000> <FFFF>',
		'endcodespacerange',
		...lines,
		'endcmap',
		'CMapName currentdict /CMap defineresource pop',
		'end',
		'end'
	].join('\n');
}

/** A code point as UTF-16BE hex, which is what a /ToUnicode value is. */
function utf16be(cp: number): string {
	if (cp <= 0xffff) return cp.toString(16).padStart(4, '0').toUpperCase();
	const v = cp - 0x10000;
	const hi = 0xd800 + (v >> 10);
	const lo = 0xdc00 + (v & 0x3ff);
	return (
		hi.toString(16).padStart(4, '0').toUpperCase() + lo.toString(16).padStart(4, '0').toUpperCase()
	);
}

function round(n: number): string {
	return (Math.round(n * 100) / 100).toString();
}

/** Raw bytes as a one-char-per-byte string, in chunks so a big JPEG cannot blow the stack. */
function latin1(bytes: Uint8Array): string {
	let out = '';
	for (let i = 0; i < bytes.length; i += 8192) {
		out += String.fromCharCode(...bytes.subarray(i, i + 8192));
	}
	return out;
}

export { parseFont, type TrueTypeFont };
