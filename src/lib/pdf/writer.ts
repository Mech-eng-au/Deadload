/**
 * A very small PDF writer (docs/SPEC.md §8, "A routine on paper").
 *
 * Enough to put text, rules and boxes on A4 pages, and nothing else. Written by
 * hand rather than pulled from npm because the whole feature is a page of text: a
 * PDF library is several hundred kilobytes of font machinery to draw a list, and
 * this app ships inside an APK that has to work in airplane mode.
 *
 * Two things make that cheap. The **base-14 fonts** — Helvetica and
 * Helvetica-Bold — are built into every PDF reader, so nothing has to be
 * embedded. And the file is assembled as a string of **one character per byte**,
 * so the cross-reference table's offsets are just string lengths: text is written
 * with everything above 126 escaped octally, and the only real binary in the file
 * is the JPEG of a photograph, which a PDF stores verbatim.
 *
 * Pure, per §15: no DOM, no Blob, no Capacitor. It returns bytes and the caller
 * decides what to do with them.
 */

export interface PageSize {
	width: number;
	height: number;
}

/** A4 in PostScript points, which is the only unit a PDF has. */
export const A4: PageSize = { width: 595.28, height: 841.89 };

export type Font = 'regular' | 'bold';

/**
 * Adobe's metrics for the two base-14 fonts, in 1/1000 em, for ASCII 32–126.
 * Only ever used to decide where a line wraps, so a wrong entry would cost a
 * slightly early or late break rather than a broken document.
 */
const WIDTHS: Record<Font, number[]> = {
	regular: [
		278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
		556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667,
		611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
		667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500,
		222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
	],
	bold: [
		278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556,
		556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667,
		611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667,
		667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556,
		278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584
	]
};

/**
 * Unicode the app actually writes that WinAnsi keeps somewhere other than its own
 * code point. The dashes and the middle dot come from `describeItem`, the quotes
 * from anything a user typed on a phone.
 */
const WIN_ANSI: Record<string, number> = {
	'€': 0x80,
	'‚': 0x82,
	'ƒ': 0x83,
	'„': 0x84,
	'…': 0x85,
	'†': 0x86,
	'‡': 0x87,
	'ˆ': 0x88,
	'‰': 0x89,
	'‹': 0x8b,
	'‘': 0x91,
	'’': 0x92,
	'“': 0x93,
	'”': 0x94,
	'•': 0x95,
	'–': 0x96,
	'—': 0x97,
	'™': 0x99,
	'›': 0x9b
};

/** Characters with no WinAnsi byte at all, spelled out rather than dropped. */
const TRANSLITERATE: Record<string, string> = {
	'→': '->',
	'←': '<-',
	'≤': '<=',
	'≥': '>=',
	'≡': '=',
	'″': '"',
	'′': "'"
};

/** One WinAnsi byte per character, or -1 for something this font cannot say. */
function winAnsi(ch: string): number {
	const code = ch.codePointAt(0)!;
	if (code >= 32 && code <= 126) return code;
	if (WIN_ANSI[ch] !== undefined) return WIN_ANSI[ch];
	// 0xA0–0xFF is Latin-1, which WinAnsi keeps: the accented letters, ×, ·, °.
	if (code >= 0xa0 && code <= 0xff) return code;
	return -1;
}

/**
 * A PDF string literal: ASCII stays as it is, everything else becomes an octal
 * escape, and `(`, `)` and `\` are escaped because they delimit the literal.
 */
export function pdfString(text: string): string {
	let out = '';
	for (const ch of expand(text)) {
		const byte = winAnsi(ch);
		if (byte < 0) {
			out += '?';
		} else if (ch === '(' || ch === ')' || ch === '\\') {
			out += '\\' + ch;
		} else if (byte >= 32 && byte <= 126) {
			out += ch;
		} else {
			out += '\\' + byte.toString(8).padStart(3, '0');
		}
	}
	return out;
}

/** Characters spelled out before encoding, so "→" survives as "->". */
function expand(text: string): string {
	let out = '';
	for (const ch of text) out += TRANSLITERATE[ch] ?? ch;
	return out;
}

/** Width of a string at a given size, in points. */
export function textWidth(text: string, size: number, font: Font = 'regular'): number {
	let mils = 0;
	for (const ch of expand(text)) {
		const byte = winAnsi(ch);
		// Anything outside the metric table is measured as the letter it most
		// resembles in width: accented capitals are their base letter's width.
		const index = byte >= 32 && byte <= 126 ? byte - 32 : 'n'.charCodeAt(0) - 32;
		mils += WIDTHS[font][index];
	}
	return (mils * size) / 1000;
}

/**
 * Break text into lines that fit `maxWidth`, on spaces where possible. A single
 * word longer than the line is cut mid-word rather than allowed to run off the
 * page — a URL in a note should look wrong, not disappear into the margin.
 */
export function wrapText(text: string, size: number, maxWidth: number, font: Font = 'regular'): string[] {
	const lines: string[] = [];
	for (const paragraph of text.split('\n')) {
		let line = '';
		for (const word of paragraph.split(/\s+/).filter(Boolean)) {
			const candidate = line ? `${line} ${word}` : word;
			if (textWidth(candidate, size, font) <= maxWidth) {
				line = candidate;
				continue;
			}
			if (line) lines.push(line);
			line = word;
			while (textWidth(line, size, font) > maxWidth && line.length > 1) {
				let cut = line.length;
				while (cut > 1 && textWidth(line.slice(0, cut), size, font) > maxWidth) cut--;
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

/**
 * A document being built. Coordinates are given with **y measured down from the
 * top of the page**, which is how the layout above thinks, and flipped on the way
 * into the content stream.
 */
export class PdfDoc {
	readonly size: PageSize;
	private pages: string[] = [];
	private current: string[] = [];
	private images: JpegImage[] = [];
	private imageNames = new Map<JpegImage, string>();

	constructor(size: PageSize = A4) {
		this.size = size;
	}

	/** Finish the current page and start a blank one. */
	newPage(): void {
		if (this.current.length) this.pages.push(this.current.join('\n'));
		this.current = [];
	}

	get pageCount(): number {
		return this.pages.length + (this.current.length ? 1 : 0);
	}

	text(x: number, y: number, value: string, options: TextOptions = {}): void {
		const { size = 10, font = 'regular', grey = 0 } = options;
		this.current.push(
			`BT /F${font === 'bold' ? 2 : 1} ${size} Tf ${grey} g ` +
				`1 0 0 1 ${round(x)} ${round(this.size.height - y)} Tm (${pdfString(value)}) Tj ET`
		);
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

	/** An empty box, for ticking with a pen. */
	box(x: number, y: number, w: number, h: number, width = 0.6, grey = 0.45): void {
		this.current.push(
			`${grey} G ${width} w ${round(x)} ${round(this.size.height - y - h)} ${round(w)} ${round(h)} re S`
		);
	}

	/** The whole file. Every offset in the cross-reference table is a byte count. */
	bytes(): Uint8Array {
		if (this.current.length) {
			this.pages.push(this.current.join('\n'));
			this.current = [];
		}
		if (!this.pages.length) this.pages.push('');

		const objects: string[] = [];
		const firstImageId = 5;
		const pageIds = this.pages.map((_, i) => firstImageId + this.images.length + i * 2);

		objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
		objects[2] =
			`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] ` +
			`/Count ${this.pages.length} >>`;
		objects[3] =
			'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
		objects[4] =
			'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

		this.images.forEach((image, i) => {
			const id = firstImageId + i;
			objects[id] =
				`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
				`/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\n` +
				`stream\n${latin1(image.bytes)}\nendstream`;
		});

		const xobjects = this.images.length
			? ` /XObject << ${this.images
					.map((_, i) => `/Im${i + 1} ${firstImageId + i} 0 R`)
					.join(' ')} >>`
			: '';

		this.pages.forEach((content, i) => {
			const id = pageIds[i];
			objects[id] =
				`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${round(this.size.width)} ${round(this.size.height)}] ` +
				`/Resources << /Font << /F1 3 0 R /F2 4 0 R >>${xobjects} >> /Contents ${id + 1} 0 R >>`;
			objects[id + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
		});

		let file = '%PDF-1.4\n';
		const offsets: number[] = [];
		for (let i = 1; i < objects.length; i++) {
			offsets[i] = file.length;
			file += `${i} 0 obj\n${objects[i]}\nendobj\n`;
		}

		const xref = file.length;
		file += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
		for (let i = 1; i < objects.length; i++) {
			file += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
		}
		file += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

		// One character per byte by construction (see the file comment).
		const bytes = new Uint8Array(file.length);
		for (let i = 0; i < file.length; i++) bytes[i] = file.charCodeAt(i) & 0xff;
		return bytes;
	}
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
