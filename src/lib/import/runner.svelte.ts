import { catalog } from '../catalog/index.js';
import { loadAliasOverrides, rememberAlias } from '../db/aliases.js';
import { putRoutine, uid } from '../db/routines.js';
import type { Routine } from '../types.js';
import {
	buildIndex,
	buildReview,
	normalize,
	parseText,
	toRoutine,
	type ImportNote,
	type ResolverIndex,
	type ReviewModel
} from './index.js';

/**
 * Glue between the pure import layer and the database. Everything stateful
 * lives here so parse/resolve/map stay testable headlessly (§15).
 */

let index: ResolverIndex | null = null;

export function resolverIndex(): ResolverIndex {
	index ??= buildIndex(catalog);
	return index;
}

export async function reviewFromText(text: string, filename?: string): Promise<ReviewModel> {
	const parsed = parseText(text, filename);
	const overrides = await loadAliasOverrides();
	return buildReview(parsed, resolverIndex(), overrides, uid);
}

export function outstanding(review: ReviewModel): number {
	return review.blocks
		.flatMap((b) => b.items)
		.filter((i) => !i.dropped && !i.chosen).length;
}

export function itemCount(review: ReviewModel): number {
	return review.blocks.flatMap((b) => b.items).filter((i) => !i.dropped && i.chosen).length;
}

export async function commitReview(
	review: ReviewModel,
	source: Routine['source'] = 'imported'
): Promise<{ routine: Routine; notes: ImportNote[] }> {
	// Learn the names the user mapped by hand, so the next import of the same
	// phrasing resolves silently (§4.4).
	for (const item of review.blocks.flatMap((b) => b.items)) {
		const wasAutomatic = item.result.status === 'resolved';
		if (!item.dropped && item.chosen && !wasAutomatic && item.remember) {
			await rememberAlias(normalize(item.written), item.chosen);
		}
	}

	const { routine, notes } = toRoutine(review, resolverIndex(), uid, source);
	await putRoutine(routine);
	return { routine, notes };
}
