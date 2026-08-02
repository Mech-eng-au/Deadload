/**
 * Font build script (docs/SPEC.md §8, "Beyond Latin-1"). Run with
 * `npm run build:fonts`.
 *
 * Pulls Noto Sans, cuts it down to a declared repertoire, and writes two
 * committed `.ttf` files that the printable sheet embeds. Run by hand and the
 * output committed, exactly like `build-catalog.ts` and for the same reason:
 * the app has to build with no network.
 *
 * Deterministic: same inputs produce byte-identical output.
 *
 * **Why a repertoire rather than the whole font.** Noto Sans latin-greek-cyrillic
 * is 621 kB per weight, and the sheet needs two weights — 1.25 MB of an APK with
 * about 2.2 MB of headroom under §11's budget. Almost all of that is glyphs for
 * alphabets, and hinting and layout tables a PDF reader never executes. Cutting
 * to the alphabets the app could plausibly be translated into, before anything
 * is translated into them, is what makes "add a language" a file rather than a
 * negotiation about size.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFont, subsetFont } from '../src/lib/pdf/truetype.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/lib/pdf/fonts');

const BASE = 'https://raw.githubusercontent.com/notofonts/notofonts.github.io/main/fonts/NotoSans/hinted/ttf/';
const LICENSE_URL = 'https://raw.githubusercontent.com/notofonts/latin-greek-cyrillic/main/OFL.txt';

const WEIGHTS = [
	{ file: 'NotoSans-Regular.ttf', out: 'noto-sans-regular.ttf' },
	{ file: 'NotoSans-Bold.ttf', out: 'noto-sans-bold.ttf' }
];

/**
 * What the shipped font is able to say.
 *
 * The interface languages are English and Danish, so Latin-1 alone would do
 * today. The point of the wider set is that it is decided **once**, here, in a
 * place where the cost is visible — rather than being discovered by whoever
 * adds Polish, on paper, as a row of question marks.
 *
 * Each range is here because some plausible interface language needs it. What
 * is deliberately absent is as much the decision as what is present: no CJK, no
 * Arabic, no Hebrew, no Devanagari. Those are tens of thousands of glyphs, or a
 * text shaper this writer does not have, or both — and Arabic and Hebrew also
 * need the right-to-left layout §16 declines. A language needing one of those
 * is a project, not a file, and the test in `tests/pdf.test.ts` says so out loud
 * rather than letting it fail quietly.
 */
const REPERTOIRE: [number, number][] = [
	[0x0020, 0x007e], // ASCII
	[0x00a0, 0x00ff], // Latin-1: Danish, German, French, Spanish, Nordic
	[0x0100, 0x017f], // Latin Extended-A: Polish, Czech, Hungarian, Turkish, Baltic
	[0x0180, 0x024f], // Latin Extended-B: Romanian, Vietnamese bases, African Latin
	[0x0370, 0x03ff], // Greek
	[0x0400, 0x04ff], // Cyrillic: Russian, Ukrainian, Bulgarian, Serbian
	[0x2010, 0x203a], // the dashes, quotes, bullet and ellipsis the app writes
	[0x20ac, 0x20ac], // euro
	[0x2122, 0x2122], // trade mark
	[0x2190, 0x2193], // arrows, which `writer.ts` spells out but may not always
	[0x2212, 0x2212], // minus
	[0x2264, 0x2265], // <= and >=
	[0x00d7, 0x00d7] // multiplication sign, used by `describeItem`
];

function repertoire(): number[] {
	const out: number[] = [];
	for (const [from, to] of REPERTOIRE) {
		for (let cp = from; cp <= to; cp++) out.push(cp);
	}
	return out;
}

async function download(url: string): Promise<Uint8Array> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url} → ${res.status}`);
	return new Uint8Array(await res.arrayBuffer());
}

async function main(): Promise<void> {
	await mkdir(OUT, { recursive: true });
	const wanted = repertoire();

	for (const weight of WEIGHTS) {
		const full = await download(BASE + weight.file);
		const font = parseFont(full);

		const glyphs = new Set<number>();
		let missing = 0;
		for (const cp of wanted) {
			const g = font.glyphFor(cp);
			if (g === 0) missing++;
			else glyphs.add(g);
		}

		const subset = subsetFont(font, glyphs);
		await writeFile(join(OUT, weight.out), subset.bytes);

		const pct = ((subset.bytes.length / full.length) * 100).toFixed(1);
		console.log(
			`${weight.out}: ${(full.length / 1024).toFixed(0)} kB → ${(subset.bytes.length / 1024).toFixed(0)} kB ` +
				`(${pct}%), ${subset.glyphMap.size} glyphs, ${missing} code points the font does not have`
		);
	}

	// The SIL Open Font License requires its text to travel with the font.
	const license = await download(LICENSE_URL);
	await writeFile(join(OUT, 'OFL.txt'), license);
	console.log(`OFL.txt: ${(license.length / 1024).toFixed(1)} kB`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
