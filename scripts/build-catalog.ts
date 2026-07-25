/**
 * Catalog build script (docs/SPEC.md §5). Run with `npm run build:catalog`.
 *
 * Pulls free-exercise-db, filters to the bodyweight pool, applies the
 * curation in scripts/curation.yaml, downloads and converts images to WebP,
 * and emits src/lib/catalog/{catalog,attribution}.json plus static/media/**.
 *
 * Deterministic: same inputs produce byte-identical output.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { parse as parseYaml } from 'yaml';
import type { Attribution, Exercise, MediaAsset } from '../src/lib/types.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_JSON = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
// NOTE: images live under main/exercises/, NOT main/dist/exercises/ (verified, see docs/M0-findings.md)
const IMAGE_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
const CATALOG_CAP = 125; // spec says "roughly 120"; hard error above this
const MAX_EDGE = 800;
const WEBP_QUALITY = 80;
// Mean per-pixel difference (0-255) below which two frames count as the same
// photo. Genuinely distinct frames in this source score 4 and up; re-used
// photographs score 0.
const DUPLICATE_THRESHOLD = 1.5;

interface SourceExercise {
	id: string;
	name: string;
	force: string | null;
	level: 'beginner' | 'intermediate' | 'expert';
	mechanic: string | null;
	equipment: string | null;
	primaryMuscles: string[];
	secondaryMuscles: string[];
	instructions: string[];
	category: string;
	images: string[];
}

interface Curation {
	include: string[];
	exclude: string[];
	mobility: string[];
	unilateral: string[];
}

function slugify(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/['’]/g, '') // "world's" -> "worlds", not "world_s"
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function normalizeAlias(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Downscaled greyscale fingerprint, used to spot re-used photographs. */
async function signature(webp: Buffer): Promise<Buffer> {
	return sharp(webp).resize(64, 64, { fit: 'fill' }).greyscale().raw().toBuffer();
}

function meanAbsDiff(a: Buffer, b: Buffer): number {
	let sum = 0;
	for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
	return sum / a.length;
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
	return res.json() as Promise<T>;
}

async function fetchWithRetry(url: string, tries = 3): Promise<ArrayBuffer> {
	let lastErr: unknown;
	for (let i = 0; i < tries; i++) {
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`${res.status} for ${url}`);
			return await res.arrayBuffer();
		} catch (err) {
			lastErr = err;
			await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
		}
	}
	throw lastErr;
}

async function main() {
	const curation = parseYaml(await readFile(join(ROOT, 'scripts/curation.yaml'), 'utf8')) as Curation;
	const manualAliases = parseYaml(await readFile(join(ROOT, 'scripts/aliases.yaml'), 'utf8')) as Record<
		string,
		string[]
	>;

	console.log('Fetching source data...');
	const source = await fetchJson<SourceExercise[]>(SOURCE_JSON);
	const byName = new Map(source.map((e) => [e.name, e]));

	// Referential integrity of the curation file: every name must exist.
	for (const list of [curation.include, curation.exclude, curation.mobility, curation.unilateral]) {
		for (const name of list) {
			if (!byName.has(name)) throw new Error(`curation.yaml references unknown exercise: "${name}"`);
		}
	}
	for (const name of Object.keys(manualAliases)) {
		if (!byName.has(name)) throw new Error(`aliases.yaml references unknown exercise: "${name}"`);
	}

	const excluded = new Set(curation.exclude);
	const mobility = new Set(curation.mobility);
	const unilateral = new Set(curation.unilateral);

	const pool = source.filter(
		(e) =>
			(e.equipment === 'body only' || e.equipment === null || curation.include.includes(e.name)) &&
			!excluded.has(e.name)
	);

	if (pool.length > CATALOG_CAP) {
		throw new Error(`Pool is ${pool.length} exercises, cap is ${CATALOG_CAP}. Curate harder.`);
	}

	// Slug collisions are a hard error (§5).
	const slugs = new Map<string, string>();
	for (const e of pool) {
		const slug = slugify(e.name);
		const existing = slugs.get(slug);
		if (existing) throw new Error(`Slug collision: "${e.name}" and "${existing}" both -> ${slug}`);
		slugs.set(slug, e.name);
	}

	const mediaRoot = join(ROOT, 'static/media');
	await rm(mediaRoot, { recursive: true, force: true });

	const attributionId = 'free_exercise_db';
	const dropped: string[] = [];
	const duplicateFrames: string[] = [];
	const catalog: Exercise[] = [];

	// Bounded concurrency for image downloads.
	const queue = [...pool];
	const workers = Array.from({ length: 8 }, async () => {
		for (;;) {
			const src = queue.shift();
			if (!src) return;
			const id = slugify(src.name);

			const media: MediaAsset[] = [];
			const kept: Buffer[] = []; // signatures of the frames already written
			for (let i = 0; i < src.images.length; i++) {
				try {
					const raw = await fetchWithRetry(IMAGE_BASE + src.images[i]);
					const converted = sharp(Buffer.from(raw)).resize(MAX_EDGE, MAX_EDGE, {
						fit: 'inside',
						withoutEnlargement: true
					});
					const buf = await converted.webp({ quality: WEBP_QUALITY }).toBuffer();

					// Some source entries ship the same photograph twice. Rendering it
					// twice looks like a bug, so keep only the first copy.
					const sig = await signature(buf);
					if (kept.some((k) => meanAbsDiff(k, sig) < DUPLICATE_THRESHOLD)) {
						duplicateFrames.push(`${src.name} [${i}]`);
						continue;
					}
					kept.push(sig);

					const meta = await sharp(buf).metadata();
					const index = media.length;
					await mkdir(join(mediaRoot, id), { recursive: true });
					await writeFile(join(mediaRoot, id, `${index}.webp`), buf);
					media.push({
						kind: 'image',
						path: `/media/${id}/${index}.webp`,
						// No caption: the source does not label its frames, and inferring
						// "Start"/"End" from their order gets it wrong (see docs/M0-findings.md).
						width: meta.width ?? 0,
						height: meta.height ?? 0
					});
				} catch (err) {
					console.error(`  image failed: ${src.name} [${i}]: ${String(err)}`);
				}
			}

			if (media.length === 0) {
				dropped.push(src.name);
				console.error(`DROPPED (zero media): ${src.name}`);
				continue;
			}

			let category: Exercise['category'];
			if (src.category === 'stretching') category = mobility.has(src.name) ? 'mobility' : 'stretch';
			else if (src.category === 'plyometrics' || src.category === 'cardio') category = 'cardio';
			else if (src.category === 'strength' && src.primaryMuscles.includes('abdominals'))
				category = 'core';
			else category = 'strength';

			const aliasSet = new Set<string>();
			aliasSet.add(normalizeAlias(src.name));
			aliasSet.add(id.replace(/_/g, ' '));
			for (const a of manualAliases[src.name] ?? []) aliasSet.add(normalizeAlias(a));

			catalog.push({
				id,
				name: src.name,
				aliases: [...aliasSet].sort(),
				category,
				primaryMuscles: src.primaryMuscles,
				secondaryMuscles: src.secondaryMuscles,
				level: src.level === 'expert' ? 'advanced' : src.level,
				unilateral: unilateral.has(src.name),
				defaultMetric:
					category === 'stretch' || category === 'mobility' || src.force === 'static'
						? 'duration'
						: 'reps',
				instructions: src.instructions,
				media,
				attributionId
			});
		}
	});
	await Promise.all(workers);

	catalog.sort((a, b) => a.id.localeCompare(b.id));

	const attribution: Attribution[] = [
		{
			id: attributionId,
			source: 'free-exercise-db',
			license: 'PD',
			sourceUrl: 'https://github.com/yuhonas/free-exercise-db'
		}
	];

	const outDir = join(ROOT, 'src/lib/catalog');
	await mkdir(outDir, { recursive: true });
	await writeFile(join(outDir, 'catalog.json'), JSON.stringify(catalog, null, '\t') + '\n');
	await writeFile(join(outDir, 'attribution.json'), JSON.stringify(attribution, null, '\t') + '\n');

	// Stripped catalog for pasting alongside the LLM prompt (§14).
	const llm = catalog.map(({ id, name, category }) => ({ id, name, category }));
	await writeFile(join(ROOT, 'static/catalog-for-llm.json'), JSON.stringify(llm, null, '\t') + '\n');

	const perCategory: Record<string, number> = {};
	for (const e of catalog) perCategory[e.category] = (perCategory[e.category] ?? 0) + 1;
	console.log('\n=== Summary ===');
	console.log(`Total exercises: ${catalog.length}`);
	console.log(`Per category: ${JSON.stringify(perCategory)}`);
	console.log(`Per source: free-exercise-db=${catalog.length}`);
	console.log(`Dropped (zero media): ${dropped.length}${dropped.length ? ' -> ' + dropped.join(', ') : ''}`);
	console.log(
		`Duplicate frames skipped: ${duplicateFrames.length}${
			duplicateFrames.length ? ' -> ' + duplicateFrames.sort().join(', ') : ''
		}`
	);
	const single = catalog.filter((e) => e.media.length === 1).length;
	console.log(`Exercises with a single frame: ${single}, with two: ${catalog.length - single}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
