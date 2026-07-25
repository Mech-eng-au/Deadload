import type { Exercise, ExerciseId } from '../types.js';

/**
 * Name resolution (docs/SPEC.md §6.3). Pure and unit-testable: the catalog and
 * any learned overrides are passed in, never imported, so this stays free of
 * Svelte and of the database.
 */

export type ResolveResult =
	| { status: 'resolved'; exerciseId: ExerciseId; via: 'id' | 'override' | 'name' | 'alias' }
	| { status: 'suggested'; candidates: Candidate[] }
	| { status: 'unresolved'; candidates: Candidate[] };

export interface Candidate {
	exerciseId: ExerciseId;
	score: number;
}

export const SUGGESTION_THRESHOLD = 0.82;

/**
 * Lowercase, strip diacritics, reduce every run of non-alphanumerics to a
 * single space, trim. "World's Greatest Stretch" and "worlds-greatest-stretch"
 * both become "worlds greatest stretch".
 */
export function normalize(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		// Apostrophes are dropped rather than split on, so "World's Greatest
		// Stretch" and "worlds-greatest-stretch" land on the same string (§6.3).
		.replace(/['’ʼ`]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/** Dice coefficient over character bigrams of the normalized string. */
export function similarity(a: string, b: string): number {
	if (a === b) return 1;
	const bigrams = (s: string) => {
		const out = new Map<string, number>();
		const compact = s.replace(/ /g, '');
		for (let i = 0; i < compact.length - 1; i++) {
			const g = compact.slice(i, i + 2);
			out.set(g, (out.get(g) ?? 0) + 1);
		}
		return out;
	};
	const A = bigrams(a);
	const B = bigrams(b);
	let total = 0;
	let shared = 0;
	for (const n of A.values()) total += n;
	for (const [g, n] of B) {
		total += n;
		shared += Math.min(n, A.get(g) ?? 0);
	}
	return total === 0 ? 0 : (2 * shared) / total;
}

export interface ResolverIndex {
	byId: Map<ExerciseId, Exercise>;
	byName: Map<string, ExerciseId>;
	byAlias: Map<string, ExerciseId>;
	all: { id: ExerciseId; normalized: string }[];
}

export function buildIndex(catalog: Exercise[]): ResolverIndex {
	const byId = new Map<ExerciseId, Exercise>();
	const byName = new Map<string, ExerciseId>();
	const byAlias = new Map<string, ExerciseId>();
	const all: { id: ExerciseId; normalized: string }[] = [];

	for (const e of catalog) {
		byId.set(e.id, e);
		byName.set(normalize(e.name), e.id);
		// First alias wins, so an earlier exercise keeps a shared alias.
		for (const a of e.aliases) {
			const key = normalize(a);
			if (!byAlias.has(key)) byAlias.set(key, e.id);
		}
		all.push({ id: e.id, normalized: normalize(e.name) });
	}

	return { byId, byName, byAlias, all };
}

function rank(query: string, index: ResolverIndex, limit: number): Candidate[] {
	return index.all
		.map((e) => ({ exerciseId: e.id, score: similarity(query, e.normalized) }))
		.sort((a, b) => b.score - a.score || a.exerciseId.localeCompare(b.exerciseId))
		.slice(0, limit);
}

/**
 * First hit wins. Never auto-accepts a suggestion and never invents a catalog
 * entry: a silently wrong match is worse than a prompt (§6.3).
 */
export function resolve(
	name: string,
	index: ResolverIndex,
	overrides: Map<string, ExerciseId> = new Map()
): ResolveResult {
	const raw = name.trim();
	const key = normalize(raw);

	if (index.byId.has(raw)) return { status: 'resolved', exerciseId: raw, via: 'id' };

	const override = overrides.get(key);
	if (override && index.byId.has(override))
		return { status: 'resolved', exerciseId: override, via: 'override' };

	const byName = index.byName.get(key);
	if (byName) return { status: 'resolved', exerciseId: byName, via: 'name' };

	const byAlias = index.byAlias.get(key);
	if (byAlias) return { status: 'resolved', exerciseId: byAlias, via: 'alias' };

	const top = rank(key, index, 5);
	if (top[0] && top[0].score >= SUGGESTION_THRESHOLD) {
		return { status: 'suggested', candidates: top.slice(0, 3) };
	}
	return { status: 'unresolved', candidates: top };
}
