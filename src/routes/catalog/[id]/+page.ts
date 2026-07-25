import { error } from '@sveltejs/kit';
import { catalog, getAttribution, getExercise } from '$lib/catalog/index.js';
import type { EntryGenerator, PageLoad } from './$types.js';

export const entries: EntryGenerator = () => catalog.map((e) => ({ id: e.id }));

export const load: PageLoad = ({ params }) => {
	const exercise = getExercise(params.id);
	if (!exercise) error(404, `No exercise "${params.id}" in the catalog`);
	return { exercise, attribution: getAttribution(exercise.attributionId) };
};
