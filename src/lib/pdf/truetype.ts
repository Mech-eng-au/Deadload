/**
 * Just enough TrueType to embed a font in a PDF (docs/SPEC.md §8, "Beyond
 * Latin-1").
 *
 * The PDF writer used the base-14 Helvetica, which every reader already has and
 * which costs nothing to use — but its WinAnsi encoding is Latin-1, so `ł`, `ř`,
 * `ş`, `α` and `д` came out as `?`. That was fine while the app was English and
 * survivable while it was English and Danish; it is not a foundation to add a
 * third language on, because the failure is silent and lands on paper.
 *
 * So the sheet embeds a font, and to keep that affordable the font is cut down
 * twice with the same code:
 *
 * 1. **At build time** (`scripts/subset-font.ts`) the full Noto Sans is reduced
 *    to a declared repertoire — Latin, Greek, Cyrillic — and committed. That is
 *    what the APK carries.
 * 2. **At PDF time** the committed subset is cut again to the glyphs the
 *    document actually uses, which is what the reader downloads or emails.
 *
 * Pure per §15: `Uint8Array` in, `Uint8Array` out, no DOM. Reading the font file
 * off disk or out of the bundle is `./fonts.ts`, which is this feature's
 * equivalent of `./images.ts`.
 *
 * Only the tables a PDF actually needs are understood: `head`, `hhea`, `maxp`,
 * `hmtx`, `loca`, `glyf`, `cmap` and `OS/2`. Hinting, kerning and layout tables
 * are dropped — a PDF reader does not run them, and they are most of the file.
 */

/** The tables carried through into a subset, in the order they are written. */
const KEPT_TABLES = ['OS/2', 'cmap', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp'] as const;

/** Composite glyph flags. Only the ones that change a component's length. */
const ARG_1_AND_2_ARE_WORDS = 0x0001;
const WE_HAVE_A_SCALE = 0x0008;
const MORE_COMPONENTS = 0x0020;
const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
const WE_HAVE_A_TWO_BY_TWO = 0x0080;

export interface TrueTypeFont {
	/** The whole file, kept so the subsetter can copy glyph data out of it. */
	readonly bytes: Uint8Array;
	/** Design units per em — 1000 in the PDF's own units, 1000 or 2048 here. */
	readonly unitsPerEm: number;
	readonly numGlyphs: number;
	/** Glyph id for a code point, or 0 (`.notdef`) for one the font lacks. */
	glyphFor(codePoint: number): number;
	/** Advance width in design units. */
	advance(glyph: number): number;
	/** Metrics the PDF's `/FontDescriptor` has to state. */
	readonly ascent: number;
	readonly descent: number;
	readonly capHeight: number;
	readonly bbox: [number, number, number, number];
	readonly italicAngle: number;
	/** Every code point the font can actually draw, for the build-time cut. */
	codePoints(): number[];
}

class Reader {
	constructor(private readonly b: Uint8Array) {}
	u8(p: number): number {
		return this.b[p];
	}
	u16(p: number): number {
		return (this.b[p] << 8) | this.b[p + 1];
	}
	i16(p: number): number {
		const v = this.u16(p);
		return v >= 0x8000 ? v - 0x10000 : v;
	}
	u32(p: number): number {
		return (
			((this.b[p] << 24) | (this.b[p + 1] << 16) | (this.b[p + 2] << 8) | this.b[p + 3]) >>> 0
		);
	}
	tag(p: number): string {
		return String.fromCharCode(this.b[p], this.b[p + 1], this.b[p + 2], this.b[p + 3]);
	}
}

interface Table {
	offset: number;
	length: number;
}

/**
 * Read the parts of a font this module cares about. Throws on anything it
 * cannot make sense of, because a font that fails to parse is a build error
 * rather than a sheet with no letters on it.
 */
export function parseFont(bytes: Uint8Array): TrueTypeFont {
	const r = new Reader(bytes);
	const version = r.u32(0);
	// 0x00010000 is a plain TrueType file; "true" is the old Apple tag. An OTF
	// with CFF outlines ("OTTO") has no `glyf` and is not supported: cutting up
	// PostScript outlines is a different exercise entirely.
	if (version !== 0x00010000 && r.tag(0) !== 'true') {
		throw new Error(`not a TrueType font (sfnt version ${version.toString(16)})`);
	}

	const numTables = r.u16(4);
	const tables = new Map<string, Table>();
	for (let i = 0; i < numTables; i++) {
		const p = 12 + i * 16;
		tables.set(r.tag(p), { offset: r.u32(p + 8), length: r.u32(p + 12) });
	}

	const need = (tag: string): Table => {
		const t = tables.get(tag);
		if (!t) throw new Error(`font has no ${tag} table`);
		return t;
	};

	const head = need('head');
	const unitsPerEm = r.u16(head.offset + 18);
	const indexToLocFormat = r.i16(head.offset + 50);
	const bbox: [number, number, number, number] = [
		r.i16(head.offset + 36),
		r.i16(head.offset + 38),
		r.i16(head.offset + 40),
		r.i16(head.offset + 42)
	];

	const maxp = need('maxp');
	const numGlyphs = r.u16(maxp.offset + 4);

	const hhea = need('hhea');
	const ascent = r.i16(hhea.offset + 4);
	const descent = r.i16(hhea.offset + 6);
	const numberOfHMetrics = r.u16(hhea.offset + 34);

	const hmtx = need('hmtx');
	const advances = new Int32Array(numGlyphs);
	let last = 0;
	for (let g = 0; g < numGlyphs; g++) {
		if (g < numberOfHMetrics) last = r.u16(hmtx.offset + g * 4);
		advances[g] = last;
	}

	const os2 = tables.get('OS/2');
	// sCapHeight only exists from version 2. Below that, the ascender is a
	// serviceable stand-in — it is only used for the font descriptor, which
	// readers consult for substitution and we are not asking them to substitute.
	const capHeight =
		os2 && r.u16(os2.offset) >= 2 ? r.i16(os2.offset + 88) : Math.round(ascent * 0.7);

	const post = tables.get('post');
	const italicAngle = post ? r.u32(post.offset + 4) : 0;

	const cmap = readCmap(r, need('cmap'));

	return {
		bytes,
		unitsPerEm,
		numGlyphs,
		glyphFor: (cp) => cmap.get(cp) ?? 0,
		advance: (g) => advances[g] ?? 0,
		ascent,
		descent,
		capHeight,
		bbox,
		// A 16.16 fixed-point value; every font we ship is upright, so this is 0
		// in practice and the arithmetic is here for completeness.
		italicAngle: italicAngle === 0 ? 0 : (italicAngle | 0) / 65536,
		codePoints: () => [...cmap.keys()].sort((a, b) => a - b)
	};
}

/**
 * Code point → glyph id. Formats 4 and 12 only: 4 is the Basic Multilingual
 * Plane, which is every alphabet this app can set type in, and 12 is what a
 * modern font uses when it has anything above it.
 */
function readCmap(r: Reader, table: Table): Map<number, number> {
	const n = r.u16(table.offset + 2);
	let best = -1;
	let bestScore = -1;
	for (let i = 0; i < n; i++) {
		const p = table.offset + 4 + i * 8;
		const platform = r.u16(p);
		const encoding = r.u16(p + 2);
		const sub = table.offset + r.u32(p + 4);
		// Prefer a full Unicode table, then the BMP one, then anything Windows.
		const score =
			(platform === 3 && encoding === 10) || (platform === 0 && encoding >= 4)
				? 3
				: (platform === 3 && encoding === 1) || platform === 0
					? 2
					: 1;
		if (score > bestScore) {
			bestScore = score;
			best = sub;
		}
	}
	if (best < 0) throw new Error('font has no usable cmap subtable');

	const map = new Map<number, number>();
	const format = r.u16(best);
	if (format === 4) {
		const segCount = r.u16(best + 6) / 2;
		const ends = best + 14;
		const starts = ends + segCount * 2 + 2;
		const deltas = starts + segCount * 2;
		const ranges = deltas + segCount * 2;
		for (let s = 0; s < segCount; s++) {
			const end = r.u16(ends + s * 2);
			const start = r.u16(starts + s * 2);
			const delta = r.i16(deltas + s * 2);
			const rangeOffset = r.u16(ranges + s * 2);
			if (start > end) continue;
			for (let cp = start; cp <= end && cp !== 0x10000; cp++) {
				let g: number;
				if (rangeOffset === 0) {
					g = (cp + delta) & 0xffff;
				} else {
					const at = ranges + s * 2 + rangeOffset + (cp - start) * 2;
					g = r.u16(at);
					if (g !== 0) g = (g + delta) & 0xffff;
				}
				if (g !== 0) map.set(cp, g);
			}
		}
	} else if (format === 12) {
		const groups = r.u32(best + 12);
		for (let g = 0; g < groups; g++) {
			const p = best + 16 + g * 12;
			const start = r.u32(p);
			const end = r.u32(p + 4);
			const startGlyph = r.u32(p + 8);
			for (let cp = start; cp <= end; cp++) map.set(cp, startGlyph + (cp - start));
		}
	} else {
		throw new Error(`unsupported cmap format ${format}`);
	}
	return map;
}

/** Where each glyph's outline sits in `glyf`, read through `loca`. */
function locations(font: TrueTypeFont): { glyf: Table; loca: number[] } {
	const r = new Reader(font.bytes);
	const numTables = r.u16(4);
	let glyf: Table | undefined;
	let loca: Table | undefined;
	let head: Table | undefined;
	for (let i = 0; i < numTables; i++) {
		const p = 12 + i * 16;
		const tag = r.tag(p);
		const t = { offset: r.u32(p + 8), length: r.u32(p + 12) };
		if (tag === 'glyf') glyf = t;
		else if (tag === 'loca') loca = t;
		else if (tag === 'head') head = t;
	}
	if (!glyf || !loca || !head) throw new Error('font is missing glyf, loca or head');
	const long = r.i16(head.offset + 50) === 1;
	const offsets: number[] = [];
	for (let g = 0; g <= font.numGlyphs; g++) {
		offsets.push(long ? r.u32(loca.offset + g * 4) : r.u16(loca.offset + g * 2) * 2);
	}
	return { glyf, loca: offsets };
}

/**
 * Every glyph a set of glyphs depends on. A composite glyph — `å` is `a` plus a
 * ring — refers to other glyphs by id, so dropping one of those leaves a letter
 * with a hole in it. Recursive, because a component can itself be composite.
 */
function withComponents(font: TrueTypeFont, wanted: Iterable<number>): Set<number> {
	const { glyf, loca } = locations(font);
	const r = new Reader(font.bytes);
	const out = new Set<number>([0]); // .notdef is always glyph 0 and always kept
	const queue = [...wanted];

	while (queue.length) {
		const g = queue.pop()!;
		if (g < 0 || g >= font.numGlyphs || out.has(g)) continue;
		out.add(g);

		const start = glyf.offset + loca[g];
		if (loca[g + 1] <= loca[g]) continue; // a blank glyph, e.g. the space
		if (r.i16(start) >= 0) continue; // simple outline, nothing to follow

		let p = start + 10;
		for (;;) {
			const flags = r.u16(p);
			queue.push(r.u16(p + 2));
			p += 4;
			p += flags & ARG_1_AND_2_ARE_WORDS ? 4 : 2;
			if (flags & WE_HAVE_A_SCALE) p += 2;
			else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) p += 4;
			else if (flags & WE_HAVE_A_TWO_BY_TWO) p += 8;
			if (!(flags & MORE_COMPONENTS)) break;
		}
	}
	return out;
}

export interface Subset {
	/** A valid TrueType file holding only the glyphs asked for. */
	bytes: Uint8Array;
	/** Old glyph id → new glyph id, for whoever writes the text. */
	glyphMap: Map<number, number>;
	/** Advance widths in the new glyph order, in design units. */
	advances: number[];
}

/**
 * Cut a font down to the glyphs given, renumbering them from zero.
 *
 * Renumbering is what makes the result small — a font with 3,000 glyphs needs a
 * 12 kB `loca` table even if 2,900 of the entries are empty — and it is why the
 * caller gets a `glyphMap` back rather than being able to keep using the old
 * ids.
 */
export function subsetFont(font: TrueTypeFont, glyphs: Iterable<number>): Subset {
	const keep = [...withComponents(font, glyphs)].sort((a, b) => a - b);
	const glyphMap = new Map<number, number>(keep.map((g, i) => [g, i]));
	const { glyf, loca } = locations(font);

	// ------------------------------------------------------------------- glyf
	const parts: Uint8Array[] = [];
	const newLoca: number[] = [];
	let at = 0;
	for (const g of keep) {
		newLoca.push(at);
		const from = loca[g];
		const to = loca[g + 1];
		if (to <= from) continue;

		const data = font.bytes.slice(glyf.offset + from, glyf.offset + to);
		// A composite glyph names its components by id, so every one of those ids
		// has to be rewritten to the component's new number.
		if (new Reader(data).i16(0) < 0) renumberComponents(data, glyphMap);
		// Glyph data is padded to a multiple of four, which keeps every offset in
		// `loca` aligned and is what the format expects.
		const padded = data.length % 4 === 0 ? data : pad(data, 4);
		parts.push(padded);
		at += padded.length;
	}
	newLoca.push(at);
	const glyfTable = concat(parts);

	// ------------------------------------------------------------------- loca
	// Always the long form: short `loca` stores offset/2 and so cannot express an
	// odd offset, and the saving is a few hundred bytes on a table this size.
	const locaTable = new Uint8Array(newLoca.length * 4);
	const locaView = new DataView(locaTable.buffer);
	newLoca.forEach((o, i) => locaView.setUint32(i * 4, o));

	// ------------------------------------------------------------------- hmtx
	const advances = keep.map((g) => font.advance(g));
	const hmtxTable = new Uint8Array(keep.length * 4);
	const hmtxView = new DataView(hmtxTable.buffer);
	advances.forEach((w, i) => hmtxView.setUint16(i * 4, w));

	// ------------------------------------------------ head, hhea, maxp, OS/2
	const head = copyTable(font, 'head');
	new DataView(head.buffer, head.byteOffset).setInt16(50, 1); // long loca
	new DataView(head.buffer, head.byteOffset).setUint32(8, 0); // checkSumAdjustment

	const hhea = copyTable(font, 'hhea');
	new DataView(hhea.buffer, hhea.byteOffset).setUint16(34, keep.length); // numberOfHMetrics

	const maxp = copyTable(font, 'maxp');
	new DataView(maxp.buffer, maxp.byteOffset).setUint16(4, keep.length); // numGlyphs

	const built = new Map<string, Uint8Array>([
		['cmap', buildCmap(font, glyphMap)],
		['glyf', glyfTable],
		['head', head],
		['hhea', hhea],
		['hmtx', hmtxTable],
		['loca', locaTable],
		['maxp', maxp]
	]);
	const os2 = tryCopyTable(font, 'OS/2');
	if (os2) built.set('OS/2', os2);

	return { bytes: assemble(built), glyphMap, advances };
}

/** Rewrite a composite glyph's component ids in place. */
function renumberComponents(data: Uint8Array, glyphMap: Map<number, number>): void {
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	let p = 10;
	for (;;) {
		const flags = view.getUint16(p);
		const component = view.getUint16(p + 2);
		view.setUint16(p + 2, glyphMap.get(component) ?? 0);
		p += 4;
		p += flags & ARG_1_AND_2_ARE_WORDS ? 4 : 2;
		if (flags & WE_HAVE_A_SCALE) p += 2;
		else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) p += 4;
		else if (flags & WE_HAVE_A_TWO_BY_TWO) p += 8;
		if (!(flags & MORE_COMPONENTS)) break;
	}
}

/**
 * A format 4 `cmap` for the subset.
 *
 * A PDF does not read it — the text is written as glyph ids and `CIDToGIDMap`
 * is `/Identity` — but the build-time subset is parsed again by the PDF-time
 * subset, and that lookup goes through the cmap. It also means the committed
 * file is a real font that can be opened and looked at.
 */
function buildCmap(font: TrueTypeFont, glyphMap: Map<number, number>): Uint8Array {
	const pairs: [number, number][] = [];
	for (const cp of font.codePoints()) {
		if (cp > 0xffff) continue;
		const g = glyphMap.get(font.glyphFor(cp));
		if (g !== undefined) pairs.push([cp, g]);
	}
	pairs.sort((a, b) => a[0] - b[0]);

	// One segment per run of consecutive code points whose glyphs are also
	// consecutive, which is what `idDelta` can describe without a glyph array.
	const segments: { start: number; end: number; delta: number }[] = [];
	for (const [cp, g] of pairs) {
		const last = segments[segments.length - 1];
		if (last && cp === last.end + 1 && ((g - cp) & 0xffff) === last.delta) last.end = cp;
		else segments.push({ start: cp, end: cp, delta: (g - cp) & 0xffff });
	}
	// The format requires a final segment ending at 0xFFFF mapping to nothing.
	segments.push({ start: 0xffff, end: 0xffff, delta: 1 });

	const segCount = segments.length;
	const subtableLength = 16 + segCount * 8;
	const out = new Uint8Array(4 + 8 + subtableLength);
	const v = new DataView(out.buffer);
	v.setUint16(0, 0); // version
	v.setUint16(2, 1); // one encoding record
	v.setUint16(4, 3); // Windows
	v.setUint16(6, 1); // Unicode BMP
	v.setUint32(8, 12); // offset to the subtable

	let p = 12;
	v.setUint16(p, 4);
	v.setUint16(p + 2, subtableLength);
	v.setUint16(p + 4, 0); // language
	v.setUint16(p + 6, segCount * 2);
	const entrySelector = Math.floor(Math.log2(segCount));
	v.setUint16(p + 8, 2 ** entrySelector * 2); // searchRange
	v.setUint16(p + 10, entrySelector);
	v.setUint16(p + 12, segCount * 2 - 2 ** entrySelector * 2); // rangeShift

	const ends = p + 14;
	const starts = ends + segCount * 2 + 2;
	const deltas = starts + segCount * 2;
	const ranges = deltas + segCount * 2;
	segments.forEach((s, i) => {
		v.setUint16(ends + i * 2, s.end);
		v.setUint16(starts + i * 2, s.start);
		v.setUint16(deltas + i * 2, s.delta);
		v.setUint16(ranges + i * 2, 0);
	});
	return out;
}

function copyTable(font: TrueTypeFont, tag: string): Uint8Array {
	const t = tryCopyTable(font, tag);
	if (!t) throw new Error(`font has no ${tag} table`);
	return t;
}

function tryCopyTable(font: TrueTypeFont, tag: string): Uint8Array | undefined {
	const r = new Reader(font.bytes);
	const numTables = r.u16(4);
	for (let i = 0; i < numTables; i++) {
		const p = 12 + i * 16;
		if (r.tag(p) !== tag) continue;
		const offset = r.u32(p + 8);
		return font.bytes.slice(offset, offset + r.u32(p + 12));
	}
	return undefined;
}

/** Table directory plus the tables, with the checksums the format asks for. */
function assemble(tables: Map<string, Uint8Array>): Uint8Array {
	const tags = KEPT_TABLES.filter((t) => tables.has(t));
	const numTables = tags.length;
	const entrySelector = Math.floor(Math.log2(numTables));
	const searchRange = 2 ** entrySelector * 16;

	const header = new Uint8Array(12 + numTables * 16);
	const hv = new DataView(header.buffer);
	hv.setUint32(0, 0x00010000);
	hv.setUint16(4, numTables);
	hv.setUint16(6, searchRange);
	hv.setUint16(8, entrySelector);
	hv.setUint16(10, numTables * 16 - searchRange);

	const parts: Uint8Array[] = [header];
	let offset = header.length;
	tags.forEach((tag, i) => {
		const data = tables.get(tag)!;
		const padded = data.length % 4 === 0 ? data : pad(data, 4);
		const p = 12 + i * 16;
		for (let c = 0; c < 4; c++) header[p + c] = tag.charCodeAt(c);
		hv.setUint32(p + 4, checksum(padded));
		hv.setUint32(p + 8, offset);
		hv.setUint32(p + 12, data.length);
		parts.push(padded);
		offset += padded.length;
	});

	const file = concat(parts);
	// `head.checkSumAdjustment` is a checksum of the whole file, so it can only
	// be filled in once the file exists.
	const headIndex = tags.indexOf('head');
	if (headIndex >= 0) {
		const headOffset = new DataView(file.buffer, file.byteOffset).getUint32(
			12 + headIndex * 16 + 8
		);
		new DataView(file.buffer, file.byteOffset).setUint32(
			headOffset + 8,
			(0xb1b0afba - checksum(file)) >>> 0
		);
	}
	return file;
}

function checksum(data: Uint8Array): number {
	let sum = 0;
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	for (let i = 0; i + 4 <= data.length; i += 4) sum = (sum + view.getUint32(i)) >>> 0;
	return sum;
}

function pad(data: Uint8Array, to: number): Uint8Array {
	const out = new Uint8Array(Math.ceil(data.length / to) * to);
	out.set(data);
	return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
	const total = parts.reduce((n, p) => n + p.length, 0);
	const out = new Uint8Array(total);
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.length;
	}
	return out;
}
