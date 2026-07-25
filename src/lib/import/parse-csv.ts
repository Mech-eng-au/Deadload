import Papa from 'papaparse';
import { ImportError, type ParsedRoutine } from './parse-json.js';
import { wireItemSchema, type WireItem } from './types.js';

/**
 * One item per row (§6.2). Header required, column order irrelevant, unknown
 * columns ignored. Parsed with papaparse rather than split(','), because notes
 * fields contain commas.
 */
export function parseCsv(text: string): ParsedRoutine {
	const result = Papa.parse<Record<string, string>>(text.trim(), {
		header: true,
		skipEmptyLines: 'greedy',
		transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_')
	});

	const fatal = result.errors.find((e) => e.type === 'Delimiter' || e.code === 'UndetectableDelimiter');
	if (fatal) throw new ImportError('That does not look like a CSV file.', fatal.message);

	const rows = result.data.filter((r) => Object.values(r).some((v) => v?.trim()));
	if (rows.length === 0) throw new ImportError('The file has no rows.');
	if (!('exercise' in rows[0])) {
		throw new ImportError(
			'The CSV needs an "exercise" column.',
			`Columns found: ${Object.keys(rows[0]).join(', ')}`
		);
	}

	const blocks: { label?: string; items: WireItem[] }[] = [];
	rows.forEach((row, i) => {
		const clean: Record<string, string> = {};
		for (const [k, v] of Object.entries(row)) if (v?.trim()) clean[k] = v.trim();
		if (!clean.exercise) return;

		const parsed = wireItemSchema.safeParse(clean);
		if (!parsed.success) {
			const issue = parsed.error.issues[0];
			throw new ImportError(
				`Row ${i + 2} could not be read.`,
				`${issue.path.join(' → ') || 'row'}: ${issue.message}`
			);
		}

		const label = clean.block || undefined;
		const last = blocks[blocks.length - 1];
		if (last && last.label === label) last.items.push(parsed.data);
		else blocks.push({ label, items: [parsed.data] });
	});

	if (blocks.length === 0) throw new ImportError('The routine has no exercises in it.');
	return { tags: [], blocks, notes: [] };
}
