import { formatters } from '../format.js';

const f = formatters('en-GB');

export const importer = {
	title: 'Import a routine',
	dropHere: 'Drop a .json or .csv file here',
	chooseFile: 'Choose a file',
	orPaste: 'Or paste the text',
	pastePlaceholder: '{ "name": "Morning mobility", "blocks": [ … ] }',
	readIt: 'Read it',
	fencesFine: 'Markdown code fences around the JSON are fine, they get stripped.',
	orPreset: 'Or start from a built-in routine →',

	llmSummary: 'Get a routine from an LLM',
	llmIntro:
		'Copy the prompt below, attach the catalog file so it only uses exercises you have, and paste the answer back here.',
	llmBuiltFrom: (count: number) => `Both are built from what you own: ${f.num(count)} exercises, equipment`,
	llmChangeInSettings: '. Change it in Settings and download again.',
	copyPrompt: 'Copy prompt',
	copied: 'Copied',
	catalogFile: 'Catalog file',
	catalogSaving: 'Saving…',
	/** On the phone the file leaves through the share sheet; in a browser it downloads. */
	catalogSaved: (filename: string) => `Saved ${filename} — attach it to the chat.`,
	catalogSavedLocal: (filename: string) => `Written to app storage as ${filename}`,
	catalogFailed: (reason: string) => `Could not save the catalog file: ${reason}`,
	/**
	 * The prompt itself stays English (§16) — it is an instruction to a model and
	 * its JSON keys are English — but the routine it writes is the user's, so the
	 * model is told which language to write the prose in.
	 */
	promptLanguageLine: (language: string) =>
		`Write the routine's name, goal, description and notes in ${language}. Leave every field name and every exercise id exactly as they are.`,

	readyCount: (n: number) => f.plural(n, { one: '1 exercise ready.', other: `${f.num(n)} exercises ready.` }),
	stillNeedMatch: (n: number) =>
		f.plural(n, {
			one: '1 still needs a match.',
			other: `${f.num(n)} still need a match.`
		}),
	circuit: 'circuit',
	matchedFrom: (written: string) => `matched from “${written}”`,
	needsEquipment: (equipment: string) =>
		`Needs a ${equipment} — not ticked in Settings. Imported anyway.`,
	loadDropped: (kg: number) =>
		`The file put ${f.num(kg)} kg on this. It is not done with a weight, so the load is dropped.`,
	notExact: 'Not an exact match. Pick one:',
	notInCatalog: 'Not in the catalog. Pick the closest, or drop it.',
	searchCatalog: 'Search catalog',
	dropIt: 'Drop it',
	keepAfterAll: 'Keep it after all',
	rememberMeans: (written: string) => `Remember “${written}” means this`,
	startOver: 'Start over with a different file',
	saveRoutine: 'Save routine',
	matchFirst: (n: number) =>
		f.plural(n, {
			one: 'Match or drop the 1 highlighted exercise first.',
			other: `Match or drop the ${f.num(n)} highlighted exercises first.`
		}),
	pickerTitle: 'Pick an exercise',
	pickerSearch: (n: number) => `Search ${f.num(n)} exercises…`
};
