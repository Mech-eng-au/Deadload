import { parseFont, type TrueTypeFont } from './truetype.js';
import type { PdfFonts } from './writer.js';

/**
 * Getting the font off disk (docs/SPEC.md §8, "Beyond Latin-1").
 *
 * The second half of the PDF code that touches the platform, beside `./images.ts`,
 * and here for the same reason: the writer and the sheet are pure and take bytes
 * as arguments, so something has to go and fetch them.
 *
 * The two weights are committed as `.ttf` files by `scripts/build-fonts.ts` and
 * imported with Vite's `?url`, which leaves them as separate assets rather than
 * inlining 220 kB of base64 into the JavaScript. In the APK they are files inside
 * the package served from the local origin, so this `fetch` never touches a
 * network — the same arrangement the catalog media already relies on.
 *
 * Parsed once and cached: the tables are read on first print and the result is
 * reused, because a routine printed twice should not parse the font twice.
 */
import regularUrl from './fonts/noto-sans-regular.ttf?url';
import boldUrl from './fonts/noto-sans-bold.ttf?url';

let cached: Promise<PdfFonts> | undefined;

async function load(url: string): Promise<TrueTypeFont> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${response.status} for ${url}`);
	return parseFont(new Uint8Array(await response.arrayBuffer()));
}

export function sheetFonts(): Promise<PdfFonts> {
	cached ??= Promise.all([load(regularUrl), load(boldUrl)]).then(([regular, bold]) => ({
		regular,
		bold
	}));
	return cached;
}
