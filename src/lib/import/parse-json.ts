import { wireDocumentSchema, type ImportNote, type WireItem, type WireRoutine } from './types.js';

export interface ParsedRoutine {
	name?: string;
	goal?: string;
	description?: string;
	tags: string[];
	blocks: { label?: string; circuit?: boolean; items: WireItem[] }[];
	notes: ImportNote[];
}

export class ImportError extends Error {
	constructor(
		message: string,
		/** The offending line, when we can point at one. */
		readonly detail?: string
	) {
		super(message);
		this.name = 'ImportError';
	}
}

/**
 * LLMs wrap JSON in markdown fences constantly (§6.5), so strip them before
 * parsing rather than making the user do it.
 */
export function stripFences(text: string): string {
	const trimmed = text.trim();
	const fenced = trimmed.match(/^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```$/);
	if (fenced) return fenced[1].trim();
	// A leading fence with no closing one also happens.
	return trimmed.replace(/^```[a-zA-Z]*\s*\n?/, '').replace(/\n?```$/, '').trim();
}

/** Turn a zod issue path into something a human can act on. */
function describeIssues(error: { issues: { path: PropertyKey[]; message: string }[] }): string {
	return error.issues
		.slice(0, 4)
		.map((i) => {
			const where = i.path.length ? i.path.join(' → ') : 'the document';
			return `${where}: ${i.message}`;
		})
		.join('; ');
}

export function parseJson(text: string): ParsedRoutine {
	const cleaned = stripFences(text);
	if (!cleaned) throw new ImportError('The file is empty.');

	let raw: unknown;
	try {
		raw = JSON.parse(cleaned);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		// V8 reports either "...at position N (line L column C)" or a context
		// form with no offsets at all, so fall back rather than losing the hint.
		const line = message.match(/line (\d+)/i);
		const position = message.match(/position (\d+)/i);
		let detail: string;
		if (line || position) {
			const lineNumber = line
				? Number(line[1])
				: cleaned.slice(0, Number(position![1])).split('\n').length;
			detail = `Line ${lineNumber}: ${cleaned.split('\n')[lineNumber - 1]?.trim() ?? ''}`;
		} else {
			detail = message;
		}
		throw new ImportError('That is not valid JSON.', detail);
	}

	const parsed = wireDocumentSchema.safeParse(raw);
	if (!parsed.success) {
		throw new ImportError('That JSON is not a routine.', describeIssues(parsed.error));
	}

	const notes: ImportNote[] = [];
	const doc = parsed.data;

	// A bare array of items, with no wrapper at all.
	if (Array.isArray(doc)) {
		if (doc.length === 0) throw new ImportError('The routine has no exercises in it.');
		return { tags: [], blocks: [{ items: doc }], notes };
	}

	const routine = doc as WireRoutine;
	if (routine.schema && !routine.schema.startsWith('deadload.routine/')) {
		notes.push({
			level: 'info',
			message: `Unfamiliar schema "${routine.schema}", read as a Deadload routine anyway.`
		});
	}

	let blocks: { label?: string; circuit?: boolean; items: WireItem[] }[];
	if (routine.blocks?.length) {
		blocks = routine.blocks.map((b) => ({
			label: b.label,
			circuit: b.circuit || b.mode?.trim().toLowerCase() === 'circuit' || undefined,
			items: b.items ?? b.exercises ?? []
		}));
	} else {
		const flat = routine.items ?? routine.exercises ?? [];
		blocks = [{ items: flat }];
	}

	blocks = blocks.filter((b) => b.items.length > 0);
	if (blocks.length === 0) throw new ImportError('The routine has no exercises in it.');

	return {
		name: routine.name,
		goal: routine.goal,
		description: routine.description,
		tags: routine.tags ?? [],
		blocks,
		notes
	};
}
